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

export const AUTHOR_LOCK_MESSAGE = 'Locked by the author of this scenario.';
export const EXAMPLE_TIER_LOCK_MESSAGE = 'This component is locked for editing. Upgrade to premium to modify and save your own copy.';
export const SHARED_PERIOD_TIER_LOCK_MESSAGE = `Free accounts can edit the first ${FREE_TIER_LIMITS.maxCashflowPeriods} periods of a shared model. Upgrade to edit longer horizons.`;
export const SHARED_HURDLE_TIER_LOCK_MESSAGE = 'Hurdle rates are a Pro feature. This shared value is read-only on the free plan. Upgrade to edit it.';
export const SHARED_SETTING_TIER_LOCK_MESSAGE = 'This shared setting is read-only on the free plan. Upgrade to change it.';

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

export const createLinkSession = ({ search, baseline, locks = [], hides = [] }) => {
  const cleanLocks = normalizeScenarioLocks(locks);
  const cleanHides = normalizeScenarioHides(hides);
  return {
    version: LINK_SESSION_VERSION,
    key: hashLinkSearch(search),
    isScenario: cleanLocks.length > 0 || cleanHides.length > 0,
    locks: cleanLocks,
    hides: cleanHides,
    baseline: normalizeWorkingDraft({ ...baseline, loadedProjectSource: 'scratch' }),
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
const authorLock = Object.freeze({ locked: true, reason: 'author', message: AUTHOR_LOCK_MESSAGE });
const tierLock = (message) => ({ locked: true, reason: 'tier', message });

// One place that decides whether each input is editable and why not.
// Author locks win over tier locks so the message reflects the author's intent.
export const createFieldLocks = ({
  isFreeExamplePreview = false,
  isFreeSharedView = false,
  authorLocks = [],
  showHurdleRate = false,
} = {}) => {
  const locks = new Set(authorLocks);
  const freeLimit = FREE_TIER_LIMITS.maxCashflowPeriods;
  const examplePreviewLock = tierLock(EXAMPLE_TIER_LOCK_MESSAGE);

  const initial = () => {
    if (locks.has('initial')) return authorLock;
    if (isFreeExamplePreview) return examplePreviewLock;
    return UNLOCKED;
  };

  const rate = () => {
    if (locks.has(showHurdleRate ? 'hurdle' : 'discount')) return authorLock;
    if (isFreeExamplePreview) return examplePreviewLock;
    if (isFreeSharedView && showHurdleRate) return tierLock(SHARED_HURDLE_TIER_LOCK_MESSAGE);
    return UNLOCKED;
  };

  const hurdleToggle = () => {
    if (locks.has('hurdle')) return authorLock;
    if (isFreeExamplePreview || isFreeSharedView) return tierLock(SHARED_HURDLE_TIER_LOCK_MESSAGE);
    return UNLOCKED;
  };

  const cashflow = (index) => {
    if (locks.has('cashflows') || locks.has(`cf${index}`)) return authorLock;
    if (isFreeExamplePreview && index > 0) return examplePreviewLock;
    if (isFreeSharedView && index >= freeLimit) return tierLock(SHARED_PERIOD_TIER_LOCK_MESSAGE);
    return UNLOCKED;
  };

  // Adding/removing periods shifts every later period, so it is blocked when
  // the author locked the period count or any later period is locked.
  const hasCashflowAuthorLock = [...locks].some((key) => key === 'cashflows' || /^cf\d+$/.test(key));
  const periodStructure = (cashflowCount = 0) => {
    if (locks.has('periods') || hasCashflowAuthorLock) return authorLock;
    if (isFreeExamplePreview) return examplePreviewLock;
    if (isFreeSharedView && cashflowCount > freeLimit) return tierLock(SHARED_PERIOD_TIER_LOCK_MESSAGE);
    return UNLOCKED;
  };

  const periodMode = (currentPeriodMode = 'years') => {
    if (locks.has('period')) return authorLock;
    if (isFreeSharedView && currentPeriodMode !== 'years') return tierLock(SHARED_SETTING_TIER_LOCK_MESSAGE);
    return UNLOCKED;
  };

  const currency = () => (locks.has('currency') ? authorLock : UNLOCKED);

  return { initial, rate, hurdleToggle, cashflow, periodStructure, periodMode, currency };
};
