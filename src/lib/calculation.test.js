import test from 'node:test';
import assert from 'node:assert/strict';
import {
  annualToPeriodRate,
  convertIrrAnalysisRateBasis,
  getAppliedRate,
  getRateBasisLabel,
  sanitizeProjectSnapshot,
} from './calculation.js';

test('annualToPeriodRate converts annual rates to monthly and quarterly period rates', () => {
  assert.ok(Math.abs(annualToPeriodRate(10, 'months') - 0.797414) < 0.0001);
  assert.ok(Math.abs(annualToPeriodRate(10, 'quarters') - 2.411369) < 0.0001);
  assert.equal(annualToPeriodRate(10, 'years'), 10);
});

test('getAppliedRate defaults to annual input and supports per-period projects', () => {
  assert.ok(Math.abs(getAppliedRate(12, 'months') - 0.948879) < 0.0001);
  assert.equal(getAppliedRate(12, 'months', 'per-period'), 12);
});

test('convertIrrAnalysisRateBasis annualizes period IRR roots for non-year cash flows', () => {
  const converted = convertIrrAnalysisRateBasis({
    status: 'valid',
    value: 10,
    roots: [10],
    signChanges: 1,
    reason: '',
  }, 'months');

  assert.ok(Math.abs(converted.value - 213.842838) < 0.0001);
  assert.ok(Math.abs(converted.roots[0] - 213.842838) < 0.0001);
});

test('rate basis labels describe annual and per-period application', () => {
  assert.equal(getRateBasisLabel('months'), 'Applied monthly');
  assert.equal(getRateBasisLabel('quarters'), 'Applied quarterly');
  assert.equal(getRateBasisLabel('years'), 'Applied annually');
});

test('sanitizeProjectSnapshot persists annual rate basis by default', () => {
  assert.equal(sanitizeProjectSnapshot({ cashflows: [1] }).rateBasis, 'annual');
  assert.equal(sanitizeProjectSnapshot({ cashflows: [1], rateBasis: 'per-period' }).rateBasis, 'per-period');
});
