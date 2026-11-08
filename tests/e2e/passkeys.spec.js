import { expect, test } from '@playwright/test';
import { Buffer } from 'node:buffer';

// These tests run the real browser WebAuthn ceremony against Chromium's virtual authenticator,
// but every Supabase Auth endpoint is mocked. They do not prove the live Supabase passkey backend.
// WebAuthn rejects IP-address RP IDs, so these tests use the localhost name for the dev server.
const ORIGIN = 'http://localhost:5174';
// supabase-js decodes the access token, so the mocked session uses an unsigned JWT-shaped token.
const fakeJwt = (sub) => [
  Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'),
  Buffer.from(JSON.stringify({ sub, exp: Math.floor(Date.now() / 1000) + 3600, role: 'authenticated' })).toString('base64url'),
  Buffer.from('signature').toString('base64url'),
].join('.');
const TEST_TOKEN = fakeJwt('user-1');
const sessionHash = `#access_token=${TEST_TOKEN}&refresh_token=refresh-token&expires_in=3600&token_type=bearer`;
let loginCount = 0;
const loginUrl = () => `${ORIGIN}/?signedIn=e2e-${(loginCount += 1)}${sessionHash}`;
const b64url = (text) => Buffer.from(text).toString('base64url');

const addVirtualAuthenticator = async (page) => {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('WebAuthn.enable');
  const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2',
      transport: 'internal',
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });
  return { cdp, authenticatorId };
};

const mockSupabase = async (page, { userId = 'user-1', email = 'test@example.com', passkeys = [], disabled = false } = {}) => {
  const state = { passkeys: [...passkeys], registerVerifyCalls: 0, authVerifyCalls: 0 };
  await page.route('**/auth/v1/user', (route) => route.fulfill({ json: { id: userId, email, aud: 'authenticated' } }));
  await page.route('**/rest/v1/user_entitlements**', (route) => route.fulfill({ json: [{ pro_enabled: false, source: null }] }));
  await page.route('**/rest/v1/user_projects**', (route) => route.fulfill({ json: [] }));
  await page.route('**/auth/v1/passkeys', (route) => route.fulfill({ json: state.passkeys }));
  await page.route('**/auth/v1/passkeys/registration/options', (route) => {
    if (disabled) return route.fulfill({ status: 422, json: { code: 422, error_code: 'passkey_disabled', msg: 'Passkeys are disabled' } });
    return route.fulfill({
      json: {
        challenge_id: 'reg-challenge',
        options: {
          challenge: b64url('registration-challenge-0123456789'),
          rp: { id: 'localhost', name: 'NPV Lab' },
          user: { id: b64url(userId), name: email, displayName: email },
          pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
          authenticatorSelection: { residentKey: 'required', userVerification: 'preferred' },
          timeout: 60000,
          attestation: 'none',
        },
      },
    });
  });
  await page.route('**/auth/v1/passkeys/registration/verify', (route) => {
    state.registerVerifyCalls += 1;
    const created = { id: `pk-${state.passkeys.length + 1}`, friendly_name: 'Test device', created_at: '2026-11-08T00:00:00Z' };
    state.passkeys.push(created);
    return route.fulfill({ json: created });
  });
  await page.route('**/auth/v1/passkeys/authentication/options', (route) => route.fulfill({
    json: {
      challenge_id: 'auth-challenge',
      options: { challenge: b64url('authentication-challenge-0123456'), rpId: 'localhost', userVerification: 'preferred', timeout: 60000 },
    },
  }));
  await page.route('**/auth/v1/passkeys/authentication/verify', (route) => {
    state.authVerifyCalls += 1;
    return route.fulfill({
      json: {
        access_token: 'passkey-access', refresh_token: 'passkey-refresh', token_type: 'bearer', expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: userId, email },
      },
    });
  });
  return state;
};

const openAccountMenu = async (page) => {
  await page.getByRole('button', { name: 'More options' }).locator('visible=true').first().click();
};

test.beforeEach(async ({ page }) => {
  await page.goto(ORIGIN);
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
});

test('existing user without a passkey is prompted after magic-link login and can enroll', async ({ page }) => {
  await addVirtualAuthenticator(page);
  const state = await mockSupabase(page);
  await page.goto(loginUrl());

  const prompt = page.getByRole('dialog', { name: 'Sign in faster next time' });
  await expect(prompt).toBeVisible();
  await prompt.getByRole('button', { name: 'Add a passkey' }).click();
  await expect(prompt).toBeHidden();
  expect(state.registerVerifyCalls).toBe(1);

  // Session bridge: the app keeps its own stored session and tokens.
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('npvLabSupabaseSession')));
  expect(stored.accessToken).toBe(TEST_TOKEN);
  expect(await page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith('sb-')))).toEqual([]);
});

test('dismissing the prompt does not show it again on the next login for that account only', async ({ page }) => {
  await addVirtualAuthenticator(page);
  await mockSupabase(page, { userId: 'user-1' });
  await page.goto(loginUrl());
  const prompt = page.getByRole('dialog', { name: 'Sign in faster next time' });
  await expect(prompt).toBeVisible();
  await prompt.getByRole('button', { name: 'Not now' }).click();
  await expect(prompt).toBeHidden();

  const listed = page.waitForResponse((response) => response.url().endsWith('/auth/v1/passkeys'));
  await page.goto(loginUrl());
  await listed;
  await page.waitForTimeout(300);
  await expect(prompt).toBeHidden();

  await page.unrouteAll({ behavior: 'ignoreErrors' });
  await mockSupabase(page, { userId: 'user-2', email: 'other@example.com' });
  await page.goto(loginUrl());
  await expect(prompt).toBeVisible();
});

test('no prompt when the user already has a passkey or did not just sign in', async ({ page }) => {
  await addVirtualAuthenticator(page);
  await mockSupabase(page, { passkeys: [{ id: 'pk-1', created_at: '2026-11-01T00:00:00Z' }] });
  await page.goto(loginUrl());
  await page.waitForTimeout(800);
  await expect(page.getByRole('dialog', { name: 'Sign in faster next time' })).toBeHidden();
});

test('cancelled enrollment keeps the user signed in with a friendly message', async ({ page }) => {
  const { cdp, authenticatorId } = await addVirtualAuthenticator(page);
  await cdp.send('WebAuthn.setUserVerified', { authenticatorId, isUserVerified: false });
  await cdp.send('WebAuthn.setAutomaticPresenceSimulation', { authenticatorId, enabled: false });
  await mockSupabase(page);
  await page.goto(loginUrl());
  const prompt = page.getByRole('dialog', { name: 'Sign in faster next time' });
  await expect(prompt).toBeVisible();
  // Abort the pending ceremony by removing the authenticator.
  const click = prompt.getByRole('button', { name: 'Add a passkey' }).click();
  await page.waitForTimeout(300);
  await cdp.send('WebAuthn.removeVirtualAuthenticator', { authenticatorId });
  await click;
  await expect(prompt.getByRole('button', { name: 'Not now' })).toBeVisible();
  const stored = await page.evaluate(() => localStorage.getItem('npvLabSupabaseSession'));
  expect(stored).toContain(TEST_TOKEN);
});

test('feature-not-enabled response falls back without breaking magic-link sign in', async ({ page }) => {
  await addVirtualAuthenticator(page);
  await mockSupabase(page, { disabled: true });
  await page.goto(loginUrl());
  const prompt = page.getByRole('dialog', { name: 'Sign in faster next time' });
  await expect(prompt).toBeVisible();
  await prompt.getByRole('button', { name: 'Add a passkey' }).click();
  await expect(prompt.getByText('Passkey sign-in is not available right now', { exact: false })).toBeVisible();
});

test('passkey sign-in stores the session through the app and shows email link fallback', async ({ page }) => {
  const { cdp, authenticatorId } = await addVirtualAuthenticator(page);
  const state = await mockSupabase(page);
  // Enroll first so the virtual authenticator holds a discoverable credential for localhost.
  await page.goto(loginUrl());
  await page.getByRole('dialog', { name: 'Sign in faster next time' }).getByRole('button', { name: 'Add a passkey' }).click();
  await expect.poll(() => state.registerVerifyCalls).toBe(1);
  const { credentials } = await cdp.send('WebAuthn.getCredentials', { authenticatorId });
  expect(credentials.length).toBe(1);

  await page.evaluate(() => localStorage.removeItem('npvLabSupabaseSession'));
  await page.goto(ORIGIN);
  await openAccountMenu(page);
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  const authDialog = page.locator('.auth-modal');
  await expect(authDialog.getByRole('button', { name: 'Email me a sign-in link' })).toBeVisible();
  await expect(authDialog.getByText('Google / Microsoft later')).toHaveCount(0);
  await authDialog.getByRole('button', { name: 'Sign in with a passkey' }).click();
  await expect(authDialog).toBeHidden();
  expect(state.authVerifyCalls).toBe(1);
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('npvLabSupabaseSession')));
  expect(stored.accessToken).toBe('passkey-access');
  expect(stored.refreshToken).toBe('passkey-refresh');
});

test('signed-in users can open passkey management from the account menu', async ({ page }) => {
  await addVirtualAuthenticator(page);
  await mockSupabase(page, { passkeys: [{ id: 'pk-1', friendly_name: 'Laptop', created_at: '2026-11-01T00:00:00Z' }] });
  await page.goto(loginUrl());
  await openAccountMenu(page);
  await page.getByRole('button', { name: 'Passkeys' }).click();
  const manager = page.getByRole('dialog', { name: 'Passkeys' });
  await expect(manager.getByText('Laptop')).toBeVisible();
  await expect(manager.getByRole('button', { name: 'Add a passkey' })).toBeVisible();
});
