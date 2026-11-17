-- Enforce the free-tier cloud project limit on public.user_projects writes.
-- Keep max_free_cloud_projects in sync with FREE_TIER_LIMITS.maxCloudProjects
-- in src/lib/entitlementAccess.js (currently 1).
--
-- This migration is checked in for review only. Do not apply it to production
-- until the PR is approved and a deliberate apply is requested.
--
-- Upsert note: the client uses
--   POST /user_projects?on_conflict=user_id,name
--   Prefer: resolution=merge-duplicates
-- which is INSERT ... ON CONFLICT (user_id, name) DO UPDATE.
-- A BEFORE INSERT trigger still runs on the insert attempt, so the trigger
-- allows the write when a row with the same user_id and name already exists.
-- That lets overwrites succeed at the free cap. A true new name is rejected
-- unless the user has active Pro or is under the cap. Renames via UPDATE do
-- not increase the row count and are left to the existing ownership policy.

create schema if not exists private;

revoke all on schema private from public;
revoke all on schema private from anon, authenticated;

comment on schema private is
  'Internal helpers that are not exposed through the Data API.';

create or replace function private.user_has_active_pro(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_entitlements as entitlement
    where entitlement.user_id = target_user_id
      and entitlement.pro_enabled = true
      and (
        entitlement.expires_at is null
        or entitlement.expires_at > pg_catalog.now()
      )
  );
$$;

revoke all on function private.user_has_active_pro(uuid) from public, anon, authenticated;

comment on function private.user_has_active_pro(uuid) is
  'True when the user has pro_enabled and the entitlement is unexpired.';

create or replace function private.can_insert_cloud_project(target_user_id uuid, target_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    exists (
      select 1
      from public.user_projects as existing
      where existing.user_id = target_user_id
        and existing.name = target_name
    )
    or private.user_has_active_pro(target_user_id)
    or (
      select count(*)
      from public.user_projects as existing
      where existing.user_id = target_user_id
    ) < 1;
$$;

revoke all on function private.can_insert_cloud_project(uuid, text) from public, anon, authenticated;

comment on function private.can_insert_cloud_project(uuid, text) is
  'Allows an insert when the name already exists (upsert overwrite), the user has active Pro, or the user is under the free cloud project limit.';

create or replace function private.enforce_cloud_project_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_user_id uuid := (select auth.uid());
begin
  if request_user_id is not null and request_user_id is distinct from new.user_id then
    raise exception 'cloud_project_owner_mismatch'
      using errcode = '42501';
  end if;

  if private.can_insert_cloud_project(new.user_id, new.name) then
    return new;
  end if;

  raise exception 'cloud_project_limit_reached'
    using
      errcode = 'P0001',
      hint = 'Upgrade to Pro to save more cloud projects.';
end;
$$;

revoke all on function private.enforce_cloud_project_limit() from public, anon, authenticated;

drop trigger if exists enforce_cloud_project_limit on public.user_projects;

create trigger enforce_cloud_project_limit
before insert on public.user_projects
for each row
execute function private.enforce_cloud_project_limit();
