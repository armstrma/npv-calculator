import assert from 'node:assert/strict';
import test from 'node:test';
import { canSaveProject, canUseTemplate, FREE_TIER_LIMITS, resolveAccess, TEMPLATE_TIERS } from './entitlementAccess.js';

test('free access exposes basic capabilities and finite project limits', () => {
  const access = resolveAccess({ hasPro: false });

  assert.equal(access.tier, 'free');
  assert.equal(access.features.basicCalculator, true);
  assert.equal(access.features.sensitivityAnalysis, false);
  assert.equal(access.features.dynamicPeriods, false);
  assert.equal(access.features.presentationMode, false);
  assert.equal(access.limits.maxCashflowPeriods, FREE_TIER_LIMITS.maxCashflowPeriods);
});

test('pro access unlocks advanced capabilities and unlimited limits', () => {
  const access = resolveAccess({ hasPro: true });

  assert.equal(access.tier, 'pro');
  assert.equal(access.features.sensitivityAnalysis, true);
  assert.equal(access.features.proTemplates, true);
  assert.equal(access.features.presentationMode, true);
  assert.equal(access.limits.maxCashflowPeriods, Infinity);
});

test('free project saves allow overwrites but block new projects over limit', () => {
  const access = resolveAccess();
  const localProjects = { One: {}, Two: {}, Three: {} };

  assert.deepEqual(canSaveProject({ access, target: 'local', projectName: 'Two', projects: localProjects }), {
    allowed: true,
    reason: 'allowed',
  });
  assert.deepEqual(canSaveProject({ access, target: 'local', projectName: 'Four', projects: localProjects }), {
    allowed: false,
    reason: 'local-limit',
    limit: 3,
  });
});

test('free users can open free and pro-shaped templates in preview mode', () => {
  const access = resolveAccess();

  assert.equal(canUseTemplate({ access, template: { tier: TEMPLATE_TIERS.free } }).allowed, true);
  assert.equal(canUseTemplate({ access, template: { tier: TEMPLATE_TIERS.pro } }).allowed, true);
});
