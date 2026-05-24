export const startShopifyCheckout = async ({ session, plan }) => {
  if (!session?.accessToken) {
    throw new Error('Sign in before starting checkout.');
  }

  const response = await fetch('/api/create-shopify-checkout', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ plan }),
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok || !body.checkoutUrl) {
    throw new Error(body.error || 'Unable to start Shopify checkout.');
  }

  window.location.assign(body.checkoutUrl);
};
