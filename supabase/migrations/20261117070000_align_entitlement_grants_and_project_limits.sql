-- Align production with two older repo migrations that were never applied:
--   20260523030000_harden_entitlement_grants.sql
--   20260523020000_add_user_project_limits.sql
--
-- A new idempotent migration is used instead of re-running those originals:
-- their timestamps predate already-applied production migrations, they are
-- not in the production migration history, and the originals add the checks
-- as NOT VALID but never VALIDATE them.
--
-- The original unapplied name-length check was 1-80. The product limit is
-- 1-120, matching PROJECT_NAME_MAX_LENGTH in the client. If a database
-- already has the older 1-80 constraint (for example from the historical
-- file), this migration replaces it with 1-120 before validating.
--
-- Live data was checked read-only before apply: existing user_projects
-- rows had 0 name-length violations (including at 1-120) and 0
-- payload-shape violations. VALIDATE is therefore included.

revoke insert, update, delete on public.user_entitlements from anon, authenticated;
grant select on public.user_entitlements to authenticated;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'user_projects_name_length'
      and conrelid = 'public.user_projects'::regclass
      and pg_get_constraintdef(oid) not like '%<= 120%'
  ) then
    alter table public.user_projects drop constraint user_projects_name_length;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'user_projects_name_length'
      and conrelid = 'public.user_projects'::regclass
  ) then
    alter table public.user_projects
    add constraint user_projects_name_length
    check (char_length(name) between 1 and 120)
    not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'user_projects_payload_shape'
      and conrelid = 'public.user_projects'::regclass
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
