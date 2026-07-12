import test from 'node:test';
import assert from 'node:assert/strict';

const createStorage = () => {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
    clear: () => values.clear(),
  };
};

const setupWindow = () => {
  globalThis.window = {
    localStorage: createStorage(),
    sessionStorage: createStorage(),
    location: {
      hash: '',
      pathname: '/',
      search: '',
    },
    history: {
      replaceState: () => {},
    },
  };
  return globalThis.window;
};

test('storeSession keeps Supabase tokens in localStorage for browser-wide persistence', async () => {
  const window = setupWindow();
  const { storeSession } = await import(`./cloudAuth.js?test=${Date.now()}-store`);

  const session = storeSession({ accessToken: 'access', refreshToken: 'refresh' });

  assert.equal(session.accessToken, 'access');
  assert.match(window.localStorage.getItem('npvLabSupabaseSession'), /"accessToken":"access"/);
  assert.equal(window.sessionStorage.getItem('npvLabSupabaseSession'), null);
});

test('getStoredSession migrates tab-only sessionStorage tokens into localStorage', async () => {
  const window = setupWindow();
  window.sessionStorage.setItem('npvLabSupabaseSession', JSON.stringify({
    accessToken: 'tab-access',
    refreshToken: 'tab-refresh',
    createdAt: Date.now(),
  }));

  const { getStoredSession } = await import(`./cloudAuth.js?test=${Date.now()}-migrate`);
  const session = getStoredSession();

  assert.equal(session.accessToken, 'tab-access');
  assert.match(window.localStorage.getItem('npvLabSupabaseSession'), /"accessToken":"tab-access"/);
  assert.equal(window.sessionStorage.getItem('npvLabSupabaseSession'), null);
});

test('getStoredSession clears sessions after seven days', async () => {
  const window = setupWindow();
  window.localStorage.setItem('npvLabSupabaseSession', JSON.stringify({
    accessToken: 'expired-access',
    refreshToken: 'expired-refresh',
    createdAt: Date.now() - (7 * 24 * 60 * 60 * 1000) - 1,
  }));

  const { getStoredSession } = await import(`./cloudAuth.js?test=${Date.now()}-expiry`);

  assert.equal(getStoredSession(), null);
  assert.equal(window.localStorage.getItem('npvLabSupabaseSession'), null);
});
