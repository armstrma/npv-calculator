import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const netlifyToml = readFileSync(new URL('../../netlify.toml', import.meta.url), 'utf8');

test('Netlify sends core browser security headers', () => {
  assert.match(netlifyToml, /Content-Security-Policy = "/);
  assert.match(netlifyToml, /Strict-Transport-Security = "max-age=31536000; includeSubDomains; preload"/);
  assert.match(netlifyToml, /X-Content-Type-Options = "nosniff"/);
  assert.match(netlifyToml, /X-Frame-Options = "DENY"/);
  assert.match(netlifyToml, /Referrer-Policy = "strict-origin-when-cross-origin"/);
  assert.match(netlifyToml, /Permissions-Policy = "camera=\(\), microphone=\(\), geolocation=\(\), payment=\(\)"/);
});

test('CSP blocks high-risk defaults while allowing required app integrations', () => {
  const csp = netlifyToml.match(/Content-Security-Policy = "([^"]+)"/)?.[1] || '';

  assert.match(csp, /default-src 'self'/);
  assert.match(csp, /script-src 'self'/);
  assert.match(csp, /object-src 'none'/);
  assert.match(csp, /base-uri 'self'/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.match(csp, /connect-src 'self' https:\/\/\*\.supabase\.co/);
  assert.doesNotMatch(csp, /script-src[^;]*'unsafe-inline'/);
  assert.doesNotMatch(csp, /default-src[^;]*\*/);
});
