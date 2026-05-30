import { analyzeIRR, calculateNPV, calculatePayback } from '../../lib/finance.js';
import { convertIrrAnalysisRateBasis, getAppliedRate, getSentimentStatus, getSpreadStatus } from '../../lib/calculation.js';
import { TEMPLATE_TIERS } from '../../lib/entitlementAccess.js';

export const freeExampleProjects = [
  {
    name: 'Equipment Purchase',
    subtitle: 'Five-year equipment case',
    description: 'A basic machinery purchase with steady annual productivity gains.',
    tier: TEMPLATE_TIERS.free,
    initial: 68000,
    discount: 9,
    cashflows: [16500, 17200, 18100, 18800, 19600],
    periodMode: 'years',
    showHurdleRate: false,
    hurdleRate: 12,
  },
  {
    name: 'Small Business Project',
    subtitle: 'Expansion decision',
    description: 'A second-location launch with ramp-up risk and mature operating cash flow.',
    tier: TEMPLATE_TIERS.free,
    initial: 92000,
    discount: 13,
    cashflows: [18000, 26500, 34500, 39000, 42000],
    periodMode: 'years',
    showHurdleRate: false,
    hurdleRate: 12,
  },
  {
    name: 'Cost-Saving Project',
    subtitle: 'Operational savings',
    description: 'A process improvement case where annual savings offset an upfront implementation cost.',
    tier: TEMPLATE_TIERS.free,
    initial: 145000,
    discount: 10,
    cashflows: [29000, 34000, 38000, 41500, 43000],
    periodMode: 'years',
    showHurdleRate: false,
    hurdleRate: 12,
  },
  {
    name: 'Investment Property Repair',
    subtitle: 'Rental asset repair',
    description: 'A property repair modeled through rent lift, lower vacancy, and resale preparation benefits.',
    tier: TEMPLATE_TIERS.free,
    initial: 36000,
    discount: 8,
    cashflows: [7200, 8400, 9000, 9600, 10200],
    periodMode: 'years',
    showHurdleRate: false,
    hurdleRate: 12,
  },
  {
    name: 'Cybersecurity Remediation',
    subtitle: 'Risk-reduction starter case',
    description: 'A simple remediation project with avoided incident costs translated into annual value.',
    tier: TEMPLATE_TIERS.free,
    initial: 125000,
    discount: 11,
    cashflows: [22000, 28500, 32500, 35200, 37200],
    periodMode: 'years',
    showHurdleRate: false,
    hurdleRate: 12,
  },
];

export const proExampleProjects = [
  {
    name: 'Cybersecurity Business Case',
    subtitle: 'Board-ready security investment',
    description: 'Remediation cost, avoided-loss assumptions, residual risk, and stakeholder-ready narrative.',
    tier: TEMPLATE_TIERS.pro,
    initial: 420000,
    discount: 11,
    cashflows: [78000, 96000, 118000, 132000, 146000, 158000],
    periodMode: 'years',
    showHurdleRate: true,
    hurdleRate: 13,
  },
  {
    name: 'SaaS Launch',
    subtitle: 'Subscription product launch',
    description: 'Monthly growth, churn drag, onboarding costs, and recurring-margin ramp.',
    tier: TEMPLATE_TIERS.pro,
    initial: 310000,
    discount: 15,
    cashflows: [-22000, -12000, 8000, 24000, 41000, 58000, 72000, 86000],
    periodMode: 'quarters',
    rateBasis: 'annual',
    showHurdleRate: true,
    hurdleRate: 18,
  },
  {
    name: 'Real Estate Renovation',
    subtitle: 'Value-add property plan',
    description: 'Renovation draw, lease-up timing, stabilized NOI, and exit-value sensitivity.',
    tier: TEMPLATE_TIERS.pro,
    initial: 780000,
    discount: 9,
    cashflows: [-120000, 85000, 145000, 188000, 225000, 910000],
    periodMode: 'years',
    showHurdleRate: true,
    hurdleRate: 11,
  },
  {
    name: 'Hiring vs Automation',
    subtitle: 'Operating model tradeoff',
    description: 'Automation investment compared with avoided hiring, training, and ongoing support costs.',
    tier: TEMPLATE_TIERS.pro,
    initial: 260000,
    discount: 12,
    cashflows: [38000, 72000, 96000, 112000, 124000, 132000],
    periodMode: 'years',
    showHurdleRate: true,
    hurdleRate: 14,
  },
  {
    name: 'Multi-Scenario Capital Project',
    subtitle: 'Scenario-comparison starter',
    description: 'Base project designed to become conservative, aggressive, delayed-launch, and higher-cost cases.',
    tier: TEMPLATE_TIERS.pro,
    initial: 1150000,
    discount: 10,
    cashflows: [140000, 215000, 290000, 345000, 390000, 420000, 445000],
    periodMode: 'years',
    showHurdleRate: true,
    hurdleRate: 12,
  },
];

export const exampleProjects = [...freeExampleProjects, ...proExampleProjects];

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
