export const calculateNPV = (init, disc, cfs) => {
  const rate = disc / 100;
  let npv = -init;
  cfs.forEach((cf, index) => {
    npv += cf / Math.pow(1 + rate, index + 1);
  });
  return npv;
};

const IRR_MIN_RATE = -99.9;
const IRR_MAX_RATE = 200;
const IRR_SCAN_STEPS = 1200;
// Roots are refined until the bracket is narrower than this many percentage points.
const IRR_RATE_TOLERANCE = 1e-10;
// Two roots closer than this (in percentage points) are treated as the same root.
const IRR_DEDUPE_TOLERANCE = 1e-6;
// NPV counts as "zero" only relative to the size of the discounted cash flows at
// that rate, so the check behaves the same whether inputs are in dollars or millions.
const IRR_RELATIVE_NPV_TOLERANCE = 1e-9;
const GOLDEN_RATIO = (Math.sqrt(5) - 1) / 2;

const signOfCashflow = (value) => {
  if (value > 0) return 1;
  if (value < 0) return -1;
  return 0;
};

export const countCashflowSignChanges = (init, cfs) => {
  const signs = [-init, ...cfs].map(signOfCashflow).filter((sign) => sign !== 0);
  return signs.reduce((count, sign, index) => {
    if (index === 0) return count;
    return sign !== signs[index - 1] ? count + 1 : count;
  }, 0);
};

// Sum of the absolute discounted cash flows at a rate: the natural scale for NPV there.
const discountedCashflowScale = (init, disc, cfs) => {
  const rate = disc / 100;
  let scale = Math.abs(init);
  cfs.forEach((cf, index) => {
    scale += Math.abs(cf) / Math.pow(1 + rate, index + 1);
  });
  return scale;
};

const isNpvNearZero = (init, rate, cfs, npv) => {
  if (npv === 0) return true;
  const scale = discountedCashflowScale(init, rate, cfs);
  return Number.isFinite(scale) && scale > 0 && Math.abs(npv) <= scale * IRR_RELATIVE_NPV_TOLERANCE;
};

// Bisection on a bracket whose endpoints have strictly opposite NPV signs.
const bisectIrrRoot = (init, cfs, low, high) => {
  let lowRate = low;
  let highRate = high;
  let lowNpv = calculateNPV(init, lowRate, cfs);

  for (let i = 0; i < 200 && highRate - lowRate > IRR_RATE_TOLERANCE; i++) {
    const mid = (lowRate + highRate) / 2;
    const midNpv = calculateNPV(init, mid, cfs);
    if (midNpv === 0) return mid;

    if (Math.sign(lowNpv) === Math.sign(midNpv)) {
      lowRate = mid;
      lowNpv = midNpv;
    } else {
      highRate = mid;
    }
  }

  return (lowRate + highRate) / 2;
};

// Golden-section search for the rate where sign * NPV is smallest in [low, high].
const minimizeSignedNpv = (init, cfs, low, high, sign) => {
  let a = low;
  let b = high;
  const f = (rate) => sign * calculateNPV(init, rate, cfs);
  let c = b - GOLDEN_RATIO * (b - a);
  let d = a + GOLDEN_RATIO * (b - a);
  let fc = f(c);
  let fd = f(d);

  for (let i = 0; i < 200 && b - a > IRR_RATE_TOLERANCE; i++) {
    if (fc < fd) {
      b = d;
      d = c;
      fd = fc;
      c = b - GOLDEN_RATIO * (b - a);
      fc = f(c);
    } else {
      a = c;
      c = d;
      fc = fd;
      d = a + GOLDEN_RATIO * (b - a);
      fd = f(d);
    }
  }

  const rate = (a + b) / 2;
  return { rate, npv: calculateNPV(init, rate, cfs) };
};

const dedupeRoots = (roots) => roots
  .sort((a, b) => a - b)
  .filter((root, index, sortedRoots) => index === 0 || Math.abs(root - sortedRoots[index - 1]) > IRR_DEDUPE_TOLERANCE);

const scanRateAt = (index) => (index === IRR_SCAN_STEPS
  ? IRR_MAX_RATE
  : IRR_MIN_RATE + ((IRR_MAX_RATE - IRR_MIN_RATE) / IRR_SCAN_STEPS) * index);

// Finds every distinct rate in [IRR_MIN_RATE, IRR_MAX_RATE] where NPV is zero.
// Crossing roots are found from sign changes between grid points and refined by
// bisection. Touching (tangent) roots and pairs of roots too close together to
// straddle a grid point are found by refining each local minimum of |NPV|.
// Returns { roots, tangentRoots }.
const findIrrRoots = (init, cfs) => {
  const rates = [];
  const npvs = [];
  for (let i = 0; i <= IRR_SCAN_STEPS; i++) {
    const rate = scanRateAt(i);
    rates.push(rate);
    npvs.push(calculateNPV(init, rate, cfs));
  }

  const roots = [];
  const tangentRoots = [];

  // Exact or scale-relative zeros at the range edges.
  [0, IRR_SCAN_STEPS].forEach((index) => {
    if (Number.isFinite(npvs[index]) && isNpvNearZero(init, rates[index], cfs, npvs[index])) roots.push(rates[index]);
  });

  for (let i = 1; i <= IRR_SCAN_STEPS; i++) {
    const previousNpv = npvs[i - 1];
    const npv = npvs[i];
    if (!Number.isFinite(previousNpv) || !Number.isFinite(npv)) continue;

    if (npv === 0) {
      roots.push(rates[i]);
    } else if (previousNpv !== 0 && Math.sign(previousNpv) !== Math.sign(npv)) {
      roots.push(bisectIrrRoot(init, cfs, rates[i - 1], rates[i]));
    }
  }

  for (let i = 1; i < IRR_SCAN_STEPS; i++) {
    const [left, middle, right] = [npvs[i - 1], npvs[i], npvs[i + 1]];
    if (![left, middle, right].every(Number.isFinite) || middle === 0) continue;
    const sign = Math.sign(middle);
    // Only same-sign neighborhoods: crossings were already handled above.
    if (Math.sign(left) !== sign || Math.sign(right) !== sign) continue;
    if (Math.abs(middle) > Math.abs(left) || Math.abs(middle) > Math.abs(right)) continue;

    const minimum = minimizeSignedNpv(init, cfs, rates[i - 1], rates[i + 1], sign);
    if (isNpvNearZero(init, minimum.rate, cfs, minimum.npv)) {
      // NPV touches zero without crossing it: a double (tangent) root.
      roots.push(minimum.rate);
      tangentRoots.push(minimum.rate);
    } else if (Math.sign(minimum.npv) !== sign) {
      // NPV dips across zero and back between grid points: two close crossing roots.
      roots.push(bisectIrrRoot(init, cfs, rates[i - 1], minimum.rate));
      roots.push(bisectIrrRoot(init, cfs, minimum.rate, rates[i + 1]));
    }
  }

  const uniqueRoots = dedupeRoots(roots);
  const uniqueTangentRoots = uniqueRoots.filter((root) => tangentRoots.some((tangent) => Math.abs(tangent - root) <= IRR_DEDUPE_TOLERANCE));
  return { roots: uniqueRoots, tangentRoots: uniqueTangentRoots, minRateNpv: npvs[0], maxRateNpv: npvs[IRR_SCAN_STEPS] };
};

export const analyzeIRR = (init, cfs) => {
  const signChanges = countCashflowSignChanges(init, cfs);
  const npvAtActiveZeroRate = calculateNPV(init, 0, cfs);

  if (init === 0 && npvAtActiveZeroRate > 0) {
    return {
      status: 'not-applicable',
      value: null,
      roots: [],
      signChanges,
      reason: 'IRR is not meaningful when the upfront investment is zero, but the project creates positive value.',
    };
  }

  const { roots: uniqueRoots, tangentRoots, minRateNpv, maxRateNpv } = signChanges === 0
    ? { roots: [], tangentRoots: [], minRateNpv: Number.NaN, maxRateNpv: Number.NaN }
    : findIrrRoots(init, cfs);

  if (signChanges === 1 && uniqueRoots.length === 0 && maxRateNpv > 0) {
    return {
      status: 'above-range',
      value: null,
      roots: [],
      signChanges,
      bound: IRR_MAX_RATE,
      reason: `IRR is above ${IRR_MAX_RATE}%, outside the chart range.`,
    };
  }

  if (signChanges === 1 && uniqueRoots.length === 0 && minRateNpv < 0) {
    return {
      status: 'below-range',
      value: null,
      roots: [],
      signChanges,
      bound: IRR_MIN_RATE,
      reason: `IRR is below ${IRR_MIN_RATE}%, outside the supported range.`,
    };
  }

  if (signChanges === 0 || uniqueRoots.length === 0) {
    return {
      status: 'none',
      value: null,
      roots: uniqueRoots,
      signChanges,
      reason: 'No discount rate in the supported range makes NPV equal zero.',
    };
  }

  if (uniqueRoots.length > 1) {
    return {
      status: 'ambiguous',
      value: null,
      roots: uniqueRoots,
      signChanges,
      reason: 'The cash-flow pattern changes signs more than once, so IRR may have multiple roots and no single reliable readout.',
    };
  }

  if (tangentRoots.length > 0) {
    // NPV only touches zero here and has the same sign on both sides, so
    // "accept when IRR beats the discount rate" would give the wrong answer.
    return {
      status: 'ambiguous',
      value: null,
      roots: uniqueRoots,
      signChanges,
      reason: `NPV touches zero at ${uniqueRoots[0].toFixed(2)}% without crossing it, so this IRR does not separate accept from reject and IRR-based rules are marked N/A.`,
    };
  }

  return {
    status: 'valid',
    value: uniqueRoots[0],
    roots: uniqueRoots,
    signChanges,
    reason: '',
  };
};

export const findIRR = (init, cfs) => {
  const analysis = analyzeIRR(init, cfs);
  return analysis.status === 'valid' ? analysis.value : Number.NaN;
};

export const calculatePayback = (init, disc, cfs) => {
  const rate = disc / 100;
  let cumulative = -init;

  for (let i = 0; i < cfs.length; i++) {
    const discountedCashflow = cfs[i] / Math.pow(1 + rate, i + 1);
    const previousCumulative = cumulative;
    cumulative += discountedCashflow;

    if (cumulative >= 0) {
      if (discountedCashflow === 0) return i + 1;
      const fractionOfYear = Math.abs(previousCumulative) / discountedCashflow;
      return i + Number(Math.min(Math.max(fractionOfYear, 0), 1).toFixed(1));
    }
  }

  return 'N/A';
};

export const calculateROI = (init, cfs) => {
  if (init === 0) return 0;
  const totalGain = cfs.reduce((a, b) => a + b, 0) - init;
  return (totalGain / init) * 100;
};

export const calculatePI = (npvVal, init) => {
  if (init === 0) return 0;
  return npvVal / init + 1;
};
