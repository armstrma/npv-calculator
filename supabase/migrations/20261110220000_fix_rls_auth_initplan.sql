-- Wrap auth.uid() in (select auth.uid()) so Postgres evaluates it once per
-- query (initplan) instead of once per row. Policy names, roles, commands,
-- USING, and WITH CHECK are otherwise unchanged.
-- Do not apply this to production until it is approved at merge time.

drop policy "Users can read their own projects" on public.user_projects;
drop policy "Users can insert their own projects" on public.user_projects;
drop policy "Users can update their own projects" on public.user_projects;
drop policy "Users can delete their own projects" on public.user_projects;
drop policy "Users can read their own entitlements" on public.user_entitlements;

create policy "Users can read their own projects"
on public.user_projects
for select
using ((select auth.uid()) = user_id);

create policy "Users can insert their own projects"
on public.user_projects
for insert
with check ((select auth.uid()) = user_id);

create policy "Users can update their own projects"
on public.user_projects
for update
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete their own projects"
on public.user_projects
for delete
using ((select auth.uid()) = user_id);

create policy "Users can read their own entitlements"
on public.user_entitlements
for select
to authenticated
using ((select auth.uid()) = user_id);
