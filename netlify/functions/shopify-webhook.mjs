import { verifyCheckoutState, verifyShopifyWebhook } from './_shared/shopify-signing.mjs';

const getEnv = (name, fallback = '') => Netlify.env.get(name) || fallback;

const getAttribute = (attributes = [], key) => {
  const match = attributes.find((attribute) => attribute?.name === key || attribute?.key === key);
  return match?.value || null;
};

const upsertEntitlement = async ({ userId, plan, orderId }) => {
  const supabaseUrl = getEnv('SUPABASE_URL', getEnv('VITE_SUPABASE_URL'));
  const serviceRoleKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase service role environment is not configured.');
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/user_entitlements?on_conflict=user_id`, {
    method: 'POST',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify({
      user_id: userId,
      pro_enabled: true,
      source: `shopify:${plan}:${orderId || 'unknown'}`,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || 'Unable to update Supabase entitlement.');
  }
};

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed.', { status: 405 });
  }

  const rawBody = await req.text();
  const hmacHeader = req.headers.get('x-shopify-hmac-sha256');

  if (!verifyShopifyWebhook(rawBody, hmacHeader)) {
    return new Response('Invalid Shopify webhook signature.', { status: 401 });
  }

  const order = JSON.parse(rawBody);
  const state = getAttribute(order.note_attributes, 'npv_entitlement_state');
  const requestedUserId = getAttribute(order.note_attributes, 'npv_supabase_user_id');
  const plan = getAttribute(order.note_attributes, 'npv_plan') || 'unknown';
  const verifiedState = verifyCheckoutState(state);

  if (!verifiedState?.userId || verifiedState.userId !== requestedUserId) {
    return new Response('Missing or invalid entitlement state.', { status: 202 });
  }

  await upsertEntitlement({
    userId: verifiedState.userId,
    plan: verifiedState.plan || plan,
    orderId: order.admin_graphql_api_id || order.id,
  });

  return new Response('OK');
};

export const config = {
  path: '/api/shopify-webhook',
};
