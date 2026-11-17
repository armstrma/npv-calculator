import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PREVIEW_CLOUD_STORAGE_KEY,
  PREVIEW_PRO_STORAGE_KEY,
  PREVIEW_TEST_MODE,
  clearPreviewCloudProjects,
  deletePreviewCloudProject,
  getPreviewEntitlement,
  getPreviewSession,
  isPreviewTestModeFlag,
  listPreviewCloudProjects,
  readPreviewProEnabled,
  upsertPreviewCloudProject,
  writePreviewProEnabled,
} from './previewTestMode.js';

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
  globalThis.window = { localStorage };
  return localStorage;
};

test('preview test mode flag is only true for the boolean or string true', () => {
  assert.equal(isPreviewTestModeFlag('true'), true);
  assert.equal(isPreviewTestModeFlag(true), true);
  assert.equal(isPreviewTestModeFlag('false'), false);
  assert.equal(isPreviewTestModeFlag(''), false);
  assert.equal(isPreviewTestModeFlag(undefined), false);
  assert.equal(isPreviewTestModeFlag('1'), false);
  assert.equal(PREVIEW_TEST_MODE, false);
});

test('preview cloud store lists, upserts by name, and deletes locally', () => {
  setupStorage();
  const first = { initial: 1000, discount: 10, cashflows: [200] };

  assert.deepEqual(listPreviewCloudProjects(), {});
  assert.deepEqual(upsertPreviewCloudProject({ name: 'Alpha', project: first }), {
    Alpha: { ...first, updatedAt: listPreviewCloudProjects().Alpha.updatedAt },
  });

  const listed = listPreviewCloudProjects();
  assert.equal(listed.Alpha.initial, 1000);
  assert.ok(listed.Alpha.updatedAt);

  const updated = upsertPreviewCloudProject({ name: 'Alpha', project: { ...first, initial: 2500 } });
  assert.equal(updated.Alpha.initial, 2500);
  assert.equal(listPreviewCloudProjects().Alpha.initial, 2500);
  assert.deepEqual(Object.keys(listPreviewCloudProjects()), ['Alpha']);

  upsertPreviewCloudProject({ name: 'Beta', project: first });
  assert.deepEqual(Object.keys(listPreviewCloudProjects()).sort(), ['Alpha', 'Beta']);

  deletePreviewCloudProject({ name: 'Alpha' });
  assert.deepEqual(Object.keys(listPreviewCloudProjects()), ['Beta']);

  clearPreviewCloudProjects();
  assert.deepEqual(listPreviewCloudProjects(), {});
});

test('preview Pro toggle is stored separately from cloud projects', () => {
  const localStorage = setupStorage();

  assert.equal(readPreviewProEnabled(), false);
  assert.deepEqual(getPreviewEntitlement(), { hasPro: false, source: 'preview-test' });

  writePreviewProEnabled(true);
  assert.equal(localStorage.getItem(PREVIEW_PRO_STORAGE_KEY), 'true');
  assert.equal(readPreviewProEnabled(), true);
  assert.deepEqual(getPreviewEntitlement(), { hasPro: true, source: 'preview-test' });

  writePreviewProEnabled(false);
  assert.equal(readPreviewProEnabled(), false);
  assert.equal(localStorage.getItem(PREVIEW_CLOUD_STORAGE_KEY), null);
});

test('preview session is a clearly fake token and does not look like a JWT', () => {
  const session = getPreviewSession();
  assert.equal(session.accessToken, 'preview-test-mode');
  assert.equal(session.previewTestMode, true);
  assert.equal(session.accessToken.includes('.'), false);
  assert.ok(session.expiresAt > Date.now());
});
