# Security Notes

## Browser Session Persistence

Supabase access and refresh tokens are stored in browser `localStorage`, making the session available to tabs on the same origin and across browser restarts. The app clears the session seven days after the original sign-in. Older tab-only `sessionStorage` sessions are migrated into `localStorage` on the next load.

This is a browser-managed token model. A successful XSS could read the active session token, so XSS prevention and the app's restrictive Content Security Policy remain the primary controls. Signing out clears the shared browser session.

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

`POST /api/contact-support` treats the client as untrusted, verifies the Supabase session server-side, and persists the message in `public.support_requests` with the service role. Clients have no RLS policies on that table and cannot read submissions back.

Required validation:
- `subject`: required, 3-120 characters
- `message`: required, 10-5000 characters

Required abuse controls:
- rate-limit by authenticated user ID
- rate-limit by request IP as an additional context signal
- derive request IP from the first value in `x-forwarded-for`, but do not treat it as trusted identity
- return an honest success only after the row is saved (`Thanks. Your message was received.`), or an honest error if it is not. Do not claim a message will be reviewed if it was not stored. Do not vary the success message by entitlement or email-delivery status, so callers cannot enumerate those details.

Required auth and entitlement controls:
- verify the Supabase session server-side
- prefer a server-side Supabase lookup for entitlement status
- client-provided entitlement may be included as context, but must not be trusted for authorization or support priority

Required email controls:
- if user input touches the email subject, strip control characters and normalize whitespace before sending
- avoid placing raw user input into email headers beyond a sanitized subject
- set `replyTo` / `reply_to` to the authenticated user's email when notifying the site owner
- if `RESEND_API_KEY` or `SUPPORT_NOTIFY_TO` is unset, skip sending and still return success after a successful save
- do not expose provider-specific email delivery failures to the client; a failed notification must not undo a saved request
