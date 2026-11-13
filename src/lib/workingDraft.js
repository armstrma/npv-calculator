import { sanitizeProjectName, sanitizeProjectSnapshot } from './calculation.js';

export const PROJECTS_STORAGE_KEY = 'npvProjects';
export const PROJECTS_BACKUP_KEY = 'npvProjects.corrupt';
export const WORKING_DRAFT_STORAGE_KEY = 'npvWorkingDraft';
export const WORKING_DRAFT_BACKUP_KEY = 'npvWorkingDraft.corrupt';
export const WORKING_DRAFT_VERSION = 1;
export const WORKING_DRAFT_DEBOUNCE_MS = 400;

export const DEFAULT_WORKING_MODEL = {
  initial: 1000,
  discount: 10,
  cashflows: [200, 300, 400, 500, 600],
  periodMode: 'years',
  rateBasis: 'annual',
  showHurdleRate: false,
  hurdleRate: 12,
  currency: '$',
  projectName: '',
  loadedProjectName: '',
  loadedProjectSource: 'scratch',
};

export const createDefaultWorkingModel = () => ({
  ...DEFAULT_WORKING_MODEL,
  cashflows: [...DEFAULT_WORKING_MODEL.cashflows],
});

export const SHARED_LINK_PARAM_KEYS = [
  'initial',
  'discount',
  'cashflows',
  'currency',
  'period',
  'rateBasis',
  'project',
  'hurdleEnabled',
  'hurdleRate',
];

const VALID_SOURCES = new Set(['scratch', 'local', 'cloud', 'example']);
const VALID_CURRENCIES = new Set(['$', '€', '£']);

const isPlainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const getStorage = () => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

export const readStorageRaw = (key) => {
  try {
    return getStorage()?.getItem(key) ?? null;
  } catch {
    return null;
  }
};

export const writeStorageRaw = (key, value) => {
  try {
    getStorage()?.setItem(key, value);
    return true;
  } catch {
    return false;
  }
};

export const removeStorageKey = (key) => {
  try {
    getStorage()?.removeItem(key);
  } catch {
    /* ignore quota / private-mode failures */
  }
};

const backupAndClear = (key, backupKey, raw) => {
  if (backupKey && raw != null) writeStorageRaw(backupKey, raw);
  removeStorageKey(key);
};

export const readJsonStorage = (key, { backupKey } = {}) => {
  const raw = readStorageRaw(key);
  if (raw == null || raw === '') return { ok: true, value: null, recovered: false };
  try {
    return { ok: true, value: JSON.parse(raw), recovered: false, raw };
  } catch {
    backupAndClear(key, backupKey, raw);
    return { ok: false, value: null, recovered: true, raw };
  }
};

export const readStoredProjects = () => {
  const result = readJsonStorage(PROJECTS_STORAGE_KEY, { backupKey: PROJECTS_BACKUP_KEY });
  if (!result.ok || result.value == null) return {};
  if (!isPlainObject(result.value)) {
    backupAndClear(PROJECTS_STORAGE_KEY, PROJECTS_BACKUP_KEY, result.raw);
    return {};
  }
  return result.value;
};

export const writeStoredProjects = (projects) => {
  writeStorageRaw(PROJECTS_STORAGE_KEY, JSON.stringify(projects ?? {}));
};

export const normalizeWorkingDraft = (input) => {
  if (!isPlainObject(input)) return null;
  const model = isPlainObject(input.model) ? input.model : input;
  const snapshot = sanitizeProjectSnapshot(model);
  return {
    ...snapshot,
    currency: VALID_CURRENCIES.has(model.currency) ? model.currency : '$',
    projectName: sanitizeProjectName(model.projectName),
    loadedProjectName: sanitizeProjectName(model.loadedProjectName || model.projectName),
    loadedProjectSource: VALID_SOURCES.has(model.loadedProjectSource) ? model.loadedProjectSource : 'scratch',
  };
};

export const buildWorkingDraftPayload = (model, { savedAt = Date.now() } = {}) => ({
  version: WORKING_DRAFT_VERSION,
  savedAt,
  model: normalizeWorkingDraft(model),
});

export const readWorkingDraft = () => {
  const result = readJsonStorage(WORKING_DRAFT_STORAGE_KEY, { backupKey: WORKING_DRAFT_BACKUP_KEY });
  if (!result.ok || result.value == null) return null;
  if (!isPlainObject(result.value)) {
    backupAndClear(WORKING_DRAFT_STORAGE_KEY, WORKING_DRAFT_BACKUP_KEY, result.raw);
    return null;
  }
  return normalizeWorkingDraft(result.value);
};

// Immediate write for payment-flow redirects, refreshes, and the debounced autosave flush.
export const writeWorkingDraft = (model) => {
  const payload = buildWorkingDraftPayload(model);
  writeStorageRaw(WORKING_DRAFT_STORAGE_KEY, JSON.stringify(payload));
  return payload;
};

export const clearWorkingDraft = () => {
  removeStorageKey(WORKING_DRAFT_STORAGE_KEY);
};

export const resetSavedAppData = () => {
  removeStorageKey(PROJECTS_STORAGE_KEY);
  removeStorageKey(PROJECTS_BACKUP_KEY);
  removeStorageKey(WORKING_DRAFT_STORAGE_KEY);
  removeStorageKey(WORKING_DRAFT_BACKUP_KEY);
};

export const createDebouncedWriter = (write, delayMs = WORKING_DRAFT_DEBOUNCE_MS) => {
  let timer = null;
  const schedule = (value) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      write(value);
    }, delayMs);
  };
  schedule.flush = (value) => {
    if (timer) clearTimeout(timer);
    timer = null;
    if (value !== undefined) write(value);
  };
  schedule.cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };
  return schedule;
};

// Cache the first URL we see in this page load so share-link / example precedence
// still works after React Strict Mode remounts (the app clears those params on load).
let cachedLaunchLocation = null;

export const rememberLaunchLocation = (location = typeof window === 'undefined' ? null : window.location) => {
  if (!cachedLaunchLocation) {
    cachedLaunchLocation = {
      pathname: location?.pathname || '/',
      search: location?.search || '',
    };
  }
  return cachedLaunchLocation;
};

export const resetLaunchLocationCache = () => {
  cachedLaunchLocation = null;
};

export const hasSharedLinkParams = (search) => {
  const params = typeof search === 'string' || search == null
    ? new URLSearchParams(search || '')
    : search;
  return SHARED_LINK_PARAM_KEYS.some((key) => params.get(key) !== null);
};

export const isExamplePath = (pathname = '') => /^\/examples\/[^/?#]+/.test(pathname);

export const hasUrlDrivenModel = (location = {}) => {
  const pathname = location.pathname || '';
  const params = new URLSearchParams(location.search || '');
  if (params.get('example')) return true;
  if (hasSharedLinkParams(params)) return true;
  return isExamplePath(pathname);
};

// After a share or example link is applied, drop those params so a reload
// restores the working draft instead of re-applying the original link.
export const getPathAfterUrlDrivenLaunch = (location = {}) => {
  const pathname = location.pathname || '/';
  if (isExamplePath(pathname)) return '/';
  return pathname || '/';
};
