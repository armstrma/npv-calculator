export const IP_LIMIT_PER_MINUTE = 10;
export const EMAIL_LIMIT_PER_MINUTE = 5;
export const RATE_WINDOW_MS = 60_000;

export const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

export const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

export const getClientIp = (req) => {
  const forwardedFor = req.headers.get('x-forwarded-for') || '';
  return forwardedFor.split(',')[0]?.trim()
    || req.headers.get('x-nf-client-connection-ip')
    || 'unknown';
};

export const createMemoryRateStore = () => {
  const values = new Map();
  return {
    async get(key) {
      return values.has(key) ? values.get(key) : null;
    },
    async set(key, value) {
      values.set(key, value);
    },
  };
};

const readCounter = async (store, key, now) => {
  const raw = await store.get(key);
  if (!raw) return { count: 0, resetAt: now + RATE_WINDOW_MS };
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!parsed?.resetAt || parsed.resetAt <= now) {
      return { count: 0, resetAt: now + RATE_WINDOW_MS };
    }
    return { count: Number(parsed.count) || 0, resetAt: parsed.resetAt };
  } catch {
    return { count: 0, resetAt: now + RATE_WINDOW_MS };
  }
};

export const consumeRateLimit = async (store, { ip, email, now = Date.now() }) => {
  const ipKey = `ip:${ip || 'unknown'}`;
  const emailKey = `email:${email}`;
  const ipCounter = await readCounter(store, ipKey, now);
  const emailCounter = await readCounter(store, emailKey, now);

  if (ipCounter.count >= IP_LIMIT_PER_MINUTE || emailCounter.count >= EMAIL_LIMIT_PER_MINUTE) {
    return { allowed: false, retryAfterSec: Math.ceil(Math.max(0, Math.max(ipCounter.resetAt, emailCounter.resetAt) - now) / 1000) };
  }

  const nextIp = { count: ipCounter.count + 1, resetAt: ipCounter.resetAt };
  const nextEmail = { count: emailCounter.count + 1, resetAt: emailCounter.resetAt };
  await store.set(ipKey, JSON.stringify(nextIp));
  await store.set(emailKey, JSON.stringify(nextEmail));
  return { allowed: true };
};

export const queryUserHasPasskey = async ({ supabaseUrl, serviceRoleKey, email, fetchImpl = fetch }) => {
  const response = await fetchImpl(`${supabaseUrl}/rest/v1/rpc/user_has_passkey`, {
    method: 'POST',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ lookup_email: email }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    const error = new Error(detail || 'Passkey check failed.');
    error.status = response.status;
    throw error;
  }

  const value = await response.json();
  return Boolean(value);
};

export const handlePasskeyCheck = async ({
  req,
  getEnv,
  rateStore,
  fetchImpl = fetch,
  now = Date.now(),
}) => {
  if (req.method !== 'POST') {
    return { status: 405, body: { error: 'Method not allowed.' } };
  }

  const body = await req.json().catch(() => ({}));
  const email = normalizeEmail(body.email);
  if (!email || !isValidEmail(email)) {
    return { status: 400, body: { error: 'Invalid request.' } };
  }

  const ip = getClientIp(req);
  const rate = await consumeRateLimit(rateStore, { ip, email, now });
  if (!rate.allowed) {
    return {
      status: 429,
      body: { error: 'Too many requests.' },
      headers: { 'Retry-After': String(Math.max(1, Math.ceil(rate.retryAfterSec || 60))) },
    };
  }

  const supabaseUrl = getEnv('SUPABASE_URL', getEnv('VITE_SUPABASE_URL'));
  const serviceRoleKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    return { status: 503, body: { error: 'Service unavailable.' } };
  }

  try {
    const hasPasskey = await queryUserHasPasskey({
      supabaseUrl,
      serviceRoleKey,
      email,
      fetchImpl,
    });
    return { status: 200, body: { hasPasskey } };
  } catch {
    return { status: 503, body: { error: 'Service unavailable.' } };
  }
};
