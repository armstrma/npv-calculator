-- SQL checks for private.can_insert_cloud_project and the insert trigger.
-- DO NOT RUN against production (project uhiazxydcuxdihtgfkxg).
-- Use a local Supabase database or a throwaway preview/branch database.
-- The script never commits: it ends with ROLLBACK.

begin;

create temporary table entitlement_test_result (
  name text primary key,
  passed boolean not null
);

do $$
declare
  free_user_id uuid := gen_random_uuid();
  pro_user_id uuid := gen_random_uuid();
  expired_user_id uuid := gen_random_uuid();
  payload jsonb := jsonb_build_object('cashflows', jsonb_build_array(100));
begin
  insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
  )
  values
    (
      '00000000-0000-0000-0000-000000000000',
      free_user_id,
      'authenticated',
      'authenticated',
      'entitlement-test-free@example.invalid',
      crypt('test-password', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{}'::jsonb,
      now(),
      now()
    ),
    (
      '00000000-0000-0000-0000-000000000000',
      pro_user_id,
      'authenticated',
      'authenticated',
      'entitlement-test-pro@example.invalid',
      crypt('test-password', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{}'::jsonb,
      now(),
      now()
    ),
    (
      '00000000-0000-0000-0000-000000000000',
      expired_user_id,
      'authenticated',
      'authenticated',
      'entitlement-test-expired@example.invalid',
      crypt('test-password', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{}'::jsonb,
      now(),
      now()
    );

  insert into public.user_entitlements (user_id, pro_enabled, source, expires_at)
  values
    (pro_user_id, true, 'manual', null),
    (expired_user_id, true, 'manual', now() - interval '1 day');

  if not private.can_insert_cloud_project(free_user_id, 'First') then
    raise exception 'expected first insert for a free user to be allowed';
  end if;

  insert into public.user_projects (user_id, name, payload)
  values (free_user_id, 'First', payload);

  if not private.can_insert_cloud_project(free_user_id, 'First') then
    raise exception 'expected upsert overwrite of an existing name at the cap to be allowed';
  end if;

  update public.user_projects
  set payload = payload || jsonb_build_object('initial', 2)
  where user_id = free_user_id and name = 'First';

  insert into public.user_projects (user_id, name, payload)
  values (free_user_id, 'First', payload)
  on conflict (user_id, name) do update
  set payload = excluded.payload;

  if private.can_insert_cloud_project(free_user_id, 'Second') then
    raise exception 'expected a second name for a free user to be rejected';
  end if;

  begin
    insert into public.user_projects (user_id, name, payload)
    values (free_user_id, 'Second', payload);
    raise exception 'free user insert of a second name should have failed';
  exception
    when raise_exception then
      if sqlerrm not like '%cloud_project_limit_reached%' then
        raise;
      end if;
  end;

  insert into public.user_projects (user_id, name, payload)
  values
    (pro_user_id, 'Pro One', payload),
    (pro_user_id, 'Pro Two', payload);

  if not private.can_insert_cloud_project(expired_user_id, 'Expired First') then
    raise exception 'expected first insert for an expired Pro user to be allowed';
  end if;

  insert into public.user_projects (user_id, name, payload)
  values (expired_user_id, 'Expired First', payload);

  if private.can_insert_cloud_project(expired_user_id, 'Expired Second') then
    raise exception 'expected a second name for an expired Pro user to be rejected';
  end if;

  insert into entitlement_test_result (name, passed) values ('enforce_cloud_project_limit', true);
end;
$$;

select * from entitlement_test_result;

rollback;
