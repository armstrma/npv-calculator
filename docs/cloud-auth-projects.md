# Passwordless Cloud Projects

NPV Lab uses Supabase for the first user layer:

- Supabase Auth sends magic links and owns account/session security.
- NPV Lab never collects or stores passwords.
- NPV Lab does not collect or store credit card data.
- Project ownership is enforced in Postgres with row-level security.
- Google and Microsoft OpenID can be added later through Supabase Auth providers without changing project storage.

## Environment

Copy `.env.example` to `.env.local` and set:

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-public-anon-key
```

The anon key is safe to expose in the browser only when row-level security policies are enabled.

## Database Schema

This schema is also checked in at `supabase/migrations/20260523000000_create_user_projects.sql`. Run the SQL in the Supabase SQL editor or apply the migration through the Supabase connector.

```sql
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
```

## Supabase Auth Settings

Enable email magic links in Supabase Auth. Add the deployed app URL and local dev URL to allowed redirect URLs, for example:

- `http://localhost:5173`
- your production URL

NPV Lab stores the Supabase access and refresh token pair in browser `localStorage` so a browser restart does not sign the user out immediately. The app refreshes short-lived access tokens as needed and clears the stored session after 7 days from sign-in.

For server-side enforcement, set Supabase Auth's time-boxed session lifetime to 1 week in the project Auth session settings. Supabase enforces that limit when a session is refreshed, so the practical cutoff can be the configured lifetime plus the JWT expiration window.

When adding Google or Microsoft later, enable those providers in Supabase Auth and keep project table policies unchanged.
