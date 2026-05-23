const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isCloudEntitlementsConfigured = () => Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

const getHeaders = (accessToken) => ({
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${accessToken}`,
  'Content-Type': 'application/json',
});

export const fetchUserEntitlement = async (session) => {
  if (!isCloudEntitlementsConfigured() || !session?.accessToken) {
    return { hasPro: false, source: null };
  }

  const response = await fetch(`${SUPABASE_URL}/rest/v1/user_entitlements?select=pro_enabled,source&limit=1`, {
    headers: getHeaders(session.accessToken),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || 'Unable to load account entitlement.');
  }

  const [row] = await response.json();
  return {
    hasPro: Boolean(row?.pro_enabled),
    source: row?.source || null,
  };
};
