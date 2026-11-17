import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isPreviewDeploy,
  isProtectedDeploy,
  matchesPullRequest,
  selectDeploysToDelete,
  selectLatestPreview,
} from './netlify-preview-cleanup.js';

const publishedId = 'prod-current';

const production = {
  id: publishedId,
  context: 'production',
  published_at: '2026-11-13T20:00:00.000Z',
  state: 'ready',
  created_at: '2026-11-13T20:00:00.000Z',
  title: 'main@d404759',
};

const branchDeploy = {
  id: 'branch-1',
  context: 'branch-deploy',
  branch: 'feat/save-and-save-as',
  state: 'ready',
  created_at: '2026-11-15T21:00:00.000Z',
};

const lockedPreview = {
  id: 'locked-1',
  context: 'deploy-preview',
  review_id: 4,
  alias: 'pr-4',
  locked: true,
  state: 'ready',
  created_at: '2026-11-12T00:00:00.000Z',
};

const pr7old = {
  id: 'pr7-old',
  context: 'deploy-preview',
  alias: 'pr-7',
  title: 'PR #7',
  review_id: 7,
  branch: 'fix/example-shared-link-autosave',
  state: 'ready',
  created_at: '2026-11-13T18:00:00.000Z',
};

const pr8old = {
  id: 'pr8-old',
  context: null,
  alias: 'pr-8',
  title: 'PR #8',
  branch: 'feat/save-and-save-as',
  url: 'https://pr-8--npv-lab.netlify.app',
  state: 'ready',
  created_at: '2026-11-15T21:00:00.000Z',
};

const pr8latest = {
  id: 'pr8-latest',
  context: 'deploy-preview',
  alias: 'pr-8',
  title: 'PR #8',
  branch: 'feat/save-and-save-as',
  url: 'https://pr-8--npv-lab.netlify.app',
  state: 'ready',
  created_at: '2026-11-16T21:00:00.000Z',
};

test('production, locked, and branch deploys are protected, but published_at alone is not', () => {
  assert.equal(isProtectedDeploy(production, publishedId), true);
  assert.equal(isProtectedDeploy({ ...production, id: 'other-prod', context: 'production', published_at: '2026-11-01T00:00:00.000Z' }, publishedId), true);
  assert.equal(isProtectedDeploy({ ...pr8latest, published_at: '2026-11-15T21:00:00.000Z' }, publishedId), false);
  assert.equal(isProtectedDeploy(branchDeploy, publishedId), true);
  assert.equal(isProtectedDeploy(lockedPreview, publishedId), true);
  assert.equal(isProtectedDeploy(pr8latest, publishedId), false);
});

test('CLI drafts without deploy-preview context still count as previews', () => {
  assert.equal(isPreviewDeploy({ ...pr8old, context: null, draft: true, alias: null, title: 'manual draft' }, publishedId), true);
});

test('CLI alias deploys count as previews even without context=deploy-preview', () => {
  assert.equal(isPreviewDeploy(pr8old, publishedId), true);
  assert.equal(isPreviewDeploy(pr8latest, publishedId), true);
  assert.equal(isPreviewDeploy(production, publishedId), false);
  assert.equal(isPreviewDeploy(branchDeploy, publishedId), false);
});

test('PR matching uses review_id, alias, title, URL, or preview branch', () => {
  assert.equal(matchesPullRequest(pr7old, { prNumber: 7 }), true);
  assert.equal(matchesPullRequest(pr8old, { prNumber: 8, branch: 'feat/save-and-save-as' }), true);
  assert.equal(matchesPullRequest(pr8latest, { prNumber: 7 }), false);
  assert.equal(matchesPullRequest({ id: 'x', branch: 'feat/save-and-save-as' }, { prNumber: 8, branch: 'feat/save-and-save-as' }), true);
});

test('closed-PR mode deletes only matching preview deploys', () => {
  const selected = selectDeploysToDelete(
    [production, branchDeploy, lockedPreview, pr7old, pr8old, pr8latest],
    { mode: 'pr', prNumber: 7, publishedDeployId: publishedId },
  );

  assert.deepEqual(selected.delete.map((deploy) => deploy.id), ['pr7-old']);
  assert.deepEqual(selected.keep.map((deploy) => deploy.id).sort(), ['pr8-latest', 'pr8-old']);
  assert.ok(selected.protected.some((deploy) => deploy.id === publishedId));
  assert.ok(selected.protected.some((deploy) => deploy.id === 'branch-1'));
});

test('all-except mode keeps only the latest preview for the chosen PR', () => {
  const selected = selectDeploysToDelete(
    [production, branchDeploy, lockedPreview, pr7old, pr8old, pr8latest],
    { mode: 'all-except', keepPr: 8, publishedDeployId: publishedId },
  );

  assert.equal(selectLatestPreview([pr8old, pr8latest]).id, 'pr8-latest');
  assert.deepEqual(selected.keep.map((deploy) => deploy.id), ['pr8-latest']);
  assert.deepEqual(selected.delete.map((deploy) => deploy.id).sort(), ['pr7-old', 'pr8-old']);
  assert.equal(selected.delete.some((deploy) => deploy.id === publishedId), false);
  assert.equal(selected.delete.some((deploy) => deploy.id === 'branch-1'), false);
  assert.equal(selected.delete.some((deploy) => deploy.id === 'locked-1'), false);
});

const cliPr8old = {
  id: 'cli-pr8-old',
  context: 'branch-deploy',
  alias: null,
  review_id: null,
  branch: 'pr-8',
  title: 'PR #8',
  state: 'ready',
  created_at: '2026-11-15T21:27:22.415Z',
  draft: false,
  locked: false,
  published_at: null,
};

const cliPr8latest = {
  id: 'cli-pr8-latest',
  context: 'branch-deploy',
  alias: null,
  review_id: null,
  branch: 'pr-8',
  title: 'PR #8',
  state: 'ready',
  created_at: '2026-11-17T05:36:09.529Z',
  draft: false,
  locked: false,
  published_at: null,
};

const cliPr7 = {
  id: 'cli-pr7',
  context: 'branch-deploy',
  alias: null,
  review_id: null,
  branch: 'pr-7',
  title: 'PR #7',
  state: 'ready',
  created_at: '2026-11-13T22:54:19.556Z',
  draft: false,
  locked: false,
  published_at: null,
};

test('CLI --alias pr-N deploys recorded as branch-deploy still count as previews', () => {
  assert.equal(isProtectedDeploy(cliPr8latest, publishedId), false);
  assert.equal(isPreviewDeploy(cliPr8latest, publishedId), true);
  assert.equal(isPreviewDeploy(cliPr7, publishedId), true);
  assert.equal(isProtectedDeploy(branchDeploy, publishedId), true);
  assert.equal(isPreviewDeploy(branchDeploy, publishedId), false);
  assert.equal(matchesPullRequest(cliPr8latest, { prNumber: 8 }), true);
  assert.equal(matchesPullRequest(cliPr7, { prNumber: 8 }), false);

  const selected = selectDeploysToDelete(
    [production, branchDeploy, cliPr7, cliPr8old, cliPr8latest],
    { mode: 'all-except', keepPr: 8, publishedDeployId: publishedId },
  );
  assert.deepEqual(selected.keep.map((deploy) => deploy.id), ['cli-pr8-latest']);
  assert.deepEqual(selected.delete.map((deploy) => deploy.id).sort(), ['cli-pr7', 'cli-pr8-old']);
  assert.equal(selected.delete.some((deploy) => deploy.id === publishedId), false);
  assert.equal(selected.delete.some((deploy) => deploy.id === 'branch-1'), false);
});
