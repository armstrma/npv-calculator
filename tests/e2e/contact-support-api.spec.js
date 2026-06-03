import { expect, test } from '@playwright/test';
import contactSupport from '../../netlify/functions/contact-support.mjs';

test.describe('/api/contact-support', () => {
  test('rejects unauthenticated requests', async () => {
    const response = await contactSupport(new Request('http://localhost/api/contact-support', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        subject: 'Billing question',
        message: 'Can you help me understand my billing status?',
      }),
    }));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'Sign in before contacting support.' });
  });

  test('rejects non-POST methods', async () => {
    const response = await contactSupport(new Request('http://localhost/api/contact-support', {
      method: 'GET',
    }));

    expect(response.status).toBe(405);
    await expect(response.json()).resolves.toEqual({ error: 'Method not allowed.' });
  });
});
