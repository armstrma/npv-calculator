import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeIRR, calculateNPV, findIRR, calculatePayback, calculateROI, calculatePI } from './finance.js';

test('calculateNPV returns expected positive NPV', () => {
  const result = calculateNPV(1000, 10, [400, 400, 400]);
  assert.ok(Math.abs(result - (-5.2592)) < 0.05);
});

test('findIRR approximates zero-NPV rate', () => {
  const irr = findIRR(1000, [500, 500, 500]);
  assert.ok(irr > 20 && irr < 25);
});

test('findIRR returns NaN when no valid IRR root is bracketed', () => {
  const irr = findIRR(1000, [-100, -100]);
  const analysis = analyzeIRR(1000, [-100, -100]);

  assert.ok(Number.isNaN(irr));
  assert.equal(analysis.status, 'none');
  assert.deepEqual(analysis.roots, []);
});

test('analyzeIRR marks multiple-root cash flows as ambiguous', () => {
  const analysis = analyzeIRR(1000, [2300, -1320]);

  assert.equal(analysis.status, 'ambiguous');
  assert.equal(analysis.roots.length, 2);
  assert.ok(analysis.roots.some((root) => Math.abs(root - 10) < 0.05));
  assert.ok(analysis.roots.some((root) => Math.abs(root - 20) < 0.05));
});

test('analyzeIRR marks very high conventional IRR as above range', () => {
  const analysis = analyzeIRR(1000, [10000, 10000]);

  assert.equal(analysis.status, 'above-range');
  assert.equal(analysis.value, null);
  assert.deepEqual(analysis.roots, []);
});

test('analyzeIRR marks positive zero-investment projects as not applicable', () => {
  const analysis = analyzeIRR(0, [100, 200]);

  assert.equal(analysis.status, 'not-applicable');
  assert.equal(analysis.value, null);
  assert.deepEqual(analysis.roots, []);
});

test('calculatePayback uses discounted cash flows and returns fractional year', () => {
  const payback = calculatePayback(1000, 10, [600, 600]);
  assert.equal(payback, 1.9);
});

test('calculatePayback returns N/A when investment never recovers', () => {
  const payback = calculatePayback(1000, 10, [100, 100, 100]);
  assert.equal(payback, 'N/A');
});

test('calculateROI handles zero initial investment', () => {
  assert.equal(calculateROI(0, [100, 200]), 0);
});

test('calculatePI handles zero initial investment', () => {
  assert.equal(calculatePI(100, 0), 0);
});
