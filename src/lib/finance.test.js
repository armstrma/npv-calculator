import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateNPV, findIRR, calculatePayback, calculateROI, calculatePI } from './finance.js';

test('calculateNPV returns expected positive NPV', () => {
  const result = calculateNPV(1000, 10, [400, 400, 400]);
  assert.ok(Math.abs(result - (-5.2592)) < 0.05);
});

test('findIRR approximates zero-NPV rate', () => {
  const irr = findIRR(1000, [500, 500, 500]);
  assert.ok(irr > 20 && irr < 25);
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
