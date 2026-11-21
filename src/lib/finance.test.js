import test from 'node:test';
import assert from 'node:assert/strict';
import { annualToPeriodRate } from './calculation.js';
import { analyzeIRR, calculateNPV, findIRR, calculatePayback, calculateROI, calculatePI } from './finance.js';

test('calculateNPV returns expected positive NPV', () => {
  const result = calculateNPV(1000, 10, [400, 400, 400]);
  assert.ok(Math.abs(result - (-5.2592)) < 0.05);
});

test('calculateNPV can use converted annual rate for monthly cash flows', () => {
  const monthlyRate = annualToPeriodRate(12, 'months');
  const result = calculateNPV(1000, monthlyRate, [100, 100, 100]);

  assert.ok(Math.abs(result - (-705.6045)) < 0.05);
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

const near = (actual, expected, tolerance = 1e-6) => {
  assert.ok(Math.abs(actual - expected) <= tolerance, `expected ${actual} to be within ${tolerance} of ${expected}`);
};

const assertValidIrr = (init, cfs, expected, tolerance = 1e-6) => {
  const analysis = analyzeIRR(init, cfs);
  assert.equal(analysis.status, 'valid', `expected valid IRR for ${init} / ${cfs.join(',')}, got ${analysis.status} ${analysis.roots.join(',')}`);
  assert.equal(analysis.roots.length, 1);
  near(analysis.value, expected, tolerance);
  near(analysis.roots[0], expected, tolerance);
  return analysis;
};

const scale = (value, factor) => value * factor;

test('analyzeIRR finds a single exact IRR for small-unit cash flows', () => {
  assertValidIrr(1, [1.1], 10);
  assertValidIrr(2.5, [1, 1, 1], 9.70102574, 1e-6);
  assertValidIrr(10, [11], 10);
  assertValidIrr(100, [110], 10);
  assertValidIrr(0.001, [0.0011], 10);
});

test('analyzeIRR ignores trailing zero cash flows', () => {
  assertValidIrr(1, [1.1, 0, 0, 0, 0], 10);
  assertValidIrr(2.5, [1, 1, 1, 0, 0], 9.70102574, 1e-6);
});

test('analyzeIRR gives the same answer at any unit scale', () => {
  const cases = [
    [1, [1.1]],
    [2.5, [1, 1, 1]],
    [1000, [500, 500, 500]],
    [1, [2.3, -1.32]],
    [1, [5, -6]],
    [100, [-50, 200]],
    [1, [2.2, -1.21]],
    [1000, [-100, -100]],
    [1, [3.9]],
  ];
  cases.forEach(([init, cfs]) => {
    const base = analyzeIRR(init, cfs);
    [0.001, 1000, 1e6].forEach((factor) => {
      const scaled = analyzeIRR(scale(init, factor), cfs.map((cf) => scale(cf, factor)));
      assert.equal(scaled.status, base.status, `status changed at x${factor} for ${init} / ${cfs.join(',')}`);
      assert.equal(scaled.roots.length, base.roots.length, `root count changed at x${factor} for ${init} / ${cfs.join(',')}`);
      scaled.roots.forEach((root, index) => near(root, base.roots[index], 1e-6));
    });
  });
});

test('analyzeIRR keeps precise multiple roots for genuine multi-root cash flows', () => {
  [[1000, [2300, -1320]], [100, [230, -132]], [1, [2.3, -1.32]]].forEach(([init, cfs]) => {
    const analysis = analyzeIRR(init, cfs);
    assert.equal(analysis.status, 'ambiguous');
    assert.equal(analysis.value, null);
    assert.equal(analysis.roots.length, 2);
    near(analysis.roots[0], 10);
    near(analysis.roots[1], 20);
  });
});

test('analyzeIRR finds roots at the top edge of the supported range', () => {
  // -1 + 5x - 6x^2 = -(2x - 1)(3x - 1): IRRs of 100% and exactly 200%.
  const analysis = analyzeIRR(1, [5, -6]);
  assert.equal(analysis.status, 'ambiguous');
  assert.equal(analysis.roots.length, 2);
  near(analysis.roots[0], 100);
  near(analysis.roots[1], 200);
});

test('analyzeIRR separates close but distinct roots inside one scan step', () => {
  // (1.1x - 1)(1.101x - 1): IRRs of 10% and 10.1%.
  const analysis = analyzeIRR(1, [2.201, -1.2111]);
  assert.equal(analysis.status, 'ambiguous');
  assert.equal(analysis.roots.length, 2);
  near(analysis.roots[0], 10);
  near(analysis.roots[1], 10.1);
});

test('analyzeIRR finds three roots when cash flows change sign three times', () => {
  // -(1.1x - 1)(1.2x - 1)(1.3x - 1): IRRs of 10%, 20%, and 30%.
  const analysis = analyzeIRR(1, [3.6, -4.31, 1.716]);
  assert.equal(analysis.status, 'ambiguous');
  assert.equal(analysis.roots.length, 3);
  near(analysis.roots[0], 10);
  near(analysis.roots[1], 20);
  near(analysis.roots[2], 30);
});

test('analyzeIRR reports a single crossing root as valid even with several sign changes', () => {
  assertValidIrr(100, [-50, 200], 18.61406616, 1e-6);
});

test('analyzeIRR flags a tangent (touching) root as ambiguous with one root', () => {
  // -1 + 2.2x - 1.21x^2 = -(1.1x - 1)^2: NPV touches zero at 10% but never turns positive.
  const analysis = analyzeIRR(1, [2.2, -1.21]);
  assert.equal(analysis.status, 'ambiguous');
  assert.equal(analysis.value, null);
  assert.equal(analysis.roots.length, 1);
  near(analysis.roots[0], 10, 1e-4);
  assert.match(analysis.reason, /touches zero at 10\.00%/);
});

test('analyzeIRR does not invent roots when NPV approaches zero without reaching it', () => {
  const nearMiss = analyzeIRR(1, [2.2, -1.2100001]);
  assert.equal(nearMiss.status, 'none');
  assert.deepEqual(nearMiss.roots, []);

  const justCrossing = analyzeIRR(1, [2.2, -1.2099999]);
  assert.equal(justCrossing.status, 'ambiguous');
  assert.equal(justCrossing.roots.length, 2);
});

test('analyzeIRR handles conventional IRRs near both range edges', () => {
  assertValidIrr(1, [0.002], -99.8);
  assertValidIrr(1, [2.999], 199.9);

  const below = analyzeIRR(1, [0.0001]);
  assert.equal(below.status, 'below-range');
  assert.deepEqual(below.roots, []);

  const above = analyzeIRR(1, [3.9]);
  assert.equal(above.status, 'above-range');
  assert.deepEqual(above.roots, []);
});

test('analyzeIRR returns none when cash flows never change sign', () => {
  const allNegative = analyzeIRR(1, [-0.1, -0.1]);
  assert.equal(allNegative.status, 'none');
  assert.deepEqual(allNegative.roots, []);
  assert.equal(allNegative.signChanges, 0);
});

test('findIRR matches the refined valid root', () => {
  near(findIRR(1, [1.1]), 10);
  near(findIRR(1000, [500, 500, 500]), 23.37519285, 1e-6);
  near(calculateNPV(1000, findIRR(1000, [500, 500, 500]), [500, 500, 500]), 0, 1e-8);
  assert.ok(Number.isNaN(findIRR(1, [2.3, -1.32])));
});

test('NPV and payback are unchanged for small-unit inputs', () => {
  near(calculateNPV(1, 10, [1.1]), 0, 1e-12);
  near(calculateNPV(2.5, 10, [1, 1, 1]), -0.0131480090, 1e-9);
  assert.equal(calculatePayback(1, 0, [1.1]), 0.9);
  assert.equal(calculatePayback(2.5, 0, [1, 1, 1]), 2.5);
  assert.equal(calculatePayback(1, 10, [1.1]), 1);
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
