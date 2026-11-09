import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EMAIL_LIMIT_PER_MINUTE,
  IP_LIMIT_PER_MINUTE,
  consumeRateLimit,
  createMemoryRateStore,
  handlePasskeyCheck,
  isValidEmail,
  normalizeEmail,
} from './passkeyCheck.mjs';

const fakeReq = ({ method = 'POST', email, ip = '1.1.1.1' } = {}) => ({
  method,
  headers: new Headers({
    'x-forwarded-for': ip,
  }),
  async json() {
    return { email };
  },
});

test('normalizeEmail and isValidEmail', () => {
  assert.equal(normalizeEmail('  User@Example.COM '), 'user@example.com');
  assert.equal(isValidEmail('user@example.com'), true);
  assert.equal(isValidEmail('nope'), false);
});

test('handlePasskeyCheck returns hasPasskey true when RPC is true', async () => {
  const store = createMemoryRateStore();
  const result = await handlePasskeyCheck({
    req: fakeReq({ email: 'User@Example.com' }),
    getEnv: (name) => ({ SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'service' }[name] || ''),
    rateStore: store,
    fetchImpl: async () => ({
      ok: true,
      async json() { return true; },
      async text() { return 'true'; },
    }),
  });
  assert.deepEqual(result, { status: 200, body: { hasPasskey: true } });
});

test('handlePasskeyCheck returns hasPasskey false when RPC is false or user unknown', async () => {
  const store = createMemoryRateStore();
  const result = await handlePasskeyCheck({
    req: fakeReq({ email: 'missing@example.com' }),
    getEnv: (name) => ({ SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'service' }[name] || ''),
    rateStore: store,
    fetchImpl: async () => ({
      ok: true,
      async json() { return false; },
      async text() { return 'false'; },
    }),
  });
  assert.deepEqual(result, { status: 200, body: { hasPasskey: false } });
});

test('handlePasskeyCheck rejects bad input', async () => {
  const store = createMemoryRateStore();
  const result = await handlePasskeyCheck({
    req: fakeReq({ email: 'not-an-email' }),
    getEnv: () => 'x',
    rateStore: store,
  });
  assert.equal(result.status, 400);
  assert.deepEqual(result.body, { error: 'Invalid request.' });
});

test('handlePasskeyCheck rate-limits per email and per IP', async () => {
  const store = createMemoryRateStore();
  const getEnv = (name) => ({ SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'service' }[name] || '');
  const fetchImpl = async () => ({ ok: true, async json() { return false; }, async text() { return 'false'; } });
  const now = Date.now();

  for (let i = 0; i < EMAIL_LIMIT_PER_MINUTE; i += 1) {
    const allowed = await handlePasskeyCheck({
      req: fakeReq({ email: 'rate@example.com', ip: `2.2.2.${i}` }),
      getEnv,
      rateStore: store,
      fetchImpl,
      now,
    });
    assert.equal(allowed.status, 200);
  }
  const emailBlocked = await handlePasskeyCheck({
    req: fakeReq({ email: 'rate@example.com', ip: '9.9.9.9' }),
    getEnv,
    rateStore: store,
    fetchImpl,
    now,
  });
  assert.equal(emailBlocked.status, 429);

  const ipStore = createMemoryRateStore();
  for (let i = 0; i < IP_LIMIT_PER_MINUTE; i += 1) {
    const allowed = await handlePasskeyCheck({
      req: fakeReq({ email: `user${i}@example.com`, ip: '3.3.3.3' }),
      getEnv,
      rateStore: ipStore,
      fetchImpl,
      now,
    });
    assert.equal(allowed.status, 200);
  }
  const ipBlocked = await handlePasskeyCheck({
    req: fakeReq({ email: 'another@example.com', ip: '3.3.3.3' }),
    getEnv,
    rateStore: ipStore,
    fetchImpl,
    now,
  });
  assert.equal(ipBlocked.status, 429);
});

test('consumeRateLimit allows a fresh window after reset', async () => {
  const store = createMemoryRateStore();
  const now = 1_000_000;
  for (let i = 0; i < EMAIL_LIMIT_PER_MINUTE; i += 1) {
    assert.equal((await consumeRateLimit(store, { ip: `4.4.4.${i}`, email: 'window@example.com', now })).allowed, true);
  }
  assert.equal((await consumeRateLimit(store, { ip: '5.5.5.5', email: 'window@example.com', now })).allowed, false);
  assert.equal((await consumeRateLimit(store, { ip: '5.5.5.5', email: 'window@example.com', now: now + 61_000 })).allowed, true);
});

test('handlePasskeyCheck returns generic 503 when Supabase errors', async () => {
  const store = createMemoryRateStore();
  const result = await handlePasskeyCheck({
    req: fakeReq({ email: 'user@example.com' }),
    getEnv: (name) => ({ SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'service' }[name] || ''),
    rateStore: store,
    fetchImpl: async () => ({ ok: false, status: 500, async text() { return 'nope'; } }),
  });
  assert.equal(result.status, 503);
  assert.deepEqual(result.body, { error: 'Service unavailable.' });
});
