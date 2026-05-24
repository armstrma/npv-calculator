const PRODUCT_LINKS = {
  monthly: 'https://store.npvlab.com/products/npv-lab-pro-monthly?variant=43267024027761',
  annual: 'https://store.npvlab.com/products/npv-lab-pro-monthly?variant=43267033071729',
};

const getEnv = (name, fallback = '') => Netlify.env.get(name) || fallback;

const jsonResponse = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    'Content-Type': 'application/json',
  },
});

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

export default async (req) => {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405);
  }

  const authHeader = req.headers.get('authorization') || '';
  const accessToken = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!accessToken) {
    return jsonResponse({ error: 'Sign in before starting checkout.' }, 401);
  }

  const { plan } = await req.json().catch(() => ({}));
  const normalizedPlan = plan === 'annual' ? 'annual' : 'monthly';
  const productUrl = getEnv(`SHOPIFY_${normalizedPlan.toUpperCase()}_PRODUCT_URL`, PRODUCT_LINKS[normalizedPlan]);

  const user = await fetchSupabaseUser(accessToken);
  if (!user?.id) {
    return jsonResponse({ error: 'Unable to verify your signed-in account.' }, 401);
  }

  return jsonResponse({ checkoutUrl: productUrl });
};

export const config = {
  path: '/api/create-shopify-checkout',
};
