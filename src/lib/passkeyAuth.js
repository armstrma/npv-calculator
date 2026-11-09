import { createClient } from '@supabase/supabase-js';
import { getActiveSession, isCloudAuthConfigured, storeSession } from './cloudAuth.js';

const ENV = import.meta.env || {};
const SUPABASE_URL = ENV.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = ENV.VITE_SUPABASE_ANON_KEY;
// Passkeys stay hidden until the Supabase project has passkeys enabled for this origin.
const PASSKEYS_FLAG = ENV.VITE_PASSKEYS_ENABLED === 'true';
const PROMPT_DISMISSED_PREFIX = 'npvLabPasskeyPromptDismissed:';

let runtimeDisabled = false;

export const browserSupportsPasskeys = () => (
  typeof window !== 'undefined'
  && typeof window.PublicKeyCredential === 'function'
  && Boolean(window.navigator?.credentials)
);

export const isPasskeyFeatureEnabled = () => PASSKEYS_FLAG && isCloudAuthConfigured() && !runtimeDisabled;
export const isPasskeyAvailable = () => isPasskeyFeatureEnabled() && browserSupportsPasskeys();

// Each call gets a short-lived, in-memory client. The app's own cloudAuth.js stays the single
// owner of session storage and token refresh, so supabase-js never persists or auto-refreshes.
const createPasskeyClient = () => createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
    experimental: { passkey: true },
  },
});

// Convert a supabase-js session into the app's stored session shape.
export const toAppSession = (supabaseSession, { createdAt = Date.now() } = {}) => {
  if (!supabaseSession?.access_token) return null;
  const expiresAt = supabaseSession.expires_at
    ? supabaseSession.expires_at * 1000
    : supabaseSession.expires_in ? Date.now() + supabaseSession.expires_in * 1000 : null;
  return {
    accessToken: supabaseSession.access_token,
    refreshToken: supabaseSession.refresh_token || null,
    tokenType: supabaseSession.token_type || 'bearer',
    createdAt,
    expiresAt,
  };
};

export const describePasskeyError = (error) => {
  const code = error?.code || error?.error_code || '';
  const message = String(error?.message || '');
  if (code === 'passkey_disabled' || /passkey.*(disabled|not enabled)/i.test(message)) {
    runtimeDisabled = true;
    return { kind: 'disabled', message: 'Passkey sign-in is not available right now. Use the email link instead.' };
  }
  if (code === 'webauthn_challenge_expired') {
    return { kind: 'expired', message: 'That request timed out. Please try again.' };
  }
  if (code === 'ERROR_CEREMONY_ABORTED' || error?.cause?.name === 'NotAllowedError' || error?.name === 'NotAllowedError') {
    return { kind: 'cancelled', message: 'Passkey request was cancelled.' };
  }
  if (code === 'ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED') {
    return { kind: 'duplicate', message: 'This device already has a passkey for your account.' };
  }
  if (/does not support WebAuthn/i.test(message)) {
    return { kind: 'unsupported', message: 'This browser does not support passkeys. Use the email link instead.' };
  }
  if (error?.name === 'TypeError' || /fetch|network/i.test(message)) {
    return { kind: 'network', message: 'Could not reach the sign-in service. Check your connection and try again.' };
  }
  return { kind: 'error', message: 'Passkey request failed. Please try again or use the email link.' };
};

const unavailable = () => ({ data: null, error: { kind: 'unsupported', message: 'Passkeys are not available in this browser.' } });

const run = async (fn) => {
  try {
    const { data, error } = await fn();
    if (error) return { data: null, error: describePasskeyError(error) };
    return { data, error: null };
  } catch (error) {
    return { data: null, error: describePasskeyError(error) };
  }
};

export const signInWithPasskey = async () => {
  if (!isPasskeyAvailable()) return unavailable();
  const result = await run(() => createPasskeyClient().auth.signInWithPasskey());
  if (result.error) return result;
  const session = storeSession(toAppSession(result.data?.session));
  if (!session) return { data: null, error: { kind: 'error', message: 'Passkey sign-in did not return a session.' } };
  return { data: { session, user: result.data.user ? { id: result.data.user.id, email: result.data.user.email } : null }, error: null };
};

// Hand the app's current (already refreshed) session to an ephemeral client for an authenticated call.
const withUserClient = async (appSession, fn) => {
  const active = await getActiveSession(appSession);
  if (!active?.accessToken || !active.refreshToken) {
    return { data: null, error: { kind: 'session', message: 'Sign in again to manage passkeys.' } };
  }
  const client = createPasskeyClient();
  const { error: setError } = await client.auth.setSession({
    access_token: active.accessToken,
    refresh_token: active.refreshToken,
  });
  if (setError) return { data: null, error: describePasskeyError(setError) };
  const result = await run(() => fn(client));
  // If supabase-js had to rotate tokens, keep the app's stored session in sync.
  const { data: { session: clientSession } } = await client.auth.getSession();
  if (clientSession?.refresh_token && clientSession.refresh_token !== active.refreshToken) {
    storeSession(toAppSession(clientSession, { createdAt: active.createdAt }));
  }
  return result;
};

export const registerPasskey = async (appSession) => {
  if (!isPasskeyAvailable()) return unavailable();
  return withUserClient(appSession, (client) => client.auth.registerPasskey());
};

export const listPasskeys = async (appSession) => {
  if (!isPasskeyFeatureEnabled()) return { data: [], error: null };
  return withUserClient(appSession, (client) => client.auth.passkey.list());
};

export const deletePasskey = async (appSession, passkeyId) => {
  if (!isPasskeyFeatureEnabled()) return unavailable();
  return withUserClient(appSession, (client) => client.auth.passkey.delete({ passkeyId }));
};

export const isPasskeyPromptDismissed = (userId) => {
  if (!userId) return true;
  try {
    return window.localStorage.getItem(`${PROMPT_DISMISSED_PREFIX}${userId}`) === '1';
  } catch {
    return true;
  }
};

export const dismissPasskeyPrompt = (userId) => {
  if (!userId) return;
  try {
    window.localStorage.setItem(`${PROMPT_DISMISSED_PREFIX}${userId}`, '1');
  } catch {
    // Storage unavailable; the prompt only appears after a fresh sign-in anyway.
  }
};

// Decide whether to offer enrollment after a fresh sign-in.
export const shouldOfferPasskeyEnrollment = ({ freshLogin, userId, passkeys }) => (
  Boolean(freshLogin && userId && isPasskeyAvailable() && Array.isArray(passkeys) && passkeys.length === 0 && !isPasskeyPromptDismissed(userId))
);
