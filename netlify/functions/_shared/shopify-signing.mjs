import { createHmac, timingSafeEqual } from 'node:crypto';

const encoder = new TextEncoder();

const base64UrlEncode = (value) => Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');

const base64UrlDecode = (value) => JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));

const getSecret = () => Netlify.env.get('SHOPIFY_CHECKOUT_SIGNING_SECRET') || Netlify.env.get('SHOPIFY_WEBHOOK_SECRET');

export const signCheckoutState = (payload) => {
  const secret = getSecret();
  if (!secret) {
    throw new Error('SHOPIFY_CHECKOUT_SIGNING_SECRET is not configured.');
  }

  const encodedPayload = base64UrlEncode(payload);
  const signature = createHmac('sha256', secret).update(encodedPayload).digest('base64url');
  return `${encodedPayload}.${signature}`;
};

export const verifyCheckoutState = (state) => {
  const secret = getSecret();
  if (!secret || !state) return null;

  const [encodedPayload, signature] = state.split('.');
  if (!encodedPayload || !signature) return null;

  const expected = createHmac('sha256', secret).update(encodedPayload).digest('base64url');
  const signatureBytes = encoder.encode(signature);
  const expectedBytes = encoder.encode(expected);

  if (signatureBytes.length !== expectedBytes.length || !timingSafeEqual(signatureBytes, expectedBytes)) {
    return null;
  }

  return base64UrlDecode(encodedPayload);
};

export const verifyShopifyWebhook = (rawBody, hmacHeader) => {
  const secret = Netlify.env.get('SHOPIFY_WEBHOOK_SECRET');
  if (!secret || !hmacHeader) return false;

  const expected = createHmac('sha256', secret).update(rawBody, 'utf8').digest('base64');
  const receivedBytes = encoder.encode(hmacHeader);
  const expectedBytes = encoder.encode(expected);

  return receivedBytes.length === expectedBytes.length && timingSafeEqual(receivedBytes, expectedBytes);
};
