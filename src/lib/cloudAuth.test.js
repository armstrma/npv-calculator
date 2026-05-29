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

test('storeSession keeps Supabase tokens in sessionStorage only', async () => {
  const window = setupWindow();
  const { storeSession } = await import(`./cloudAuth.js?test=${Date.now()}-store`);

  const session = storeSession({ accessToken: 'access', refreshToken: 'refresh' });

  assert.equal(session.accessToken, 'access');
  assert.equal(window.localStorage.getItem('npvLabSupabaseSession'), null);
  assert.match(window.sessionStorage.getItem('npvLabSupabaseSession'), /"accessToken":"access"/);
});

test('getStoredSession migrates legacy localStorage tokens into sessionStorage', async () => {
  const window = setupWindow();
  window.localStorage.setItem('npvLabSupabaseSession', JSON.stringify({
    accessToken: 'legacy-access',
    refreshToken: 'legacy-refresh',
    createdAt: Date.now(),
  }));

  const { getStoredSession } = await import(`./cloudAuth.js?test=${Date.now()}-migrate`);
  const session = getStoredSession();

  assert.equal(session.accessToken, 'legacy-access');
  assert.equal(window.localStorage.getItem('npvLabSupabaseSession'), null);
  assert.match(window.sessionStorage.getItem('npvLabSupabaseSession'), /"accessToken":"legacy-access"/);
});
