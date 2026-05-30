export const formatCompactCurrency = (value, currency = '$') => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return `${currency}0`;

  const absValue = Math.abs(numericValue);
  let divisor = 1;
  let suffix = '';

  if (absValue >= 1_000_000_000) {
    divisor = 1_000_000_000;
    suffix = 'b';
  } else if (absValue >= 1_000_000) {
    divisor = 1_000_000;
    suffix = 'm';
  } else if (absValue >= 1_000) {
    divisor = 1_000;
    suffix = 'k';
  }

  const shortValue = numericValue / divisor;
  const decimals = divisor === 1 ? 2 : absValue >= 100 * divisor ? 0 : absValue >= 10 * divisor ? 1 : 2;

  return `${currency}${shortValue.toFixed(decimals).replace(/\.0+$|(?<=\.[0-9])0+$/u, '')}${suffix}`;
};

export const getSpreadStatus = (spread) => {
  if (!Number.isFinite(spread) || spread < 0) {
    return {
      label: 'Fail',
      tone: 'negative',
      detail: 'IRR is below the active rate',
    };
  }

  if (spread < 2) {
    return {
      label: 'Thin',
      tone: 'caution',
      detail: 'IRR clears the active rate, but with only a slim spread',
    };
  }

  if (spread < 5) {
    return {
      label: 'Good',
      tone: 'caution',
      detail: 'IRR is comfortably above the active rate',
    };
  }

  return {
    label: 'Strong',
    tone: 'positive',
    detail: 'IRR is well above the active rate',
  };
};

export const getSentimentStatus = ({ viabilityPass, spreadStatus, fragilityPass }) => {
  if (!viabilityPass) {
    return {
      label: 'Reject',
      tone: 'negative',
      detail: 'Base NPV is below zero',
    };
  }

  if (spreadStatus.tone === 'negative') {
    return {
      label: 'Borderline',
      tone: 'caution',
      detail: 'IRR does not clear the active rate',
    };
  }

  if (!fragilityPass) {
    return {
      label: 'Cautious',
      tone: 'caution',
      detail: 'Downside case fails the fragility check',
    };
  }

  if (spreadStatus.tone === 'caution') {
    return {
      label: 'Cautious',
      tone: 'caution',
      detail: 'Base case passes, but the return spread is still thin',
    };
  }

  if (spreadStatus.tone === 'warm') {
    return {
      label: 'Promising',
      tone: 'caution',
      detail: 'Base case and spread are solid, with some room above the active rate',
    };
  }

  return {
    label: 'Accept',
    tone: 'positive',
    detail: 'Base case, spread, and downside case all look strong',
  };
};

export const formatMobileNpv = (value, currency = '$') => {
  const numericValue = Number(value) || 0;
  return `${currency}${numericValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export const getIrrDisplay = (irrAnalysis, { precision = 2, fallback = 'N/A' } = {}) => {
  if (irrAnalysis?.status === 'above-range') return `>${irrAnalysis.bound}%`;
  if (irrAnalysis?.status === 'below-range') return `<${irrAnalysis.bound}%`;
  if (irrAnalysis?.status !== 'valid' || typeof irrAnalysis.value !== 'number') return fallback;
  return `${irrAnalysis.value.toFixed(precision)}%`;
};

export const formatMobileIrr = (value) => {
  if (value && typeof value === 'object') return getIrrDisplay(value, { precision: 0 });
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? `${Math.round(numericValue)}%` : 'N/A';
};

export const getIrrIssueLabel = (irrAnalysis) => {
  if (irrAnalysis?.status === 'ambiguous') return 'Ambiguous IRR';
  if (irrAnalysis?.status === 'none') return 'IRR unavailable';
  if (irrAnalysis?.status === 'not-applicable') return 'IRR not applicable';
  if (irrAnalysis?.status === 'above-range') return 'IRR above chart range';
  if (irrAnalysis?.status === 'below-range') return 'IRR below range';
  return '';
};

export const getIrrIssueDetail = (irrAnalysis) => {
  if (!irrAnalysis || irrAnalysis.status === 'valid') return '';
  if (irrAnalysis.status === 'not-applicable') return irrAnalysis.reason;
  if (irrAnalysis.status === 'above-range' || irrAnalysis.status === 'below-range') return irrAnalysis.reason;
  if (irrAnalysis.status === 'ambiguous' && irrAnalysis.roots?.length > 1) {
    return `Multiple IRR roots were found (${irrAnalysis.roots.map((root) => `${root.toFixed(2)}%`).join(', ')}), so the single IRR readout and IRR-based rules are marked N/A.`;
  }
  return irrAnalysis.reason || 'No reliable single IRR can be calculated for this cash-flow pattern.';
};

export const PERIOD_OPTIONS = {
  months: { label: 'Months', singular: 'Month', short: 'mo', periodsPerYear: 12, appliedLabel: 'monthly' },
  quarters: { label: 'Quarters', singular: 'Quarter', short: 'qtr', periodsPerYear: 4, appliedLabel: 'quarterly' },
  years: { label: 'Years', singular: 'Year', short: 'yr', periodsPerYear: 1, appliedLabel: 'annually' },
};

export const getPeriodMeta = (periodMode) => PERIOD_OPTIONS[periodMode] || PERIOD_OPTIONS.years;

export const getRateBasisLabel = (periodMode) => `Applied ${getPeriodMeta(periodMode).appliedLabel}`;

export const annualToPeriodRate = (annualRate, periodMode) => {
  const rate = Number(annualRate);
  if (!Number.isFinite(rate)) return 0;
  const periodsPerYear = getPeriodMeta(periodMode).periodsPerYear;
  if (periodsPerYear === 1) return rate;
  return (Math.pow(1 + rate / 100, 1 / periodsPerYear) - 1) * 100;
};

export const periodToAnnualRate = (periodRate, periodMode) => {
  const rate = Number(periodRate);
  if (!Number.isFinite(rate)) return 0;
  const periodsPerYear = getPeriodMeta(periodMode).periodsPerYear;
  if (periodsPerYear === 1) return rate;
  return (Math.pow(1 + rate / 100, periodsPerYear) - 1) * 100;
};

export const getAppliedRate = (displayRate, periodMode, rateBasis = 'annual') => (
  rateBasis === 'per-period' ? displayRate : annualToPeriodRate(displayRate, periodMode)
);

export const convertIrrAnalysisRateBasis = (irrAnalysis, periodMode, rateBasis = 'annual') => {
  if (rateBasis === 'per-period' || !irrAnalysis) return irrAnalysis;

  const convertRate = (rate) => periodToAnnualRate(rate, periodMode);
  return {
    ...irrAnalysis,
    value: typeof irrAnalysis.value === 'number' ? convertRate(irrAnalysis.value) : irrAnalysis.value,
    roots: Array.isArray(irrAnalysis.roots) ? irrAnalysis.roots.map(convertRate) : [],
  };
};

export const getPeriodLabel = (periodMode, count) => `${getPeriodMeta(periodMode).singular} ${count}`;

export const getPeriodCollectionLabel = (periodMode) => getPeriodMeta(periodMode).label;

export const getAddPeriodLabel = (periodMode, isDesktopViewport) => `${isDesktopViewport ? 'Click' : 'Tap'} here to add another ${getPeriodMeta(periodMode).singular.toLowerCase()}`;

export const formatPaybackDisplay = (value, periodMode = 'years') => (typeof value === 'number' ? `${value.toFixed(1)} ${getPeriodMeta(periodMode).short}` : value);

export const getSliderBounds = (values, { minBase = -5000, maxBase = 10000 } = {}) => {
  const numericValues = values.map((value) => Number(value)).filter((value) => Number.isFinite(value));

  const highestPositive = numericValues.length ? Math.max(0, ...numericValues) : 0;
  const lowestNegative = numericValues.length ? Math.min(0, ...numericValues) : 0;

  let max = maxBase;
  while (highestPositive > max) {
    max *= 10;
  }

  let min = minBase;
  while (lowestNegative < min) {
    min *= 10;
  }

  return { min, max };
};

export const tooltipShellStyle = {
  background: 'rgba(17, 24, 39, 0.92)',
  color: '#f9fafb',
  border: '1px solid #374151',
  borderRadius: 8,
  padding: '8px 10px',
  fontSize: 12,
  minWidth: 150,
};

export const chartTooltipMotionProps = {
  animationDuration: 80,
  animationEasing: 'linear',
  useTranslate3d: true,
};

export const upgradeFeatures = [
  'Unlimited cash-flow horizons and dynamic periods',
  'Sensitivity analysis and deeper decision diagnostics',
  'Editable example templates and saved project organization',
  'More cloud and local projects',
  'Future report export, scenario comparison, and presentation workflows',
];

export const productHighlights = [
  {
    title: 'Built for learning finance',
    body: 'Go beyond a plain calculator with visual reasoning, decision framing, and storytelling.',
  },
  {
    title: 'Fast enough for live use',
    body: 'Run scenarios in seconds, explain the on-screen, and understand results immediately.',
  },
  {
    title: 'Premium path is ready',
    body: 'Use the free calculator now, but upgrade when you want to save, share, compare, and more.',
  },
];

export const pricingPlan = {
  name: 'NPV Lab Upgrade',
  price: '$2.99/month',
  annual: '$20/year',
};

export const checkoutPlans = [
  { id: 'monthly', label: 'Monthly', price: '$2.99/mo' },
  { id: 'annual', label: 'Annual', price: '$20/yr' },
];

export const PROJECT_NAME_MAX_LENGTH = 80;
export const MAX_CASHFLOW_PERIODS = 120;
const MAX_ABS_FINANCIAL_VALUE = 1_000_000_000;
const MAX_RATE_VALUE = 100;

const clampNumber = (value, min, max) => Math.min(max, Math.max(min, value));

export const sanitizeFinancialValue = (value, fallback = 0) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return fallback;
  return clampNumber(numericValue, -MAX_ABS_FINANCIAL_VALUE, MAX_ABS_FINANCIAL_VALUE);
};

export const sanitizeRateValue = (value, fallback = 0) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return fallback;
  return clampNumber(numericValue, 0, MAX_RATE_VALUE);
};

export const sanitizeCashflows = (values, fallback = []) => {
  if (!Array.isArray(values)) return fallback;
  return values
    .slice(0, MAX_CASHFLOW_PERIODS)
    .map((value) => sanitizeFinancialValue(value))
    .filter((value) => Number.isFinite(value));
};

export const sanitizeProjectName = (name) => String(name || '').trim().slice(0, PROJECT_NAME_MAX_LENGTH);

export const sanitizeProjectSnapshot = (project) => {
  const cashflowValues = sanitizeCashflows(project?.cashflows, [0]);
  return {
    initial: sanitizeFinancialValue(project?.initial, 0),
    discount: sanitizeRateValue(project?.discount, 0),
    cashflows: cashflowValues.length ? cashflowValues : [0],
    periodMode: ['months', 'quarters', 'years'].includes(project?.periodMode) ? project.periodMode : 'years',
    rateBasis: project?.rateBasis === 'per-period' ? 'per-period' : 'annual',
    showHurdleRate: Boolean(project?.showHurdleRate),
    hurdleRate: sanitizeRateValue(project?.hurdleRate, 12),
  };
};
