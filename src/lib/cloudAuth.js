const ENV = import.meta.env || {};
const SUPABASE_URL = ENV.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = ENV.VITE_SUPABASE_ANON_KEY;
export const SESSION_STORAGE_KEY = 'npvLabSupabaseSession';
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const REFRESH_WINDOW_MS = 5 * 60 * 1000;

export const isCloudAuthConfigured = () => Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

const getAuthHeaders = (accessToken) => ({
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${accessToken || SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
});

const isSessionWithinMaxAge = (session) => {
  const createdAt = Number(session?.createdAt || 0);
  return Boolean(createdAt && Date.now() - createdAt < SESSION_MAX_AGE_MS);
};

const normalizeSession = (session) => {
  if (!session?.accessToken) return null;
  const normalized = {
    ...session,
    createdAt: session.createdAt || Date.now(),
  };
  return isSessionWithinMaxAge(normalized) ? normalized : null;
};

export const getStoredSession = () => {
  try {
    const stored = window.localStorage.getItem(SESSION_STORAGE_KEY);
    const tabStored = window.sessionStorage.getItem(SESSION_STORAGE_KEY);

    if (!stored && tabStored) {
      const tabSession = normalizeSession(JSON.parse(tabStored));
      if (!tabSession) {
        clearStoredSession();
        return null;
      }
      window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(tabSession));
      window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
      return tabSession;
    }

    const session = stored ? normalizeSession(JSON.parse(stored)) : null;
    if (!session) clearStoredSession();
    window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
    return session;
  } catch {
    clearStoredSession();
    return null;
  }
};

export const storeSession = (session) => {
  const normalized = normalizeSession(session);
  if (!normalized) {
    clearStoredSession();
    return null;
  }
  window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(normalized));
  window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
  return normalized;
};

export const clearStoredSession = () => {
  window.localStorage.removeItem(SESSION_STORAGE_KEY);
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
    createdAt: Date.now(),
    expiresAt: expiresIn ? Date.now() + expiresIn * 1000 : null,
  };

  const storedSession = storeSession(session);
  window.history.replaceState({}, '', `${window.location.pathname}${window.location.search}`);
  return storedSession;
};

export const refreshSession = async (session = getStoredSession()) => {
  const currentSession = normalizeSession(session);
  if (!isCloudAuthConfigured() || !currentSession?.refreshToken) {
    clearStoredSession();
    return null;
  }

  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({
      refresh_token: currentSession.refreshToken,
    }),
  });

  if (!response.ok) {
    clearStoredSession();
    return null;
  }

  const refreshed = await response.json();
  return storeSession({
    accessToken: refreshed.access_token,
    refreshToken: refreshed.refresh_token || currentSession.refreshToken,
    tokenType: refreshed.token_type || currentSession.tokenType || 'bearer',
    createdAt: currentSession.createdAt,
    expiresAt: refreshed.expires_in ? Date.now() + refreshed.expires_in * 1000 : null,
  });
};

export const getActiveSession = async (session = getStoredSession()) => {
  const currentSession = normalizeSession(session);
  if (!isCloudAuthConfigured() || !currentSession?.accessToken) return null;

  if (!currentSession.expiresAt || currentSession.expiresAt > Date.now() + REFRESH_WINDOW_MS) {
    return storeSession(currentSession);
  }

  return refreshSession(currentSession);
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
  const activeSession = await getActiveSession(session);
  if (!activeSession?.accessToken) return null;

  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: getAuthHeaders(activeSession.accessToken),
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
