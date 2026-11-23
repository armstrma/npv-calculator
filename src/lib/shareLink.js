// Share-link ("Copy Project Link") encoding and decoding.
//
// A share link carries the whole working model in plain query params so an
// unsaved, unnamed project can be shared without an account. Keep this format
// stable: links already pasted into emails, docs and LMS pages must keep working.
//
// Scenario links (v=2) add `lock` and `hide` lists on top of the same params.
// Locks are enforced in the browser only (honor system): anyone can edit the URL.
import {
  sanitizeCashflows,
  sanitizeFinancialValue,
  sanitizeProjectName,
  sanitizeRateValue,
} from './calculation.js';

export const SHARE_LINK_CURRENCIES = ['$', '€', '£'];
export const SHARE_LINK_PERIOD_MODES = ['months', 'quarters', 'years'];
export const SHARE_LINK_RATE_BASES = ['annual', 'per-period'];
export const SHARE_LINK_RESERVED_PARAM_KEYS = ['v', 'lock', 'hide'];
export const SCENARIO_LINK_VERSION = 2;

// Field locks a scenario author can set. `cf<N>` locks one cash flow (0-based).
export const SCENARIO_LOCK_KEYS = ['initial', 'discount', 'hurdle', 'cashflows', 'periods', 'period', 'rateBasis', 'currency'];
// UI features a scenario author can hide.
export const SCENARIO_HIDE_KEYS = ['sliderColors', 'sensitivity', 'presentation', 'export'];
const CASHFLOW_LOCK_PATTERN = /^cf(\d{1,4})$/;

const toSearchParams = (search) => (
  typeof search === 'string' || search == null
    ? new URLSearchParams(search || '')
    : search
);

// Build the query params for a share link from the current working model.
export const buildShareLinkParams = ({
  initial,
  discount,
  cashflows,
  currency,
  periodMode,
  rateBasis,
  showHurdleRate,
  hurdleRate,
  projectName,
  locks = [],
  hides = [],
}) => {
  const params = new URLSearchParams();
  params.set('initial', String(initial));
  params.set('discount', String(discount));
  params.set('cashflows', cashflows.join(','));
  params.set('currency', currency);
  params.set('period', periodMode);
  params.set('rateBasis', rateBasis);
  params.set('hurdleEnabled', String(showHurdleRate));
  if (showHurdleRate) params.set('hurdleRate', String(hurdleRate));
  const cleanLocks = normalizeScenarioLocks(locks);
  const cleanHides = normalizeScenarioHides(hides);
  const isScenario = cleanLocks.length > 0 || cleanHides.length > 0;
  // Scenario (lock) links are always unnamed.
  const sanitizedName = isScenario ? '' : sanitizeProjectName(projectName);
  if (sanitizedName) params.set('project', sanitizedName);
  if (isScenario) {
    params.set('v', String(SCENARIO_LINK_VERSION));
    if (cleanLocks.length) params.set('lock', cleanLocks.join(','));
    if (cleanHides.length) params.set('hide', cleanHides.join(','));
  }
  return params;
};

const splitList = (value) => (Array.isArray(value) ? value : String(value || '').split(','))
  .map((item) => String(item).trim())
  .filter(Boolean);

export const normalizeScenarioLocks = (value) => {
  const seen = new Set();
  splitList(value).forEach((key) => {
    if (SCENARIO_LOCK_KEYS.includes(key)) {
      seen.add(key);
      return;
    }
    const match = key.match(CASHFLOW_LOCK_PATTERN);
    if (match) seen.add(`cf${Number(match[1])}`);
  });
  return [...seen];
};

export const normalizeScenarioHides = (value) => [...new Set(splitList(value).filter((key) => SCENARIO_HIDE_KEYS.includes(key)))];

// Read the scenario part of a link. Unknown keys are dropped; links without
// lock/hide params (every link made before v2) return empty lists.
export const parseScenarioLinkParams = (search) => {
  const params = toSearchParams(search);
  const locks = normalizeScenarioLocks(params.get('lock'));
  const hides = normalizeScenarioHides(params.get('hide'));
  return { locks, hides, isScenario: locks.length > 0 || hides.length > 0 };
};

export const buildShareLinkUrl = (baseUrl, model) => `${baseUrl}?${buildShareLinkParams(model).toString()}`;

// Decode share-link params. Only fields that are present and valid are
// returned, so callers can layer them over an example or the defaults exactly
// as before. Unknown params (including the reserved v/lock/hide) are ignored.
export const parseShareLinkParams = (search) => {
  const params = toSearchParams(search);
  const result = {};

  const initialValue = params.get('initial');
  if (initialValue !== null) {
    const parsedInitial = sanitizeFinancialValue(initialValue);
    if (Number.isFinite(parsedInitial)) result.initial = parsedInitial;
  }

  const discountValue = params.get('discount');
  if (discountValue !== null) {
    const parsedDiscount = sanitizeRateValue(discountValue);
    if (Number.isFinite(parsedDiscount)) result.discount = parsedDiscount;
  }

  const cashflowsParam = params.get('cashflows');
  if (cashflowsParam) {
    const parsedCashflows = sanitizeCashflows(cashflowsParam.split(','));
    if (parsedCashflows.length) result.cashflows = parsedCashflows;
  }

  const currencyParam = params.get('currency');
  if (currencyParam && SHARE_LINK_CURRENCIES.includes(currencyParam)) result.currency = currencyParam;

  const periodParam = params.get('period');
  if (periodParam && SHARE_LINK_PERIOD_MODES.includes(periodParam)) result.periodMode = periodParam;

  const rateBasisParam = params.get('rateBasis');
  if (rateBasisParam && SHARE_LINK_RATE_BASES.includes(rateBasisParam)) result.rateBasis = rateBasisParam;

  const hurdleEnabledParam = params.get('hurdleEnabled');
  if (hurdleEnabledParam !== null) result.showHurdleRate = hurdleEnabledParam === 'true';

  const hurdleRateParam = params.get('hurdleRate');
  if (hurdleRateParam !== null) {
    const parsedHurdleRate = sanitizeRateValue(hurdleRateParam);
    if (Number.isFinite(parsedHurdleRate)) result.hurdleRate = parsedHurdleRate;
  }

  const projectParam = params.get('project');
  if (projectParam) result.projectName = sanitizeProjectName(projectParam);

  return result;
};
