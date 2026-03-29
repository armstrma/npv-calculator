import test from 'node:test';
import assert from 'node:assert/strict';
import { formatNumberWithCommas, sanitizeNumericDraft, parseNumericInput } from './input.js';

test('formatNumberWithCommas preserves decimals up to four places', () => {
  assert.equal(formatNumberWithCommas(1234.5678), '1,234.5678');
});

test('sanitizeNumericDraft keeps one leading minus and one decimal point', () => {
  assert.equal(sanitizeNumericDraft('--12.3.4abc'), '-12.34');
});

test('parseNumericInput parses valid decimal strings', () => {
  assert.equal(parseNumericInput('1,234.5'), 1234.5);
});

test('parseNumericInput returns null for incomplete drafts', () => {
  assert.equal(parseNumericInput('12.'), 12);
  assert.equal(parseNumericInput('.'), null);
  assert.equal(parseNumericInput('-'), null);
});
