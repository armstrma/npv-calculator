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
const IRR_TOLERANCE = 0.000001;
const NPV_TOLERANCE = 0.01;

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

const bisectIrrRoot = (init, cfs, low, high) => {
  let lowRate = low;
  let highRate = high;
  let lowNpv = calculateNPV(init, lowRate, cfs);
  let mid = (lowRate + highRate) / 2;

  for (let i = 0; i < 120; i++) {
    mid = (lowRate + highRate) / 2;
    const midNpv = calculateNPV(init, mid, cfs);
    if (Math.abs(midNpv) < NPV_TOLERANCE || Math.abs(highRate - lowRate) < IRR_TOLERANCE) return mid;

    if (Math.sign(lowNpv) === Math.sign(midNpv)) {
      lowRate = mid;
      lowNpv = midNpv;
    } else {
      highRate = mid;
    }
  }

  return mid;
};

const dedupeRoots = (roots) => roots
  .sort((a, b) => a - b)
  .filter((root, index, sortedRoots) => index === 0 || Math.abs(root - sortedRoots[index - 1]) > 0.01);

export const analyzeIRR = (init, cfs) => {
  const signChanges = countCashflowSignChanges(init, cfs);
  const roots = [];
  const step = (IRR_MAX_RATE - IRR_MIN_RATE) / IRR_SCAN_STEPS;
  let previousRate = IRR_MIN_RATE;
  let previousNpv = calculateNPV(init, previousRate, cfs);
  const minRateNpv = previousNpv;

  if (Math.abs(previousNpv) < NPV_TOLERANCE) roots.push(previousRate);

  for (let i = 1; i <= IRR_SCAN_STEPS; i++) {
    const rate = IRR_MIN_RATE + step * i;
    const npv = calculateNPV(init, rate, cfs);

    if (Math.abs(npv) < NPV_TOLERANCE) {
      roots.push(rate);
    } else if (Number.isFinite(previousNpv) && Number.isFinite(npv) && Math.sign(previousNpv) !== Math.sign(npv)) {
      roots.push(bisectIrrRoot(init, cfs, previousRate, rate));
    }

    previousRate = rate;
    previousNpv = npv;
  }

  const uniqueRoots = dedupeRoots(roots);
  if (signChanges === 1 && uniqueRoots.length === 0 && previousNpv > 0) {
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
