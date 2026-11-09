import test from 'node:test';
import assert from 'node:assert/strict';

const createStorage = () => {
  const values = new Map();
  return {
    getItem: (key) => (values.has(key) ? values.get(key) : null),
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
    clear: () => values.clear(),
  };
};

globalThis.window = {
  localStorage: createStorage(),
  sessionStorage: createStorage(),
  location: { hash: '', pathname: '/', search: '' },
  history: { replaceState: () => {} },
  navigator: {},
};

const passkey = await import('./passkeyAuth.js');

test('toAppSession bridges a supabase-js session into the stored app session shape', () => {
  const session = passkey.toAppSession({
    access_token: 'a', refresh_token: 'r', token_type: 'bearer', expires_at: 2_000_000_000,
  }, { createdAt: 123 });
  assert.deepEqual(session, {
    accessToken: 'a', refreshToken: 'r', tokenType: 'bearer', createdAt: 123, expiresAt: 2_000_000_000_000,
  });
  assert.equal(passkey.toAppSession(null), null);
  assert.equal(passkey.toAppSession({ refresh_token: 'r' }), null);
});

test('describePasskeyError maps cancel, expiry, network, unsupported and generic errors', () => {
  assert.equal(passkey.describePasskeyError({ code: 'ERROR_CEREMONY_ABORTED' }).kind, 'cancelled');
  assert.equal(passkey.describePasskeyError({ cause: { name: 'NotAllowedError' } }).kind, 'cancelled');
  assert.equal(passkey.describePasskeyError({ code: 'webauthn_challenge_expired' }).kind, 'expired');
  assert.equal(passkey.describePasskeyError(new TypeError('Failed to fetch')).kind, 'network');
  assert.equal(passkey.describePasskeyError({ message: 'Browser does not support WebAuthn' }).kind, 'unsupported');
  assert.equal(passkey.describePasskeyError({ code: 'ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED' }).kind, 'duplicate');
  assert.equal(passkey.describePasskeyError({ message: 'boom' }).kind, 'error');
});

test('passkeys stay hidden when the build flag is not set', async () => {
  assert.equal(passkey.isPasskeyFeatureEnabled(), false);
  assert.equal(passkey.isPasskeyAvailable(), false);
  const result = await passkey.signInWithPasskey();
  assert.equal(result.data, null);
  assert.equal(result.error.kind, 'unsupported');
  assert.deepEqual(await passkey.listPasskeys({ accessToken: 'a' }), { data: [], error: null });
  assert.equal(passkey.shouldOfferPasskeyEnrollment({ freshLogin: true, userId: 'u1', passkeys: [] }), false);
  });

test('prompt dismissal is stored per account and does not leak between users', () => {
  assert.equal(passkey.isPasskeyPromptDismissed('user-a'), false);
  passkey.dismissPasskeyPrompt('user-a');
  assert.equal(passkey.isPasskeyPromptDismissed('user-a'), true);
  assert.equal(passkey.isPasskeyPromptDismissed('user-b'), false);
  assert.equal(passkey.isPasskeyPromptDismissed(null), true);
});

test('passkey-disabled server errors switch passkey UI off for the session', () => {
  const described = passkey.describePasskeyError({ code: 'passkey_disabled', message: 'Passkeys are disabled' });
  assert.equal(described.kind, 'disabled');
  assert.equal(passkey.isPasskeyFeatureEnabled(), false);
});

test('passkey hints are local, email-normalized, and cleared when the list is empty', () => {
  assert.equal(passkey.hasPasskeyHint('User@Example.com'), false);
  passkey.setPasskeyHint('User@Example.com');
  assert.equal(passkey.hasPasskeyHint('user@example.com'), true);
  assert.equal(passkey.hasPasskeyHint('other@example.com'), false);
  passkey.syncPasskeyHintFromList('user@example.com', [{ id: 'pk-1' }]);
  assert.equal(passkey.hasPasskeyHint('user@example.com'), true);
  passkey.syncPasskeyHintFromList('user@example.com', []);
  assert.equal(passkey.hasPasskeyHint('user@example.com'), false);
  passkey.clearPasskeyHint('user@example.com');
  assert.equal(passkey.hasPasskeyHint('user@example.com'), false);
});
