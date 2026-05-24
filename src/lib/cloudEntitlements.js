const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isCloudEntitlementsConfigured = () => Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

const isMissingEntitlementsTableError = (detail) => {
  try {
    const parsed = JSON.parse(detail);
    return parsed?.code === 'PGRST205' && parsed?.message?.includes('user_entitlements');
  } catch {
    return detail.includes('PGRST205') && detail.includes('user_entitlements');
  }
};

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
    if (isMissingEntitlementsTableError(detail)) {
      return { hasPro: false, source: null, unavailable: true };
    }
    throw new Error(detail || 'Unable to load account entitlement.');
  }

  const [row] = await response.json();
  return {
    hasPro: Boolean(row?.pro_enabled),
    source: row?.source || null,
  };
};
