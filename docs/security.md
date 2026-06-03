# Security Notes

## Browser Session Storage

Supabase access and refresh tokens are stored in `sessionStorage`, not `localStorage`.

This limits token persistence to the current browser session and reduces the blast radius compared with long-lived local storage. Older `localStorage` sessions are migrated into `sessionStorage` and removed on the next load.

This is still a browser-managed token model. A successful XSS could read the active session token while the page is open, so XSS prevention remains the primary control.

## CSP And Headers

Netlify sends a Content Security Policy and common browser hardening headers from `netlify.toml`.

The CSP intentionally allows:
- same-origin scripts only
- inline styles because the app uses React/Recharts inline style attributes
- Supabase REST/Auth traffic
- Shopify checkout form/action flow

The CSP blocks:
- inline scripts
- plugin/object embedding
- framing by other sites
- broad default wildcard loading

## Future Server-Mediated Sessions

A stronger model would move auth session handling behind server-mediated, HttpOnly, Secure, SameSite cookies. That would reduce token exposure to injected JavaScript, but it requires a backend session exchange/refresh flow and changes to how Supabase-authenticated API calls are made.

## Support Request Backend Guardrails

Future support request endpoints should treat the client as untrusted and return generic success messaging.

Required validation:
- `subject`: required, 3-120 characters
- `message`: required, 10-5000 characters

Required abuse controls:
- rate-limit by authenticated user ID when present
- rate-limit by request IP as an additional context signal
- derive request IP from the first value in `x-forwarded-for`, but do not treat it as trusted identity
- return the same generic success response for accepted and safely ignored support submissions so callers cannot enumerate account, entitlement, or delivery details

Required auth and entitlement controls:
- verify the Supabase session server-side
- prefer a server-side Supabase lookup for entitlement status
- client-provided entitlement may be included as context, but must not be trusted for authorization or support priority

Required email controls:
- if user input touches the email subject, strip control characters and block or normalize header-like content before sending
- avoid placing raw user input into email headers beyond a sanitized subject
- set `replyTo` to the authenticated user's email when the mail provider allows it safely
- do not expose provider-specific email delivery failures to the client
