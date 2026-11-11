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

  test('rejects invalid fields before looking up the user', async () => {
    const response = await contactSupport(new Request('http://localhost/api/contact-support', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-token',
      },
      body: JSON.stringify({
        subject: 'Hi',
        message: 'Too short',
      }),
    }));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('Check the support request fields.');
    expect(body.errors.subject).toBe('Subject must be 3-120 characters.');
    expect(body.errors.message).toBe('Message must be 10-5000 characters.');
  });
});
