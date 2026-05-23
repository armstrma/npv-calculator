create table if not exists public.user_entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  pro_enabled boolean not null default false,
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_entitlements enable row level security;

grant select on public.user_entitlements to authenticated;

create policy "Users can read their own entitlements"
on public.user_entitlements
for select
to authenticated
using (auth.uid() = user_id);

drop trigger if exists touch_user_entitlements_updated_at on public.user_entitlements;

create trigger touch_user_entitlements_updated_at
before update on public.user_entitlements
for each row
execute function public.touch_updated_at();
