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
