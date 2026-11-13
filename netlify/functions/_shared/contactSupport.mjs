import { EMAIL_LIMIT_PER_MINUTE, consumeRateLimit, getClientIp } from './passkeyCheck.mjs';

export const SUPPORT_RECEIVED_MESSAGE = 'Thanks. Your message was received.';
export const RESEND_API_URL = 'https://api.resend.com/emails';
export const DEFAULT_NOTIFY_FROM = 'NPV Lab <onboarding@resend.dev>';

export const sanitizeHeaderValue = (value = '') => String(value)
  .replace(/[\r\n\t]+/gu, ' ')
  .replace(/\s{2,}/gu, ' ')
  .trim();

export const validateSupportRequest = ({ subject, message }) => {
  const normalizedSubject = sanitizeHeaderValue(subject);
  const normalizedMessage = String(message || '').trim();
  const errors = {};

  if (normalizedSubject.length < 3 || normalizedSubject.length > 120) {
    errors.subject = 'Subject must be 3-120 characters.';
  }
  if (normalizedMessage.length < 10 || normalizedMessage.length > 5000) {
    errors.message = 'Message must be 10-5000 characters.';
  }

  return {
    errors,
    normalizedSubject,
    normalizedMessage,
  };
};

const getAccessToken = (req) => {
  const authHeader = req.headers.get('authorization') || '';
  return authHeader.replace(/^Bearer\s+/iu, '').trim();
};

export const fetchSupabaseUser = async ({
  supabaseUrl,
  supabaseAnonKey,
  accessToken,
  fetchImpl = fetch,
}) => {
  const response = await fetchImpl(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) return null;
  return response.json();
};

export const insertSupportRequest = async ({
  supabaseUrl,
  serviceRoleKey,
  row,
  fetchImpl = fetch,
}) => {
  const response = await fetchImpl(`${supabaseUrl}/rest/v1/support_requests`, {
    method: 'POST',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(row),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    const error = new Error(detail || 'Unable to save support request.');
    error.status = response.status;
    throw error;
  }
};

export const formatSupportEmail = ({ userEmail, userId, subject, message }) => (
  [
    'A new support request was submitted on NPV Lab.',
    '',
    `From: ${userEmail}`,
    `User ID: ${userId}`,
    `Subject: ${subject}`,
    '',
    'Message:',
    message,
    '',
    'You can reply directly to this email to reach the user.',
    'The message is also saved in the support_requests table.',
  ].join('\n')
);

export const notifySupportOwner = async ({
  getEnv,
  userEmail,
  userId,
  subject,
  message,
  fetchImpl = fetch,
}) => {
  const apiKey = String(getEnv('RESEND_API_KEY') || '').trim();
  const to = sanitizeHeaderValue(getEnv('SUPPORT_NOTIFY_TO') || '');
  const from = sanitizeHeaderValue(getEnv('SUPPORT_NOTIFY_FROM', DEFAULT_NOTIFY_FROM) || '') || DEFAULT_NOTIFY_FROM;

  if (!apiKey || !to) {
    return { sent: false, skipped: true };
  }

  const payload = {
    from,
    to: [to],
    subject: sanitizeHeaderValue(`NPV Lab support: ${subject}`),
    text: formatSupportEmail({ userEmail, userId, subject, message }),
  };
  if (userEmail) {
    payload.reply_to = sanitizeHeaderValue(userEmail);
  }

  const response = await fetchImpl(RESEND_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    const error = new Error(detail || 'Support notification failed.');
    error.status = response.status;
    throw error;
  }

  return { sent: true, skipped: false };
};

export const handleContactSupport = async ({
  req,
  getEnv,
  rateStore,
  fetchImpl = fetch,
  now = Date.now(),
}) => {
  if (req.method !== 'POST') {
    return { status: 405, body: { error: 'Method not allowed.' } };
  }

  const accessToken = getAccessToken(req);
  if (!accessToken) {
    return { status: 401, body: { error: 'Sign in before contacting support.' } };
  }

  const body = await req.json().catch(() => ({}));
  const { errors, normalizedSubject, normalizedMessage } = validateSupportRequest(body);
  if (Object.keys(errors).length) {
    return { status: 400, body: { error: 'Check the support request fields.', errors } };
  }

  const supabaseUrl = getEnv('SUPABASE_URL', getEnv('VITE_SUPABASE_URL'));
  const supabaseAnonKey = getEnv('SUPABASE_ANON_KEY', getEnv('VITE_SUPABASE_ANON_KEY'));
  if (!supabaseUrl || !supabaseAnonKey) {
    return { status: 503, body: { error: 'Unable to save your message. Please try again.' } };
  }

  const user = await fetchSupabaseUser({
    supabaseUrl,
    supabaseAnonKey,
    accessToken,
    fetchImpl,
  });
  if (!user?.id) {
    return { status: 401, body: { error: 'Sign in before contacting support.' } };
  }

  const userEmail = String(user.email || '').trim();
  if (!userEmail) {
    return { status: 400, body: { error: 'Your account is missing an email address.' } };
  }

  const ip = getClientIp(req);
  const rate = await consumeRateLimit(rateStore, { ip, email: user.id, now });
  if (!rate.allowed) {
    return {
      status: 429,
      body: { error: 'Too many requests. Please try again in a minute.' },
      headers: { 'Retry-After': String(Math.max(1, Math.ceil(rate.retryAfterSec || 60))) },
    };
  }

  const serviceRoleKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');
  if (!serviceRoleKey) {
    return { status: 503, body: { error: 'Unable to save your message. Please try again.' } };
  }

  try {
    await insertSupportRequest({
      supabaseUrl,
      serviceRoleKey,
      row: {
        user_id: user.id,
        email: userEmail,
        subject: normalizedSubject,
        message: normalizedMessage,
      },
      fetchImpl,
    });
  } catch {
    return { status: 503, body: { error: 'Unable to save your message. Please try again.' } };
  }

  let notified = false;
  try {
    const result = await notifySupportOwner({
      getEnv,
      userEmail,
      userId: user.id,
      subject: normalizedSubject,
      message: normalizedMessage,
      fetchImpl,
    });
    notified = Boolean(result?.sent);
  } catch (error) {
    // The row is already saved. Do not fail the request or leak provider errors.
    console.error('support_notify_failed', error?.message || 'notification failed');
  }

  // IP is retained only as abuse context. It is not a trusted identity signal.
  console.info('support_request_received', {
    ip,
    userId: user.id,
    userEmail,
    subject: normalizedSubject,
    messageLength: normalizedMessage.length,
    notified,
  });

  return { status: 200, body: { message: SUPPORT_RECEIVED_MESSAGE } };
};

export { EMAIL_LIMIT_PER_MINUTE };
