import assert from 'node:assert/strict';
import test from 'node:test';
import { FREE_TIER_LIMITS } from './entitlementAccess.js';
import {
  CLOUD_PROJECT_LIMIT_ERROR,
  CLOUD_PROJECT_LIMIT_MESSAGE,
  createCloudWriteError,
  isCloudProjectLimitError,
} from './cloudProjects.js';

test('the SQL free cloud project limit stays in sync with the app limit', () => {
  assert.equal(FREE_TIER_LIMITS.maxCloudProjects, 1);
  assert.match(CLOUD_PROJECT_LIMIT_MESSAGE, /cloud projects/i);
});

test('isCloudProjectLimitError detects PostgREST raise_exception payloads', () => {
  const body = JSON.stringify({
    code: 'P0001',
    message: 'cloud_project_limit_reached',
    hint: 'Upgrade to Pro to save more cloud projects.',
  });

  assert.equal(isCloudProjectLimitError(null), false);
  assert.equal(isCloudProjectLimitError(new Error('Unable to save cloud project.')), false);
  assert.equal(isCloudProjectLimitError(body), true);
  assert.equal(isCloudProjectLimitError(new Error(body)), true);
  assert.equal(isCloudProjectLimitError({ code: CLOUD_PROJECT_LIMIT_ERROR, message: 'nope' }), true);
  assert.equal(isCloudProjectLimitError({ message: 'something cloud_project_limit_reached in text' }), true);
  assert.equal(isCloudProjectLimitError(JSON.stringify({ code: '42501', message: 'new row violates row-level security policy' })), false);
});

test('createCloudWriteError tags PostgREST limit rejections so the app can show an upgrade prompt', () => {
  const body = JSON.stringify({
    code: 'P0001',
    message: CLOUD_PROJECT_LIMIT_ERROR,
    hint: 'Upgrade to Pro to save more cloud projects.',
  });
  const error = createCloudWriteError(body, 'Unable to save cloud project.');
  assert.equal(error.code, CLOUD_PROJECT_LIMIT_ERROR);
  assert.equal(isCloudProjectLimitError(error), true);

  const generic = createCloudWriteError('{"code":"42501","message":"new row violates row-level security policy"}', 'Unable to save cloud project.');
  assert.equal(generic.code, undefined);
  assert.equal(isCloudProjectLimitError(generic), false);
});
