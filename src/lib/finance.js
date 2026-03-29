export const calculateNPV = (init, disc, cfs) => {
  const rate = disc / 100;
  let npv = -init;
  cfs.forEach((cf, index) => {
    npv += cf / Math.pow(1 + rate, index + 1);
  });
  return npv;
};

export const findIRR = (init, cfs) => {
  let low = -99.9;
  let high = 200;
  let mid = 0;
  let npvMid = 0;

  for (let i = 0; i < 120; i++) {
    mid = (low + high) / 2;
    npvMid = calculateNPV(init, mid, cfs);
    if (npvMid > 0) low = mid;
    else high = mid;
    if (Math.abs(npvMid) < 0.01) return mid;
  }

  return mid;
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
