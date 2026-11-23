import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildShareLinkParams,
  buildShareLinkUrl,
  normalizeScenarioHides,
  normalizeScenarioLocks,
  parseScenarioLinkParams,
  parseShareLinkParams,
} from './shareLink.js';

const unnamedModel = {
  initial: 1000,
  discount: 10,
  cashflows: [300, 400, 500],
  currency: '$',
  periodMode: 'years',
  rateBasis: 'annual',
  showHurdleRate: false,
  hurdleRate: 12,
  projectName: '',
};

test('encodes an unnamed model in the existing v1 param format', () => {
  assert.equal(
    buildShareLinkParams(unnamedModel).toString(),
    'initial=1000&discount=10&cashflows=300%2C400%2C500&currency=%24&period=years&rateBasis=annual&hurdleEnabled=false',
  );
  assert.equal(
    buildShareLinkUrl('https://npvlab.com/', unnamedModel),
    'https://npvlab.com/?initial=1000&discount=10&cashflows=300%2C400%2C500&currency=%24&period=years&rateBasis=annual&hurdleEnabled=false',
  );
});

test('only includes hurdleRate when the hurdle is on and project only when named', () => {
  const params = buildShareLinkParams({ ...unnamedModel, showHurdleRate: true, hurdleRate: 14.5, projectName: '  Plant  ' });
  assert.equal(params.get('hurdleEnabled'), 'true');
  assert.equal(params.get('hurdleRate'), '14.5');
  assert.equal(params.get('project'), 'Plant');
  const unnamed = buildShareLinkParams({ ...unnamedModel, projectName: '   ' });
  assert.equal(unnamed.get('project'), null);
  assert.equal(unnamed.get('hurdleRate'), null);
});

test('round-trips an unnamed model through encode and decode', () => {
  const decoded = parseShareLinkParams(`?${buildShareLinkParams(unnamedModel).toString()}`);
  assert.deepEqual(decoded, {
    initial: 1000,
    discount: 10,
    cashflows: [300, 400, 500],
    currency: '$',
    periodMode: 'years',
    rateBasis: 'annual',
    showHurdleRate: false,
  });
});

test('round-trips negatives, decimals, euro, monthly per-period, hurdle, and a name', () => {
  const model = {
    initial: -2500.5,
    discount: 7.25,
    cashflows: [-100, 0, 250.75, 1e6],
    currency: '€',
    periodMode: 'months',
    rateBasis: 'per-period',
    showHurdleRate: true,
    hurdleRate: 9.5,
    projectName: 'Plant & Co / Q3',
  };
  const { projectName, ...rest } = model;
  const decoded = parseShareLinkParams(buildShareLinkParams(model));
  assert.deepEqual(decoded, { ...rest, projectName });
});

test('decodes hand-written legacy links already in the wild', () => {
  assert.deepEqual(
    parseShareLinkParams('?initial=7777&discount=8&cashflows=100,200,300&project=Shared%20Link'),
    { initial: 7777, discount: 8, cashflows: [100, 200, 300], projectName: 'Shared Link' },
  );
  assert.deepEqual(parseShareLinkParams('?initial=10'), { initial: 10 });
  assert.deepEqual(parseShareLinkParams(''), {});
  assert.deepEqual(parseShareLinkParams(undefined), {});
});

test('accepts and ignores reserved v, lock, and hide params', () => {
  const base = buildShareLinkParams(unnamedModel).toString();
  const withReserved = `?${base}&v=2&lock=initial,discount,cf0&hide=sliderColors,sensitivity`;
  assert.deepEqual(parseShareLinkParams(withReserved), parseShareLinkParams(`?${base}`));
  assert.deepEqual(parseShareLinkParams('?v=999&lock=%00&hide='), {});
});

test('ignores unknown and invalid values instead of throwing', () => {
  const decoded = parseShareLinkParams('?currency=¥&period=weeks&rateBasis=daily&cashflows=&signedIn=e2e&example=x');
  assert.deepEqual(decoded, {});
  const clamped = parseShareLinkParams('?initial=abc&discount=500&hurdleRate=-3&cashflows=1,abc,3');
  // Existing behavior: non-numeric values fall back to 0 rather than being dropped.
  assert.equal(clamped.initial, 0);
  assert.equal(clamped.discount, 100);
  assert.equal(clamped.hurdleRate, 0);
  assert.deepEqual(clamped.cashflows, [1, 0, 3]);
});

test('hurdleEnabled is true only for the literal string true', () => {
  assert.equal(parseShareLinkParams('?hurdleEnabled=true').showHurdleRate, true);
  assert.equal(parseShareLinkParams('?hurdleEnabled=TRUE').showHurdleRate, false);
  assert.equal(parseShareLinkParams('?hurdleEnabled=false').showHurdleRate, false);
});

test('scenario links add v=2, lock and hide, and never carry a project name', () => {
  const params = buildShareLinkParams({
    ...unnamedModel,
    projectName: 'Secret Name',
    locks: ['initial', 'cf2', 'bogus', 'initial'],
    hides: ['sensitivity', 'nope'],
  });
  assert.equal(params.get('v'), '2');
  assert.equal(params.get('lock'), 'initial,cf2');
  assert.equal(params.get('hide'), 'sensitivity');
  assert.equal(params.get('project'), null);
  // The model params are identical to a plain link.
  const plain = buildShareLinkParams(unnamedModel);
  for (const [key, value] of plain.entries()) assert.equal(params.get(key), value);
});

test('parseScenarioLinkParams reads locks and hides and drops unknown keys', () => {
  assert.deepEqual(
    parseScenarioLinkParams('?initial=1&v=2&lock=initial,cf03,cf1,foo,cashflows&hide=export,x,sliderColors'),
    { locks: ['initial', 'cf3', 'cf1', 'cashflows'], hides: ['export', 'sliderColors'], isScenario: true },
  );
  assert.deepEqual(parseScenarioLinkParams('?initial=1&discount=2'), { locks: [], hides: [], isScenario: false });
  assert.deepEqual(parseScenarioLinkParams('?v=2&lock=&hide=,,'), { locks: [], hides: [], isScenario: false });
});

test('scenario lists normalize from arrays or strings', () => {
  assert.deepEqual(normalizeScenarioLocks(' period , rateBasis ,cf99999'), ['period', 'rateBasis']);
  assert.deepEqual(normalizeScenarioLocks(['currency', 'hurdle', 'periods']), ['currency', 'hurdle', 'periods']);
  assert.deepEqual(normalizeScenarioHides(['presentation', 'presentation']), ['presentation']);
});
