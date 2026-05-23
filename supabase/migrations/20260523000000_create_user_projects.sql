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
set search_path = public
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
