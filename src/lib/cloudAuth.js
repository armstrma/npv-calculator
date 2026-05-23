const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const SESSION_STORAGE_KEY = 'npvLabSupabaseSession';

export const isCloudAuthConfigured = () => Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

const getAuthHeaders = (accessToken) => ({
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${accessToken || SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
});

export const getStoredSession = () => {
  try {
    const stored = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
};

export const storeSession = (session) => {
  window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
};

export const clearStoredSession = () => {
  window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
};

export const consumeMagicLinkSession = () => {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const accessToken = hash.get('access_token');
  const refreshToken = hash.get('refresh_token');
  const expiresIn = Number(hash.get('expires_in') || 0);
  const tokenType = hash.get('token_type') || 'bearer';

  if (!accessToken) return null;

  const session = {
    accessToken,
    refreshToken,
    tokenType,
    expiresAt: expiresIn ? Date.now() + expiresIn * 1000 : null,
  };

  storeSession(session);
  window.history.replaceState({}, '', `${window.location.pathname}${window.location.search}`);
  return session;
};

export const requestMagicLink = async ({ email, redirectTo }) => {
  if (!isCloudAuthConfigured()) {
    throw new Error('Cloud auth is not configured yet.');
  }

  const response = await fetch(`${SUPABASE_URL}/auth/v1/otp`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({
      email,
      create_user: true,
      options: {
        email_redirect_to: redirectTo,
      },
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || 'Unable to send magic link.');
  }
};

export const fetchCurrentUser = async (session = getStoredSession()) => {
  if (!isCloudAuthConfigured() || !session?.accessToken) return null;

  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: getAuthHeaders(session.accessToken),
  });

  if (!response.ok) {
    clearStoredSession();
    return null;
  }

  const user = await response.json();
  return {
    id: user.id,
    email: user.email,
  };
};
