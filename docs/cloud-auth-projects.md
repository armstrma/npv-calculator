# Passwordless Cloud Projects

NPV Lab uses Supabase for the first user layer:

- Supabase Auth sends magic links and owns account/session security.
- NPV Lab never collects or stores passwords.
- NPV Lab does not collect or store credit card data.
- Project ownership is enforced in Postgres with row-level security.
- Optional passkey sign-in uses native Supabase Auth passkeys (see below).

## Environment

Copy `.env.example` to `.env.local` and set:

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-public-anon-key
```

The anon key is safe to expose in the browser only when row-level security policies are enabled.

## Database Schema

This schema is also checked in at `supabase/migrations/20260523000000_create_user_projects.sql`. Run the SQL in the Supabase SQL editor or apply the migration through the Supabase connector.

```sql
create table if not exists public.user_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

alter table public.user_projects enable row level security;

create policy "Users can read their own projects"
on public.user_projects
for select
using (auth.uid() = user_id);

create policy "Users can insert their own projects"
on public.user_projects
for insert
with check (auth.uid() = user_id);

create policy "Users can update their own projects"
on public.user_projects
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete their own projects"
on public.user_projects
for delete
using (auth.uid() = user_id);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_user_projects_updated_at on public.user_projects;

create trigger touch_user_projects_updated_at
before update on public.user_projects
for each row
execute function public.touch_updated_at();
```

## Supabase Auth Settings

Enable email magic links in Supabase Auth. Add the deployed app URL and local dev URL to allowed redirect URLs, for example:

- `http://localhost:5173`
- your production URL

NPV Lab stores the Supabase access and refresh token pair in browser `localStorage` so a browser restart does not sign the user out immediately. The app refreshes short-lived access tokens as needed and clears the stored session after 7 days from sign-in.

For server-side enforcement, set Supabase Auth's time-boxed session lifetime to 1 week in the project Auth session settings. Supabase enforces that limit when a session is refreshed, so the practical cutoff can be the configured lifetime plus the JWT expiration window.

When adding Google or Microsoft later, enable those providers in Supabase Auth and keep project table policies unchanged.

## Passkeys (alongside magic links)

NPV Lab can offer Supabase Auth's native passkeys (WebAuthn) next to email magic links. Magic links remain the recovery sign-in method.

**Sign-in screen:** email field and a single **Sign in** button. Sign in calls same-origin `POST /api/check-passkey` with `{ email }`, which returns only `{ hasPasskey: boolean }`. If `hasPasskey` is true, the app tries a passkey; cancel/failure shows **Email me a sign-in link** and **Try passkey again**. If false, unavailable, rate-limited (429), or the check errors, Sign in sends the magic link directly (no browser prompt). A local `npvLabPasskeyHint:<email>` marker is kept only as an offline/failure fallback when the check request fails (not on 429); it is set on register/successful passkey sign-in and cleared when `passkey.list` is empty. The check is rate-limited (~10/min per IP, ~5/min per email) via Netlify Blobs and uses `SUPABASE_SERVICE_ROLE_KEY` with the `public.user_has_passkey(text)` RPC (see migrations). That RPC is **service_role only** and must be applied before the check can return true in production.

### Activation (not enabled by default)

Passkey UI is hidden unless the build sets `VITE_PASSKEYS_ENABLED=true`. Do this only after the Supabase project has passkeys enabled; if the server still reports `passkey_disabled`, the UI hides itself for the session and the email link keeps working.

1. Supabase Dashboard → Authentication → Passkeys → Enable Passkey authentication:
   - Relying Party Display Name: `NPV Lab`
   - Relying Party ID: `npvlab.com` (bare domain; changing it later invalidates every registered passkey)
   - Relying Party Origins: `https://npvlab.com` (add `https://www.npvlab.com` only if it serves the app; max 5 origins; HTTPS required except loopback)
2. Add `VITE_PASSKEYS_ENABLED: 'true'` to the `env` block of `.github/workflows/netlify.yml` and deploy.
3. Manually verify registration and sign-in on `https://npvlab.com` (Safari/iOS, Chrome/Android, Windows Hello).

### Limitations

- Netlify deploy previews (`pr-<N>--<site>.netlify.app`) cannot use passkeys bound to the `npvlab.com` RP ID, because each origin must be the RP ID or a subdomain of it. Previews should verify only that magic links still work.
- CSP is unchanged: passkey requests go to `https://*.supabase.co`, already allowed by `connect-src`; the WebAuthn prompt is a browser API, not a network request.
- Playwright tests in `tests/e2e/passkeys.spec.js` use Chromium's virtual authenticator with mocked Supabase endpoints. They do not exercise the live Supabase passkey backend.
- Local passkey testing against a local Supabase stack needs `[auth.passkey]` and `[auth.webauthn]` in `supabase/config.toml` with `rp_id = "localhost"` and `rp_origins = ["http://localhost:5173"]`. WebAuthn rejects IP-address RP IDs, so use `localhost`, not `127.0.0.1`.
