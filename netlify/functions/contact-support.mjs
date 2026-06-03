const getEnv = (name, fallback = '') => globalThis.Netlify?.env?.get(name) || fallback;

const GENERIC_SUPPORT_MESSAGE = 'Thanks. If support is available for your account, we will review your message.';

const jsonResponse = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    'Content-Type': 'application/json',
  },
});

const sanitizeHeaderValue = (value = '') => String(value).replace(/[\r\n\t]+/gu, ' ').replace(/\s{2,}/gu, ' ').trim();

const getFirstForwardedIp = (req) => {
  const forwardedFor = req.headers.get('x-forwarded-for') || '';
  return forwardedFor.split(',')[0]?.trim() || req.headers.get('x-nf-client-connection-ip') || 'unknown';
};

const fetchSupabaseUser = async (accessToken) => {
  const supabaseUrl = getEnv('SUPABASE_URL', getEnv('VITE_SUPABASE_URL'));
  const supabaseAnonKey = getEnv('SUPABASE_ANON_KEY', getEnv('VITE_SUPABASE_ANON_KEY'));

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase auth environment is not configured.');
  }

  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) return null;
  return response.json();
};

const validateSupportRequest = ({ subject, message }) => {
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

export default async (req) => {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405);
  }

  const authHeader = req.headers.get('authorization') || '';
  const accessToken = authHeader.replace(/^Bearer\s+/iu, '').trim();
  if (!accessToken) {
    return jsonResponse({ error: 'Sign in before contacting support.' }, 401);
  }

  const body = await req.json().catch(() => ({}));
  const { errors, normalizedSubject, normalizedMessage } = validateSupportRequest(body);
  if (Object.keys(errors).length) {
    return jsonResponse({ error: 'Check the support request fields.', errors }, 400);
  }

  const user = await fetchSupabaseUser(accessToken);
  if (!user?.id) {
    return jsonResponse({ error: 'Sign in before contacting support.' }, 401);
  }

  // IP is retained only as abuse context. It is not a trusted identity signal.
  const requestContext = {
    ip: getFirstForwardedIp(req),
    userId: user.id,
    userEmail: user.email || null,
    subject: normalizedSubject,
    messageLength: normalizedMessage.length,
  };

  console.info('support_request_received', requestContext);

  return jsonResponse({ message: GENERIC_SUPPORT_MESSAGE });
};

export const config = {
  path: '/api/contact-support',
};
