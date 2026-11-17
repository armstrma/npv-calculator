const env = import.meta.env || {};

export const PREVIEW_TEST_MODE = env.VITE_PREVIEW_TEST_MODE === 'true';
export const PREVIEW_CLOUD_STORAGE_KEY = 'npvPreviewCloud';
export const PREVIEW_PRO_STORAGE_KEY = 'npvPreviewPro';
export const PREVIEW_TESTER_NAME = 'Preview tester';
export const PREVIEW_TEST_MODE_LABEL = 'Preview test mode';

export const PREVIEW_TESTER = {
  id: 'preview-tester',
  email: 'preview-tester@npvlab.local',
  name: PREVIEW_TESTER_NAME,
};

export const isPreviewTestModeFlag = (value) => value === true || value === 'true';

const getStorage = () => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

const readJson = (key, fallback) => {
  try {
    const raw = getStorage()?.getItem(key);
    if (raw == null || raw === '') return fallback;
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
};

const writeJson = (key, value) => {
  try {
    getStorage()?.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
};

const isPlainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

export const getPreviewSession = () => ({
  accessToken: 'preview-test-mode',
  refreshToken: '',
  tokenType: 'bearer',
  createdAt: Date.now(),
  expiresAt: Date.now() + 365 * 24 * 60 * 60 * 1000,
  previewTestMode: true,
});

export const readPreviewProEnabled = () => getStorage()?.getItem(PREVIEW_PRO_STORAGE_KEY) === 'true';

export const writePreviewProEnabled = (enabled) => {
  try {
    getStorage()?.setItem(PREVIEW_PRO_STORAGE_KEY, enabled ? 'true' : 'false');
    return true;
  } catch {
    return false;
  }
};

export const getPreviewEntitlement = (enabled = readPreviewProEnabled()) => ({
  hasPro: Boolean(enabled),
  source: 'preview-test',
});

export const listPreviewCloudProjects = () => {
  const stored = readJson(PREVIEW_CLOUD_STORAGE_KEY, {});
  return isPlainObject(stored) ? { ...stored } : {};
};

export const upsertPreviewCloudProject = ({ name, project }) => {
  const trimmedName = String(name || '').trim();
  if (!trimmedName) {
    throw new Error('A project name is required.');
  }
  const current = listPreviewCloudProjects();
  const saved = {
    ...project,
    updatedAt: new Date().toISOString(),
  };
  const next = {
    ...current,
    [trimmedName]: saved,
  };
  writeJson(PREVIEW_CLOUD_STORAGE_KEY, next);
  return { [trimmedName]: saved };
};

export const deletePreviewCloudProject = ({ name }) => {
  const trimmedName = String(name || '').trim();
  const current = listPreviewCloudProjects();
  if (!Object.prototype.hasOwnProperty.call(current, trimmedName)) return;
  const next = { ...current };
  delete next[trimmedName];
  writeJson(PREVIEW_CLOUD_STORAGE_KEY, next);
};

export const clearPreviewCloudProjects = () => {
  try {
    getStorage()?.removeItem(PREVIEW_CLOUD_STORAGE_KEY);
  } catch {
    /* ignore */
  }
};
