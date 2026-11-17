import assert from 'node:assert/strict';
import test from 'node:test';
import { PROJECT_NAME_MAX_LENGTH } from './calculation.js';
import {
  TAKEN_PROJECT_NAME_MESSAGE,
  canDirectSave,
  getProjectNameConflict,
  isProjectNameTaken,
  suggestAvailableProjectName,
} from './projectSave.js';

test('direct Save is available only for a loaded local or cloud project', () => {
  assert.equal(canDirectSave('local', 'Alpha'), true);
  assert.equal(canDirectSave('cloud', 'Alpha'), true);
  assert.equal(canDirectSave('scratch', 'Alpha'), false);
  assert.equal(canDirectSave('example', 'Alpha'), false);
  assert.equal(canDirectSave('local', ''), false);
  assert.equal(canDirectSave('local', '   '), false);
  assert.equal(canDirectSave('shared', 'Alpha'), false);
});

test('name collision checks use the sanitized project name', () => {
  const projects = { Alpha: {}, 'Beta (2)': {} };

  assert.equal(isProjectNameTaken('Alpha', projects), true);
  assert.equal(isProjectNameTaken('  Alpha  ', projects), true);
  assert.equal(isProjectNameTaken('Gamma', projects), false);
  assert.equal(isProjectNameTaken('', projects), false);
});

test('suggests Name (2) and increments past existing copies', () => {
  const projects = { Alpha: {}, 'Alpha (2)': {}, 'Alpha (3)': {} };

  assert.equal(suggestAvailableProjectName('Alpha', projects), 'Alpha (4)');
  assert.equal(suggestAvailableProjectName('Alpha (2)', projects), 'Alpha (4)');
  assert.equal(suggestAvailableProjectName('Beta', projects), 'Beta');
  assert.equal(suggestAvailableProjectName('  ', projects), '');
});

test('suggested copy names stay within the project name length limit', () => {
  const stem = 'A'.repeat(PROJECT_NAME_MAX_LENGTH);
  const projects = { [stem]: {} };
  const suggestion = suggestAvailableProjectName(stem, projects);

  assert.ok(suggestion.endsWith(' (2)'));
  assert.ok(suggestion.length <= PROJECT_NAME_MAX_LENGTH);
  assert.equal(isProjectNameTaken(suggestion, projects), false);
});

test('conflict helper returns the inline message and a suggestion when a name is taken', () => {
  const projects = { Alpha: {} };
  const conflict = getProjectNameConflict('Alpha', projects);

  assert.deepEqual(conflict, {
    taken: true,
    suggestion: 'Alpha (2)',
    message: TAKEN_PROJECT_NAME_MESSAGE,
  });
  assert.deepEqual(getProjectNameConflict('Beta', projects), {
    taken: false,
    suggestion: '',
    message: '',
  });
});
