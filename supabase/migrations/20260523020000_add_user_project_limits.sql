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
