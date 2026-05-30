alter table public.user_entitlements
add column if not exists expires_at timestamptz;

create index if not exists user_entitlements_expires_at_idx
on public.user_entitlements (expires_at)
where expires_at is not null;
