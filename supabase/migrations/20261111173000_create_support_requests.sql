-- Persist authenticated support messages submitted through /api/contact-support.
-- Row Level Security is on, with no client policies and no grants to anon or
-- authenticated. The Netlify function writes with the service role, which
-- bypasses RLS. The table editor (postgres owner) can still read rows.
-- Do not apply this to production until it is approved at merge time.

create table if not exists public.support_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  subject text not null,
  message text not null,
  status text not null default 'new',
  created_at timestamptz not null default now(),
  constraint support_requests_email_length
    check (char_length(trim(email)) between 3 and 320),
  constraint support_requests_subject_length
    check (char_length(subject) between 3 and 120),
  constraint support_requests_message_length
    check (char_length(message) between 10 and 5000),
  constraint support_requests_status_allowed
    check (status in ('new', 'open', 'closed'))
);

create index if not exists support_requests_user_id_created_at_idx
  on public.support_requests (user_id, created_at desc);

comment on table public.support_requests is
  'Support messages submitted through /api/contact-support. Writable only by service_role.';

comment on column public.support_requests.status is
  'Workflow flag for the site owner: new, open, or closed. Defaults to new.';

alter table public.support_requests enable row level security;

revoke all on table public.support_requests from public;
revoke all on table public.support_requests from anon, authenticated;
grant all on table public.support_requests to service_role;
