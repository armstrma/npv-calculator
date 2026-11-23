// State for a model opened from a share link, kept across reloads.
//
// - Every shared-link load starts a "link session" holding the shared values
//   (the baseline) plus any author locks and hidden features.
// - Free users viewing a link keep the shared settings (months, per-period
//   rates, hurdle) read-only instead of having them silently trimmed.
// - Scenario links (with locks or hidden features) autosave to their own key so
//   they never overwrite the user's normal working draft.
import { FREE_TIER_LIMITS } from './entitlementAccess.js';
import { buildWorkingDraftPayload, normalizeWorkingDraft, readJsonStorage, removeStorageKey, writeStorageRaw } from './workingDraft.js';
import { normalizeScenarioHides, normalizeScenarioLocks } from './shareLink.js';

export const LINK_SESSION_STORAGE_KEY = 'npvLinkSession';
export const LINK_DRAFT_KEY_PREFIX = 'npvWorkingDraft.link.';
export const LINK_SESSION_VERSION = 1;

// Lock messages are short so they fit on the slider (desktop and mobile).
// Format: "Locked by author" / "Locked by author: <reason>" and "Pro" / "Pro: <reason>".
export const AUTHOR_LOCK_LABEL = 'Locked by author';
export const TIER_LOCK_LABEL = 'Pro';
export const LOCK_REASON_MAX_LENGTH = 40;

export const formatLockMessage = (kind, reason = '') => {
  const label = kind === 'author' ? AUTHOR_LOCK_LABEL : TIER_LOCK_LABEL;
  const brief = String(reason || '').trim().slice(0, LOCK_REASON_MAX_LENGTH);
  if (brief) return `${label}: ${brief}`;
  return kind === 'author' ? label : `${label} feature`;
};

export const AUTHOR_LOCK_MESSAGE = formatLockMessage('author');
export const EXAMPLE_TIER_LOCK_MESSAGE = formatLockMessage('tier', 'edit full example');
export const SHARED_HURDLE_TIER_LOCK_MESSAGE = formatLockMessage('tier', 'hurdle rate');
export const SHARED_SETTING_TIER_LOCK_MESSAGE = formatLockMessage('tier', 'shared setting');
const PERIOD_WORDS = { years: 'years', quarters: 'quarters', months: 'months' };
const PERIOD_MODE_WORDS = { quarters: 'quarterly periods', months: 'monthly periods' };
const RATE_WORDS = { quarters: 'quarterly rates', months: 'monthly rates' };
export const getBeyondPeriodsMessage = (periodMode = 'years') => formatLockMessage('tier', `beyond ${FREE_TIER_LIMITS.maxCashflowPeriods} ${PERIOD_WORDS[periodMode] || 'periods'}`);
export const SHARED_PERIOD_TIER_LOCK_MESSAGE = getBeyondPeriodsMessage('years');
// Longer wording for the upgrade modal (not the slider tooltip).
export const FREE_SHARED_PERIODS_UPGRADE_MESSAGE = `Free accounts can edit the first ${FREE_TIER_LIMITS.maxCashflowPeriods} periods of a shared model. Upgrade to edit longer horizons.`;

// Small, stable, non-cryptographic hash (FNV-1a) used only to scope autosave keys.
export const hashLinkSearch = (search = '') => {
  const params = new URLSearchParams(search);
  const canonical = [...params.entries()]
    .sort(([a, av], [b, bv]) => (a === b ? av.localeCompare(bv) : a.localeCompare(b)))
    .map(([key, value]) => `${key}=${value}`)
    .join('&');
  let hash = 0x811c9dc5;
  for (let i = 0; i < canonical.length; i += 1) {
    hash ^= canonical.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
};

// `returnDraft` is the user's own work from before a plain link replaced it,
// so "Exit Scenario" can bring it back. Scenario links never touch that draft.
export const createLinkSession = ({ search, baseline, locks = [], hides = [], returnDraft = null }) => {
  const cleanLocks = normalizeScenarioLocks(locks);
  const cleanHides = normalizeScenarioHides(hides);
  return {
    version: LINK_SESSION_VERSION,
    key: hashLinkSearch(search),
    isScenario: cleanLocks.length > 0 || cleanHides.length > 0,
    locks: cleanLocks,
    hides: cleanHides,
    baseline: normalizeWorkingDraft({ ...baseline, loadedProjectSource: 'scratch' }),
    returnDraft: returnDraft ? normalizeWorkingDraft(returnDraft) : null,
  };
};

export const normalizeLinkSession = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  if (value.version !== LINK_SESSION_VERSION || typeof value.key !== 'string' || !value.key) return null;
  const baseline = normalizeWorkingDraft(value.baseline);
  if (!baseline) return null;
  const locks = normalizeScenarioLocks(value.locks);
  const hides = normalizeScenarioHides(value.hides);
  return {
    version: LINK_SESSION_VERSION,
    key: value.key,
    isScenario: locks.length > 0 || hides.length > 0,
    locks,
    hides,
    baseline,
    returnDraft: value.returnDraft ? normalizeWorkingDraft(value.returnDraft) : null,
  };
};

export const readLinkSession = () => {
  const result = readJsonStorage(LINK_SESSION_STORAGE_KEY);
  if (!result.ok) return null;
  const session = normalizeLinkSession(result.value);
  if (!session && result.value != null) removeStorageKey(LINK_SESSION_STORAGE_KEY);
  return session;
};

export const writeLinkSession = (session) => {
  if (!session) {
    removeStorageKey(LINK_SESSION_STORAGE_KEY);
    return;
  }
  writeStorageRaw(LINK_SESSION_STORAGE_KEY, JSON.stringify(session));
};

export const clearLinkSession = () => removeStorageKey(LINK_SESSION_STORAGE_KEY);

export const getLinkDraftKey = (session) => `${LINK_DRAFT_KEY_PREFIX}${session.key}`;

export const readLinkDraft = (session) => {
  if (!session) return null;
  const result = readJsonStorage(getLinkDraftKey(session));
  if (!result.ok || !result.value) return null;
  return normalizeWorkingDraft(result.value);
};

export const writeLinkDraft = (session, model) => {
  if (!session) return null;
  const payload = buildWorkingDraftPayload(model);
  writeStorageRaw(getLinkDraftKey(session), JSON.stringify(payload));
  return payload;
};

// Does this model use anything beyond what a free account can build?
export const exceedsFreeTier = (model = {}) => (
  (Array.isArray(model.cashflows) && model.cashflows.length > FREE_TIER_LIMITS.maxCashflowPeriods)
  || (model.periodMode && model.periodMode !== 'years')
  || (model.rateBasis && model.rateBasis !== 'annual')
  || Boolean(model.showHurdleRate)
);

const UNLOCKED = Object.freeze({ locked: false, reason: null, message: '' });
const lockOf = (reason, message) => ({ locked: true, reason, message });

// One place that decides whether each input is editable and why not.
// Author locks win over tier locks so the message reflects the author's intent.
// `authorReasons` optionally maps a lock key (e.g. "discount", "cf2") to a brief reason.
export const createFieldLocks = ({
  isFreeExamplePreview = false,
  isFreeSharedView = false,
  authorLocks = [],
  authorReasons = {},
  showHurdleRate = false,
  periodMode = 'years',
  rateBasis = 'annual',
} = {}) => {
  const locks = new Set(authorLocks);
  const freeLimit = FREE_TIER_LIMITS.maxCashflowPeriods;
  const examplePreviewLock = lockOf('tier', EXAMPLE_TIER_LOCK_MESSAGE);
  const author = (key) => lockOf('author', formatLockMessage('author', authorReasons?.[key]));
  const tier = (reason) => lockOf('tier', formatLockMessage('tier', reason));

  const initial = () => {
    if (locks.has('initial')) return author('initial');
    if (isFreeExamplePreview) return examplePreviewLock;
    return UNLOCKED;
  };

  const rate = () => {
    const rateKey = showHurdleRate ? 'hurdle' : 'discount';
    if (locks.has(rateKey)) return author(rateKey);
    if (isFreeExamplePreview) return examplePreviewLock;
    if (isFreeSharedView) {
      if (showHurdleRate) return tier('hurdle rate');
      if (RATE_WORDS[periodMode]) return tier(RATE_WORDS[periodMode]);
      if (rateBasis !== 'annual') return tier('per-period rates');
    }
    return UNLOCKED;
  };

  const hurdleToggle = () => {
    if (locks.has('hurdle')) return author('hurdle');
    if (isFreeExamplePreview || isFreeSharedView) return tier('hurdle rate');
    return UNLOCKED;
  };

  const cashflow = (index) => {
    if (locks.has(`cf${index}`)) return author(`cf${index}`);
    if (locks.has('cashflows')) return author('cashflows');
    if (isFreeExamplePreview && index > 0) return examplePreviewLock;
    if (isFreeSharedView && index >= freeLimit) return lockOf('tier', getBeyondPeriodsMessage(periodMode));
    return UNLOCKED;
  };

  // Adding/removing periods shifts every later period, so it is blocked when
  // the author locked the period count or any cash flow.
  const hasCashflowAuthorLock = [...locks].some((key) => key === 'cashflows' || /^cf\d+$/.test(key));
  const periodStructure = (cashflowCount = 0) => {
    if (locks.has('periods')) return author('periods');
    if (hasCashflowAuthorLock) return author('cashflows');
    if (isFreeExamplePreview) return examplePreviewLock;
    if (isFreeSharedView && cashflowCount > freeLimit) return lockOf('tier', getBeyondPeriodsMessage(periodMode));
    return UNLOCKED;
  };

  const periodModeLock = (currentPeriodMode = periodMode) => {
    if (locks.has('period')) return author('period');
    if (isFreeSharedView && currentPeriodMode !== 'years') return tier(PERIOD_MODE_WORDS[currentPeriodMode] || 'custom periods');
    return UNLOCKED;
  };

  const currency = () => (locks.has('currency') ? author('currency') : UNLOCKED);

  return { initial, rate, hurdleToggle, cashflow, periodStructure, periodMode: periodModeLock, currency };
};
