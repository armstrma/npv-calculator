revoke insert, update, delete on public.user_entitlements from anon, authenticated;
grant select on public.user_entitlements to authenticated;
