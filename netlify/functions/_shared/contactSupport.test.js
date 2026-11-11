import test from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryRateStore, EMAIL_LIMIT_PER_MINUTE, IP_LIMIT_PER_MINUTE } from './passkeyCheck.mjs';
import {
  DEFAULT_NOTIFY_FROM,
  RESEND_API_URL,
  SUPPORT_RECEIVED_MESSAGE,
  formatSupportEmail,
  handleContactSupport,
  notifySupportOwner,
  sanitizeHeaderValue,
  validateSupportRequest,
} from './contactSupport.mjs';

const USER_ID = '11111111-1111-1111-1111-111111111111';
const USER_EMAIL = 'user@example.com';
const VALID_BODY = {
  subject: 'Billing question',
  message: 'Can you help me understand my billing status?',
};

const envFor = (overrides = {}) => (name, fallback = '') => {
  const values = {
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_ANON_KEY: 'anon-key',
    SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
    ...overrides,
  };
  return values[name] ?? fallback;
};

const fakeReq = ({
  method = 'POST',
  token = 'access-token',
  body = VALID_BODY,
  ip = '1.1.1.1',
} = {}) => ({
  method,
  headers: new Headers({
    ...(token ? { authorization: `Bearer ${token}` } : {}),
    'x-forwarded-for': ip,
  }),
  async json() {
    return body;
  },
});

const mockFetch = ({
  user = { id: USER_ID, email: USER_EMAIL },
  userStatus = 200,
  insertStatus = 201,
  notifyStatus = 200,
  calls = [],
} = {}) => {
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url, options });
    if (String(url).endsWith('/auth/v1/user')) {
      return {
        ok: userStatus >= 200 && userStatus < 300,
        status: userStatus,
        async json() { return user; },
        async text() { return JSON.stringify(user); },
      };
    }
    if (String(url).includes('/rest/v1/support_requests')) {
      return {
        ok: insertStatus >= 200 && insertStatus < 300,
        status: insertStatus,
        async json() { return {}; },
        async text() { return insertStatus >= 300 ? 'insert failed' : ''; },
      };
    }
    if (String(url) === RESEND_API_URL) {
      return {
        ok: notifyStatus >= 200 && notifyStatus < 300,
        status: notifyStatus,
        async json() { return { id: 'email-1' }; },
        async text() { return notifyStatus >= 300 ? 'notify failed' : ''; },
      };
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };
  return { fetchImpl, calls };
};

test('sanitizeHeaderValue strips control characters and collapse spaces', () => {
  assert.equal(sanitizeHeaderValue('  Hello\r\nBcc: evil@x.com\tthere  '), 'Hello Bcc: evil@x.com there');
});

test('validateSupportRequest accepts a normal subject and message', () => {
  const result = validateSupportRequest(VALID_BODY);
  assert.deepEqual(result.errors, {});
  assert.equal(result.normalizedSubject, 'Billing question');
});

test('validateSupportRequest rejects short or long fields', () => {
  const short = validateSupportRequest({ subject: 'Hi', message: 'Too short' });
  assert.equal(short.errors.subject, 'Subject must be 3-120 characters.');
  assert.equal(short.errors.message, 'Message must be 10-5000 characters.');

  const long = validateSupportRequest({ subject: 'x'.repeat(121), message: 'y'.repeat(5001) });
  assert.ok(long.errors.subject);
  assert.ok(long.errors.message);
});

test('handleContactSupport rejects non-POST methods', async () => {
  const result = await handleContactSupport({
    req: fakeReq({ method: 'GET' }),
    getEnv: envFor(),
    rateStore: createMemoryRateStore(),
  });
  assert.deepEqual(result, { status: 405, body: { error: 'Method not allowed.' } });
});

test('handleContactSupport rejects missing access tokens', async () => {
  const result = await handleContactSupport({
    req: fakeReq({ token: '' }),
    getEnv: envFor(),
    rateStore: createMemoryRateStore(),
  });
  assert.deepEqual(result, { status: 401, body: { error: 'Sign in before contacting support.' } });
});

test('handleContactSupport rejects invalid fields before calling Supabase', async () => {
  const { fetchImpl, calls } = mockFetch();
  const result = await handleContactSupport({
    req: fakeReq({ body: { subject: 'Hi', message: 'Too short' }, token: 'access-token' }),
    getEnv: envFor(),
    rateStore: createMemoryRateStore(),
    fetchImpl,
  });
  assert.equal(result.status, 400);
  assert.equal(result.body.error, 'Check the support request fields.');
  assert.equal(calls.length, 0);
});

test('handleContactSupport rejects an invalid session', async () => {
  const { fetchImpl } = mockFetch({ userStatus: 401, user: {} });
  const result = await handleContactSupport({
    req: fakeReq(),
    getEnv: envFor(),
    rateStore: createMemoryRateStore(),
    fetchImpl,
  });
  assert.deepEqual(result, { status: 401, body: { error: 'Sign in before contacting support.' } });
});

test('handleContactSupport rejects a user without an email address', async () => {
  const { fetchImpl } = mockFetch({ user: { id: USER_ID } });
  const result = await handleContactSupport({
    req: fakeReq(),
    getEnv: envFor(),
    rateStore: createMemoryRateStore(),
    fetchImpl,
  });
  assert.deepEqual(result, { status: 400, body: { error: 'Your account is missing an email address.' } });
});

test('handleContactSupport saves the row and returns an honest success when email env is unset', async () => {
  const { fetchImpl, calls } = mockFetch();
  const result = await handleContactSupport({
    req: fakeReq(),
    getEnv: envFor(),
    rateStore: createMemoryRateStore(),
    fetchImpl,
  });
  assert.deepEqual(result, { status: 200, body: { message: SUPPORT_RECEIVED_MESSAGE } });

  const insertCall = calls.find((call) => String(call.url).includes('/rest/v1/support_requests'));
  assert.ok(insertCall);
  assert.equal(insertCall.options.headers.Authorization, 'Bearer service-role-key');
  assert.deepEqual(JSON.parse(insertCall.options.body), {
    user_id: USER_ID,
    email: USER_EMAIL,
    subject: VALID_BODY.subject,
    message: VALID_BODY.message,
  });
  assert.equal(calls.some((call) => call.url === RESEND_API_URL), false);
});

test('handleContactSupport emails the owner with Reply-To set to the user', async () => {
  const { fetchImpl, calls } = mockFetch();
  const result = await handleContactSupport({
    req: fakeReq(),
    getEnv: envFor({
      RESEND_API_KEY: 're_test_key',
      SUPPORT_NOTIFY_TO: 'owner@example.com',
    }),
    rateStore: createMemoryRateStore(),
    fetchImpl,
  });
  assert.equal(result.status, 200);
  assert.equal(result.body.message, SUPPORT_RECEIVED_MESSAGE);

  const notifyCall = calls.find((call) => call.url === RESEND_API_URL);
  assert.ok(notifyCall);
  assert.equal(notifyCall.options.headers.Authorization, 'Bearer re_test_key');
  assert.deepEqual(JSON.parse(notifyCall.options.body), {
    from: DEFAULT_NOTIFY_FROM,
    to: ['owner@example.com'],
    subject: 'NPV Lab support: Billing question',
    text: formatSupportEmail({
      userEmail: USER_EMAIL,
      userId: USER_ID,
      subject: VALID_BODY.subject,
      message: VALID_BODY.message,
    }),
    reply_to: USER_EMAIL,
  });
});

test('handleContactSupport still succeeds if the notification email fails', async () => {
  const { fetchImpl, calls } = mockFetch({ notifyStatus: 500 });
  const result = await handleContactSupport({
    req: fakeReq(),
    getEnv: envFor({
      RESEND_API_KEY: 're_test_key',
      SUPPORT_NOTIFY_TO: 'owner@example.com',
    }),
    rateStore: createMemoryRateStore(),
    fetchImpl,
  });
  assert.deepEqual(result, { status: 200, body: { message: SUPPORT_RECEIVED_MESSAGE } });
  assert.ok(calls.some((call) => String(call.url).includes('/rest/v1/support_requests')));
  assert.ok(calls.some((call) => call.url === RESEND_API_URL));
});

test('handleContactSupport returns 503 when the insert fails', async () => {
  const { fetchImpl } = mockFetch({ insertStatus: 500 });
  const result = await handleContactSupport({
    req: fakeReq(),
    getEnv: envFor({
      RESEND_API_KEY: 're_test_key',
      SUPPORT_NOTIFY_TO: 'owner@example.com',
    }),
    rateStore: createMemoryRateStore(),
    fetchImpl,
  });
  assert.deepEqual(result, { status: 503, body: { error: 'Unable to save your message. Please try again.' } });
});

test('handleContactSupport returns 503 when the service role key is missing', async () => {
  const { fetchImpl, calls } = mockFetch();
  const result = await handleContactSupport({
    req: fakeReq(),
    getEnv: envFor({ SUPABASE_SERVICE_ROLE_KEY: '' }),
    rateStore: createMemoryRateStore(),
    fetchImpl,
  });
  assert.deepEqual(result, { status: 503, body: { error: 'Unable to save your message. Please try again.' } });
  assert.equal(calls.some((call) => String(call.url).includes('/rest/v1/support_requests')), false);
});

test('handleContactSupport rate-limits per user and per IP', async () => {
  const store = createMemoryRateStore();
  const now = Date.now();

  for (let i = 0; i < EMAIL_LIMIT_PER_MINUTE; i += 1) {
    const { fetchImpl } = mockFetch();
    const allowed = await handleContactSupport({
      req: fakeReq({ ip: `2.2.2.${i}` }),
      getEnv: envFor(),
      rateStore: store,
      fetchImpl,
      now,
    });
    assert.equal(allowed.status, 200);
  }
  const { fetchImpl: blockedFetch } = mockFetch();
  const userBlocked = await handleContactSupport({
    req: fakeReq({ ip: '9.9.9.9' }),
    getEnv: envFor(),
    rateStore: store,
    fetchImpl: blockedFetch,
    now,
  });
  assert.equal(userBlocked.status, 429);
  assert.equal(userBlocked.body.error, 'Too many requests. Please try again in a minute.');
  assert.ok(userBlocked.headers['Retry-After']);

  const ipStore = createMemoryRateStore();
  for (let i = 0; i < IP_LIMIT_PER_MINUTE; i += 1) {
    const { fetchImpl } = mockFetch({ user: { id: `user-${i}`, email: `user${i}@example.com` } });
    const allowed = await handleContactSupport({
      req: fakeReq({ ip: '3.3.3.3' }),
      getEnv: envFor(),
      rateStore: ipStore,
      fetchImpl,
      now,
    });
    assert.equal(allowed.status, 200);
  }
  const { fetchImpl: ipBlockedFetch } = mockFetch({ user: { id: 'another-user', email: 'another@example.com' } });
  const ipBlocked = await handleContactSupport({
    req: fakeReq({ ip: '3.3.3.3' }),
    getEnv: envFor(),
    rateStore: ipStore,
    fetchImpl: ipBlockedFetch,
    now,
  });
  assert.equal(ipBlocked.status, 429);
});

test('notifySupportOwner is a no-op when env vars are unset', async () => {
  const calls = [];
  const result = await notifySupportOwner({
    getEnv: envFor(),
    userEmail: USER_EMAIL,
    userId: USER_ID,
    subject: VALID_BODY.subject,
    message: VALID_BODY.message,
    fetchImpl: async (url) => {
      calls.push(url);
      throw new Error('should not fetch');
    },
  });
  assert.deepEqual(result, { sent: false, skipped: true });
  assert.deepEqual(calls, []);
});
