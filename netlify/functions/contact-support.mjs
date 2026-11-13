import { handleContactSupport } from './_shared/contactSupport.mjs';
import { createMemoryRateStore } from './_shared/passkeyCheck.mjs';

const getEnv = (name, fallback = '') => globalThis.Netlify?.env?.get(name) || fallback;

const jsonResponse = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), {
  status,
  headers: {
    'Content-Type': 'application/json',
    ...headers,
  },
});

const getRateStore = async () => {
  try {
    const { getStore } = await import('@netlify/blobs');
    const store = getStore({ name: 'support-request-rate', consistency: 'strong' });
    return {
      async get(key) {
        return store.get(key);
      },
      async set(key, value) {
        await store.set(key, value);
      },
    };
  } catch {
    // Local/unit fallback only — production Netlify provides Blobs.
    if (!globalThis.__supportRequestRateStore) {
      globalThis.__supportRequestRateStore = createMemoryRateStore();
    }
    return globalThis.__supportRequestRateStore;
  }
};

export default async (req) => {
  const rateStore = await getRateStore();
  const result = await handleContactSupport({ req, getEnv, rateStore });
  return jsonResponse(result.body, result.status, result.headers || {});
};

export const config = {
  path: '/api/contact-support',
};
