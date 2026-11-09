-- Server-only helper for the Netlify /api/check-passkey function.
-- Returns whether the account for this email has at least one WebAuthn passkey.
-- Executable only by service_role (never anon/authenticated).

create or replace function public.user_has_passkey(lookup_email text)
returns boolean
language sql
stable
security definer
set search_path = auth, public
as $$
  select exists (
    select 1
    from auth.users as users
    inner join auth.webauthn_credentials as credentials
      on credentials.user_id = users.id
    where users.email is not null
      and lower(users.email) = lower(trim(lookup_email))
  );
$$;

revoke all on function public.user_has_passkey(text) from public;
revoke all on function public.user_has_passkey(text) from anon, authenticated;
grant execute on function public.user_has_passkey(text) to service_role;

comment on function public.user_has_passkey(text) is
  'Returns true when auth.users.email has at least one auth.webauthn_credentials row. service_role only.';
