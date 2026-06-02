import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateNumericExpression, formatNumberWithCommas, hasArithmeticOperator, sanitizeNumericDraft, parseNumericInput } from './input.js';

test('formatNumberWithCommas preserves decimals up to four places', () => {
  assert.equal(formatNumberWithCommas(1234.5678), '1,234.5678');
});

test('sanitizeNumericDraft keeps one leading minus and one decimal point', () => {
  assert.equal(sanitizeNumericDraft('--12.3.4abc'), '-12.34');
});

test('parseNumericInput parses valid decimal strings', () => {
  assert.equal(parseNumericInput('1,234.5'), 1234.5);
});

test('evaluateNumericExpression supports basic arithmetic operations', () => {
  assert.equal(evaluateNumericExpression('30,000-10,000'), 20000);
  assert.equal(evaluateNumericExpression('2,000+500*3'), 3500);
  assert.equal(evaluateNumericExpression('10,000/4'), 2500);
  assert.equal(evaluateNumericExpression('12×3'), 36);
  assert.equal(evaluateNumericExpression('12÷3'), 4);
});

test('parseNumericInput evaluates arithmetic expressions', () => {
  assert.equal(parseNumericInput('30,000-10,000'), 20000);
});

test('evaluateNumericExpression returns null for incomplete or invalid arithmetic', () => {
  assert.equal(evaluateNumericExpression('1000-'), null);
  assert.equal(evaluateNumericExpression('1000/0'), null);
  assert.equal(evaluateNumericExpression('1000(foo)'), null);
});

test('hasArithmeticOperator detects expressions without treating leading minus as an operation', () => {
  assert.equal(hasArithmeticOperator('30,000-10,000'), true);
  assert.equal(hasArithmeticOperator('2000*3'), true);
  assert.equal(hasArithmeticOperator('12×3'), true);
  assert.equal(hasArithmeticOperator('-1000'), false);
});

test('parseNumericInput returns null for incomplete drafts', () => {
  assert.equal(parseNumericInput('12.'), 12);
  assert.equal(parseNumericInput('.'), null);
  assert.equal(parseNumericInput('-'), null);
});
