-- Align production with two older repo migrations that were never applied:
--   20260523030000_harden_entitlement_grants.sql
--   20260523020000_add_user_project_limits.sql
--
-- A new idempotent migration is used instead of re-running those originals:
-- their timestamps predate already-applied production migrations, they are
-- not in the production migration history, and the originals add the checks
-- as NOT VALID but never VALIDATE them.
--
-- Live data was checked read-only before opening the PR: 4 user_projects
-- rows, 0 name-length violations, 0 payload-shape violations. VALIDATE is
-- therefore included. Do not apply this to production until approved.

revoke insert, update, delete on public.user_entitlements from anon, authenticated;
grant select on public.user_entitlements to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'user_projects_name_length'
  ) then
    alter table public.user_projects
    add constraint user_projects_name_length
    check (char_length(name) between 1 and 80)
    not valid;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'user_projects_payload_shape'
  ) then
    alter table public.user_projects
    add constraint user_projects_payload_shape
    check (
      jsonb_typeof(payload) = 'object'
      and jsonb_typeof(payload -> 'cashflows') = 'array'
      and jsonb_array_length(payload -> 'cashflows') between 1 and 120
      and pg_column_size(payload) <= 65536
    )
    not valid;
  end if;
end;
$$;

alter table public.user_projects validate constraint user_projects_name_length;
alter table public.user_projects validate constraint user_projects_payload_shape;
