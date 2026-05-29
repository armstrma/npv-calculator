import { analyzeIRR, calculateNPV, calculatePayback } from '../../lib/finance.js';
import { convertIrrAnalysisRateBasis, getAppliedRate, getSentimentStatus, getSpreadStatus } from '../../lib/calculation.js';

export const exampleProjects = [
  {
    name: 'Office Solar Retrofit',
    subtitle: 'Commercial energy savings',
    description: 'Panels, inverter replacement, and tax-credit-adjusted utility savings for a mid-size office.',
    initial: 185000,
    discount: 8.5,
    cashflows: [32000, 34500, 36000, 38200, 40100, 41800, 43600, 45500],
    periodMode: 'years',
    showHurdleRate: true,
    hurdleRate: 10,
  },
  {
    name: 'Food Truck Expansion',
    subtitle: 'Second-location launch',
    description: 'Upfront truck buildout, uneven ramp-up, and mature operating cash flow for a small business.',
    initial: 92000,
    discount: 13,
    cashflows: [18000, 26500, 34500, 39000, 42000],
    periodMode: 'years',
    showHurdleRate: false,
    hurdleRate: 12,
  },
  {
    name: 'Warehouse Automation',
    subtitle: 'Labor efficiency investment',
    description: 'Robotics and scanning upgrades with implementation drag before annual savings settle in.',
    initial: 640000,
    discount: 11,
    cashflows: [92000, 118000, 146000, 166000, 181000, 195000],
    periodMode: 'years',
    showHurdleRate: true,
    hurdleRate: 12.5,
  },
  {
    name: 'SaaS Onboarding Automation',
    subtitle: 'Customer success tooling',
    description: 'Software, training, and retention lift modeled across twelve monthly cash-flow periods.',
    initial: 48000,
    discount: 14,
    cashflows: [2400, 3200, 3900, 4600, 5200, 5700, 6100, 6500, 6800, 7100, 7400, 7600],
    periodMode: 'months',
    rateBasis: 'annual',
    showHurdleRate: false,
    hurdleRate: 12,
  },
];

export const getProjectPreview = (project, currency = '$') => {
  const periodMode = ['months', 'quarters', 'years'].includes(project.periodMode) ? project.periodMode : 'years';
  const rateBasis = project.rateBasis === 'per-period' ? 'per-period' : 'annual';
  const activeRate = project.showHurdleRate ? project.hurdleRate : project.discount;
  const appliedRate = getAppliedRate(activeRate, periodMode, rateBasis);
  const npv = calculateNPV(project.initial, appliedRate, project.cashflows);
  const irrAnalysis = convertIrrAnalysisRateBasis(analyzeIRR(project.initial, project.cashflows), periodMode, rateBasis);
  const irr = irrAnalysis.value;
  const payback = calculatePayback(project.initial, appliedRate, project.cashflows);
  const downsideIrrAnalysis = convertIrrAnalysisRateBasis(analyzeIRR(project.initial, project.cashflows.map((cf) => cf * 0.9)), periodMode, rateBasis);
  const spreadStatus = irrAnalysis.status === 'valid'
    ? getSpreadStatus(irr - activeRate)
    : ['above-range', 'not-applicable'].includes(irrAnalysis.status)
      ? { label: irrAnalysis.status === 'not-applicable' ? 'N/A' : 'Strong', tone: 'positive', detail: irrAnalysis.reason }
      : { label: 'N/A', tone: 'caution', detail: irrAnalysis.reason };
  const fragilityPass = ['above-range', 'not-applicable'].includes(downsideIrrAnalysis.status) || (downsideIrrAnalysis.status === 'valid' && downsideIrrAnalysis.value >= activeRate);
  const sentiment = getSentimentStatus({ viabilityPass: npv > 0, spreadStatus, fragilityPass });

  return {
    npv,
    irr,
    irrAnalysis,
    payback,
    activeRate,
    label: sentiment.label,
    tone: sentiment.tone,
    currency,
    periodMode,
  };
};
