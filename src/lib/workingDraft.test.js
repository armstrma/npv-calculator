import test from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import {
  PROJECTS_BACKUP_KEY,
  PROJECTS_STORAGE_KEY,
  WORKING_DRAFT_BACKUP_KEY,
  WORKING_DRAFT_STORAGE_KEY,
  createDebouncedWriter,
  createDefaultWorkingModel,
  getPathAfterUrlDrivenLaunch,
  hasSharedLinkParams,
  hasUrlDrivenModel,
  isExamplePath,
  readStoredProjects,
  readWorkingDraft,
  resetLaunchLocationCache,
  resetSavedAppData,
  writeStoredProjects,
  writeWorkingDraft,
} from './workingDraft.js';

const createStorage = () => {
  const values = new Map();
  return {
    getItem: (key) => (values.has(key) ? values.get(key) : null),
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
    clear: () => values.clear(),
  };
};

const setupStorage = () => {
  const localStorage = createStorage();
  globalThis.window = {
    localStorage,
    location: { pathname: '/', search: '' },
  };
  resetLaunchLocationCache();
  return localStorage;
};

const sampleModel = {
  initial: 5555,
  discount: 8.5,
  cashflows: [100, 200, 300],
  periodMode: 'quarters',
  rateBasis: 'per-period',
  showHurdleRate: true,
  hurdleRate: 11,
  currency: '€',
  projectName: 'Pipeline Case',
  loadedProjectName: 'Pipeline Case',
  loadedProjectSource: 'local',
};

test('writeWorkingDraft persists immediately for payment-flow redirects', () => {
  const storage = setupStorage();

  const payload = writeWorkingDraft(sampleModel);
  assert.equal(payload.version, 1);
  assert.equal(payload.model.initial, 5555);
  assert.equal(payload.model.currency, '€');

  const restored = readWorkingDraft();
  assert.deepEqual(restored, {
    initial: 5555,
    discount: 8.5,
    cashflows: [100, 200, 300],
    periodMode: 'quarters',
    rateBasis: 'per-period',
    showHurdleRate: true,
    hurdleRate: 11,
    currency: '€',
    projectName: 'Pipeline Case',
    loadedProjectName: 'Pipeline Case',
    loadedProjectSource: 'local',
  });
  assert.equal(JSON.parse(storage.getItem(WORKING_DRAFT_STORAGE_KEY)).model.initial, 5555);
});

test('readWorkingDraft accepts a raw snapshot without the version wrapper', () => {
  setupStorage();
  window.localStorage.setItem(WORKING_DRAFT_STORAGE_KEY, JSON.stringify(sampleModel));

  const restored = readWorkingDraft();
  assert.equal(restored.initial, 5555);
  assert.equal(restored.projectName, 'Pipeline Case');
});

test('corrupt project storage is backed up and starts clean', () => {
  const storage = setupStorage();
  storage.setItem(PROJECTS_STORAGE_KEY, '{not-json');

  assert.deepEqual(readStoredProjects(), {});
  assert.equal(storage.getItem(PROJECTS_STORAGE_KEY), null);
  assert.equal(storage.getItem(PROJECTS_BACKUP_KEY), '{not-json');
});

test('invalid project storage shape is backed up and starts clean', () => {
  const storage = setupStorage();
  storage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(['oops']));

  assert.deepEqual(readStoredProjects(), {});
  assert.equal(storage.getItem(PROJECTS_STORAGE_KEY), null);
  assert.equal(storage.getItem(PROJECTS_BACKUP_KEY), JSON.stringify(['oops']));
});

test('corrupt working draft is backed up and treated as missing', () => {
  const storage = setupStorage();
  storage.setItem(WORKING_DRAFT_STORAGE_KEY, 'not-json');

  assert.equal(readWorkingDraft(), null);
  assert.equal(storage.getItem(WORKING_DRAFT_STORAGE_KEY), null);
  assert.equal(storage.getItem(WORKING_DRAFT_BACKUP_KEY), 'not-json');
});

test('valid stored projects round-trip', () => {
  setupStorage();
  writeStoredProjects({ 'Case A': { initial: 10, cashflows: [1] } });
  assert.equal(readStoredProjects()['Case A'].initial, 10);
});

test('resetSavedAppData clears projects and drafts but leaves other keys', () => {
  const storage = setupStorage();
  writeStoredProjects({ Keep: { initial: 1 } });
  writeWorkingDraft(sampleModel);
  storage.setItem(PROJECTS_BACKUP_KEY, 'old');
  storage.setItem('npvLabSupabaseSession', '{"accessToken":"keep-me"}');

  resetSavedAppData();

  assert.equal(storage.getItem(PROJECTS_STORAGE_KEY), null);
  assert.equal(storage.getItem(PROJECTS_BACKUP_KEY), null);
  assert.equal(storage.getItem(WORKING_DRAFT_STORAGE_KEY), null);
  assert.equal(storage.getItem('npvLabSupabaseSession'), '{"accessToken":"keep-me"}');
});

test('createDebouncedWriter delays writes and flush writes immediately', async () => {
  const writes = [];
  const save = createDebouncedWriter((value) => writes.push(value), 20);

  save('one');
  save('two');
  assert.deepEqual(writes, []);

  await delay(40);
  assert.deepEqual(writes, ['two']);

  save('three');
  save.flush('flushed');
  assert.deepEqual(writes, ['two', 'flushed']);
});

test('hasSharedLinkParams detects share-link keys and ignores unrelated query params', () => {
  assert.equal(hasSharedLinkParams('?initial=10'), true);
  assert.equal(hasSharedLinkParams('?discount=8&cashflows=1,2,3'), true);
  assert.equal(hasSharedLinkParams('?project=Case'), true);
  assert.equal(hasSharedLinkParams('?example=widget-line'), false);
  assert.equal(hasSharedLinkParams('?signedIn=e2e'), false);
  assert.equal(hasSharedLinkParams(''), false);
});

test('hasUrlDrivenModel treats share links, example query params, and example paths as URL-driven', () => {
  assert.equal(hasUrlDrivenModel({ pathname: '/', search: '?initial=10' }), true);
  assert.equal(hasUrlDrivenModel({ pathname: '/', search: '?example=widget-line' }), true);
  assert.equal(hasUrlDrivenModel({ pathname: '/examples/widget-line', search: '' }), true);
  assert.equal(hasUrlDrivenModel({ pathname: '/examples', search: '' }), false);
  assert.equal(hasUrlDrivenModel({ pathname: '/', search: '?signedIn=e2e' }), false);
});

test('isExamplePath only matches a concrete example slug path', () => {
  assert.equal(isExamplePath('/examples/equipment-purchase'), true);
  assert.equal(isExamplePath('/examples'), false);
  assert.equal(isExamplePath('/examples/'), false);
  assert.equal(isExamplePath('/'), false);
});

test('getPathAfterUrlDrivenLaunch drops example and share params so a reload can restore the draft', () => {
  assert.equal(getPathAfterUrlDrivenLaunch({ pathname: '/', search: '?example=equipment-purchase' }), '/');
  assert.equal(getPathAfterUrlDrivenLaunch({ pathname: '/examples/equipment-purchase', search: '' }), '/');
  assert.equal(getPathAfterUrlDrivenLaunch({ pathname: '/', search: '?initial=7777&project=Shared%20Link' }), '/');
  assert.equal(getPathAfterUrlDrivenLaunch({ pathname: '/examples', search: '' }), '/examples');
  assert.equal(getPathAfterUrlDrivenLaunch({ pathname: '/pricing', search: '' }), '/pricing');
});

test('createDefaultWorkingModel returns a fresh ad-hoc scratch model', () => {
  const first = createDefaultWorkingModel();
  const second = createDefaultWorkingModel();

  assert.deepEqual(first, {
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
  });
  first.cashflows.push(999);
  assert.deepEqual(second.cashflows, [200, 300, 400, 500, 600]);
});

test('writing the default working model can be read back as a scratch draft', () => {
  setupStorage();
  writeWorkingDraft(createDefaultWorkingModel());

  const restored = readWorkingDraft();
  assert.equal(restored.initial, 1000);
  assert.deepEqual(restored.cashflows, [200, 300, 400, 500, 600]);
  assert.equal(restored.loadedProjectSource, 'scratch');
  assert.equal(restored.projectName, '');
});
