export const FREE_TIER_LIMITS = {
  maxCashflowPeriods: 5,
  maxCloudProjects: 1,
  maxLocalProjects: 3,
};

export const TEMPLATE_TIERS = {
  free: 'free',
  pro: 'pro',
};

export const resolveAccess = (entitlement = {}) => {
  const hasPro = Boolean(entitlement.hasPro);

  return {
    tier: hasPro ? 'pro' : 'free',
    hasPro,
    limits: hasPro
      ? {
          maxCashflowPeriods: Infinity,
          maxCloudProjects: Infinity,
          maxLocalProjects: Infinity,
        }
      : FREE_TIER_LIMITS,
    features: {
      basicCalculator: true,
      acceptRejectResult: true,
      basicChart: true,
      basicAssumptionsSummary: true,
      limitedAnalysis: !hasPro,
      sensitivityAnalysis: hasPro,
      dynamicPeriods: hasPro,
      exportReports: hasPro,
      multiProjectComparison: hasPro,
      unlimitedHorizons: hasPro,
      guidedMode: hasPro,
      scenarioComparison: hasPro,
      projectTagging: hasPro,
      proTemplates: hasPro,
      hurdleRate: hasPro,
      cloudProjects: true,
      localProjects: true,
    },
  };
};

export const canSaveProject = ({ access, target, projectName, projects = {} }) => {
  const normalizedName = String(projectName || '').trim();
  if (!normalizedName) {
    return { allowed: false, reason: 'name-required' };
  }

  if (access.hasPro || Object.prototype.hasOwnProperty.call(projects, normalizedName)) {
    return { allowed: true, reason: 'allowed' };
  }

  const limit = target === 'cloud' ? access.limits.maxCloudProjects : access.limits.maxLocalProjects;
  if (Object.keys(projects).length >= limit) {
    return { allowed: false, reason: `${target}-limit`, limit };
  }

  return { allowed: true, reason: 'allowed' };
};

export const canUseTemplate = ({ access, template }) => {
  void access;
  void template;
  return { allowed: true, reason: 'allowed' };
};
