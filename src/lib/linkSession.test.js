import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AUTHOR_LOCK_MESSAGE,
  EXAMPLE_TIER_LOCK_MESSAGE,
  LINK_SESSION_STORAGE_KEY,
  SHARED_HURDLE_TIER_LOCK_MESSAGE,
  SHARED_PERIOD_TIER_LOCK_MESSAGE,
  createFieldLocks,
  formatLockMessage,
  createLinkSession,
  exceedsFreeTier,
  getLinkDraftKey,
  hashLinkSearch,
  normalizeLinkSession,
  readLinkDraft,
  readLinkSession,
  writeLinkDraft,
  writeLinkSession,
} from './linkSession.js';
import { WORKING_DRAFT_STORAGE_KEY, resetSavedAppData } from './workingDraft.js';

const installStorage = () => {
  const store = new Map();
  const storage = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
  };
  // Object.keys(localStorage) lists stored keys in browsers; mimic that.
  const proxy = new Proxy(storage, {
    ownKeys: () => [...store.keys()],
    getOwnPropertyDescriptor: (target, key) => (store.has(key)
      ? { enumerable: true, configurable: true, value: store.get(key) }
      : Object.getOwnPropertyDescriptor(target, key)),
  });
  globalThis.window = { localStorage: proxy };
  return store;
};

const baseline = {
  initial: 50000,
  discount: 9,
  cashflows: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  periodMode: 'months',
  rateBasis: 'per-period',
  showHurdleRate: true,
  hurdleRate: 11,
  currency: '€',
  projectName: '',
  loadedProjectName: '',
};

test('hashLinkSearch is stable regardless of param order and differs by content', () => {
  assert.equal(hashLinkSearch('?a=1&b=2'), hashLinkSearch('?b=2&a=1'));
  assert.notEqual(hashLinkSearch('?a=1&b=2'), hashLinkSearch('?a=1&b=3'));
  assert.match(hashLinkSearch(''), /^[0-9a-f]{8}$/);
});

test('createLinkSession keeps the baseline and marks scenarios', () => {
  const plain = createLinkSession({ search: '?initial=1', baseline });
  assert.equal(plain.isScenario, false);
  assert.deepEqual(plain.baseline.cashflows, baseline.cashflows);
  assert.equal(plain.baseline.periodMode, 'months');
  assert.equal(plain.baseline.loadedProjectSource, 'scratch');
  const scenario = createLinkSession({ search: '?initial=1&lock=initial', baseline, locks: ['initial', 'junk'], hides: ['export'] });
  assert.equal(scenario.isScenario, true);
  assert.deepEqual(scenario.locks, ['initial']);
  assert.deepEqual(scenario.hides, ['export']);
});

test('normalizeLinkSession rejects malformed sessions', () => {
  assert.equal(normalizeLinkSession(null), null);
  assert.equal(normalizeLinkSession({ version: 99, key: 'x', baseline }), null);
  assert.equal(normalizeLinkSession({ version: 1, key: '', baseline }), null);
  assert.equal(normalizeLinkSession({ version: 1, key: 'abc', baseline: 'nope' }), null);
  assert.equal(normalizeLinkSession({ version: 1, key: 'abc', baseline, locks: 'initial' }).isScenario, true);
});

test('session and scenario drafts persist separately from the normal working draft', () => {
  const store = installStorage();
  store.set(WORKING_DRAFT_STORAGE_KEY, JSON.stringify({ version: 1, model: { initial: 5555, cashflows: [1] } }));
  const session = createLinkSession({ search: '?initial=1&lock=initial', baseline, locks: ['initial'] });
  writeLinkSession(session);
  assert.deepEqual(readLinkSession(), session);
  writeLinkDraft(session, { ...baseline, cashflows: [42] });
  assert.deepEqual(readLinkDraft(session).cashflows, [42]);
  assert.ok(store.has(getLinkDraftKey(session)));
  // The normal draft is untouched.
  assert.equal(JSON.parse(store.get(WORKING_DRAFT_STORAGE_KEY)).model.initial, 5555);
  writeLinkSession(null);
  assert.equal(readLinkSession(), null);
});

test('corrupt sessions are discarded', () => {
  const store = installStorage();
  store.set(LINK_SESSION_STORAGE_KEY, '{"version":1}');
  assert.equal(readLinkSession(), null);
  assert.equal(store.has(LINK_SESSION_STORAGE_KEY), false);
  store.set(LINK_SESSION_STORAGE_KEY, '{not json');
  assert.equal(readLinkSession(), null);
});

test('resetSavedAppData also clears link sessions and scenario drafts', () => {
  const store = installStorage();
  const session = createLinkSession({ search: '?lock=initial', baseline, locks: ['initial'] });
  writeLinkSession(session);
  writeLinkDraft(session, baseline);
  store.set('npvLabSupabaseSession', 'keep');
  resetSavedAppData();
  assert.equal(store.has(LINK_SESSION_STORAGE_KEY), false);
  assert.equal(store.has(getLinkDraftKey(session)), false);
  assert.equal(store.get('npvLabSupabaseSession'), 'keep');
});

test('exceedsFreeTier flags Pro-only settings', () => {
  assert.equal(exceedsFreeTier({ cashflows: [1, 2, 3, 4, 5], periodMode: 'years', rateBasis: 'annual', showHurdleRate: false }), false);
  assert.equal(exceedsFreeTier({ cashflows: [1, 2, 3, 4, 5, 6] }), true);
  assert.equal(exceedsFreeTier({ cashflows: [1], periodMode: 'months' }), true);
  assert.equal(exceedsFreeTier({ cashflows: [1], rateBasis: 'per-period' }), true);
  assert.equal(exceedsFreeTier({ cashflows: [1], showHurdleRate: true }), true);
});

test('no locks for a Pro user or a plain free model', () => {
  const locks = createFieldLocks({});
  assert.equal(locks.initial().locked, false);
  assert.equal(locks.rate().locked, false);
  assert.equal(locks.cashflow(9).locked, false);
  assert.equal(locks.periodStructure(10).locked, false);
  assert.equal(locks.periodMode('months').locked, false);
  assert.equal(locks.currency().locked, false);
  assert.equal(locks.hurdleToggle().locked, false);
});

test('free example preview keeps its rules: only the first cash flow is editable', () => {
  const locks = createFieldLocks({ isFreeExamplePreview: true });
  assert.equal(locks.initial().message, EXAMPLE_TIER_LOCK_MESSAGE);
  assert.equal(locks.rate().reason, 'tier');
  assert.equal(locks.cashflow(0).locked, false);
  assert.equal(locks.cashflow(1).reason, 'tier');
  assert.equal(locks.periodStructure(5).locked, true);
});

test('lock messages are short, with an optional brief reason', () => {
  assert.equal(formatLockMessage('author'), 'Locked by author');
  assert.equal(formatLockMessage('author', 'given in problem'), 'Locked by author: given in problem');
  assert.equal(formatLockMessage('tier'), 'Pro feature');
  assert.equal(formatLockMessage('tier', 'monthly rates'), 'Pro: monthly rates');
  assert.equal(formatLockMessage('tier', 'x'.repeat(80)).length, 'Pro: '.length + 40);
  assert.equal(AUTHOR_LOCK_MESSAGE, 'Locked by author');
  assert.equal(SHARED_PERIOD_TIER_LOCK_MESSAGE, 'Pro: beyond 5 years');
  // Every built-in message stays short enough to sit on a slider.
  [AUTHOR_LOCK_MESSAGE, EXAMPLE_TIER_LOCK_MESSAGE, SHARED_HURDLE_TIER_LOCK_MESSAGE, SHARED_PERIOD_TIER_LOCK_MESSAGE]
    .forEach((message) => assert.ok(message.length <= 28, message));
});

test('free shared view locks the discount rate in monthly, quarterly, or per-period mode', () => {
  assert.equal(createFieldLocks({ isFreeSharedView: true, periodMode: 'months' }).rate().message, 'Pro: monthly rates');
  assert.equal(createFieldLocks({ isFreeSharedView: true, periodMode: 'quarters' }).rate().message, 'Pro: quarterly rates');
  assert.equal(createFieldLocks({ isFreeSharedView: true, rateBasis: 'per-period' }).rate().message, 'Pro: per-period rates');
  assert.equal(createFieldLocks({ isFreeSharedView: true }).rate().locked, false);
  // Pro users are never tier-locked.
  assert.equal(createFieldLocks({ periodMode: 'months', rateBasis: 'per-period' }).rate().locked, false);
  const monthly = createFieldLocks({ isFreeSharedView: true, periodMode: 'months' });
  assert.equal(monthly.cashflow(7).message, 'Pro: beyond 5 months');
  assert.equal(monthly.periodMode().message, 'Pro: monthly periods');
});

test('author reasons appear in the author message', () => {
  const locks = createFieldLocks({ authorLocks: ['discount', 'cf2'], authorReasons: { discount: 'use 8% WACC' } });
  assert.equal(locks.rate().message, 'Locked by author: use 8% WACC');
  assert.equal(locks.cashflow(2).message, 'Locked by author');
});

test('plain-link sessions keep a return draft; scenarios do not need one', () => {
  const session = createLinkSession({ search: '?initial=1', baseline, returnDraft: { ...baseline, initial: 777, cashflows: [7] } });
  assert.equal(session.returnDraft.initial, 777);
  assert.equal(normalizeLinkSession(JSON.parse(JSON.stringify(session))).returnDraft.initial, 777);
  assert.equal(createLinkSession({ search: '?lock=initial', baseline, locks: ['initial'] }).returnDraft, null);
});

test('free shared view: periods 1-5 editable, later periods and hurdle read-only', () => {
  const locks = createFieldLocks({ isFreeSharedView: true, showHurdleRate: true });
  assert.equal(locks.initial().locked, false);
  for (let i = 0; i < 5; i += 1) assert.equal(locks.cashflow(i).locked, false, `period ${i + 1}`);
  assert.deepEqual(locks.cashflow(5), { locked: true, reason: 'tier', message: SHARED_PERIOD_TIER_LOCK_MESSAGE });
  assert.equal(locks.rate().message, SHARED_HURDLE_TIER_LOCK_MESSAGE);
  assert.equal(locks.hurdleToggle().reason, 'tier');
  assert.equal(locks.periodMode('months').reason, 'tier');
  assert.equal(locks.periodMode('years').locked, false);
  assert.equal(locks.periodStructure(10).reason, 'tier');
  assert.equal(locks.periodStructure(5).locked, false);
  // Without the hurdle, the discount rate stays editable.
  assert.equal(createFieldLocks({ isFreeSharedView: true }).rate().locked, false);
});

test('author locks apply to everyone and win over tier locks', () => {
  const locks = createFieldLocks({ isFreeSharedView: true, authorLocks: ['initial', 'discount', 'cf6', 'period', 'currency'] });
  assert.deepEqual(locks.initial(), { locked: true, reason: 'author', message: AUTHOR_LOCK_MESSAGE });
  assert.equal(locks.rate().reason, 'author');
  assert.equal(locks.cashflow(6).reason, 'author');
  assert.equal(locks.cashflow(7).reason, 'tier');
  assert.equal(locks.cashflow(0).locked, false);
  assert.equal(locks.periodMode('months').reason, 'author');
  assert.equal(locks.currency().reason, 'author');
  // A locked cash flow also freezes adding/removing periods so it cannot shift.
  assert.equal(locks.periodStructure(3).reason, 'author');
  const pro = createFieldLocks({ authorLocks: ['hurdle', 'cashflows'], showHurdleRate: true });
  assert.equal(pro.rate().reason, 'author');
  assert.equal(pro.hurdleToggle().reason, 'author');
  assert.equal(pro.cashflow(3).reason, 'author');
  assert.equal(createFieldLocks({ authorLocks: ['periods'] }).periodStructure(1).reason, 'author');
  assert.equal(createFieldLocks({ authorLocks: ['hurdle'] }).rate().locked, false);
});
