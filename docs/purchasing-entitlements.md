# Purchasing and Entitlements

## Current POC

Entitlement state lives in `public.user_entitlements`.

For now, the only app behavior is the top-bar `PRO` badge:

- signed out users do not see the badge
- signed in users without a row, or with `pro_enabled = false`, do not see the badge
- signed in users with `pro_enabled = true` see the badge

To manually grant Pro during testing, insert or update the signed-in user's row in Supabase:

```sql
insert into public.user_entitlements (user_id, pro_enabled, source)
values ('USER_UUID_HERE', true, 'manual')
on conflict (user_id)
do update set
  pro_enabled = excluded.pro_enabled,
  source = excluded.source;
```

Revoke the entitlement with:

```sql
update public.user_entitlements
set pro_enabled = false,
    source = 'manual'
where user_id = 'USER_UUID_HERE';
```

## Shopify Wiring Target

Keep the browser out of entitlement writes. The eventual Shopify flow should be:

1. App sends the signed-in Supabase user to Shopify checkout.
2. Shopify completes payment through Shopify Checkout.
3. A trusted server endpoint receives the Shopify order/subscription webhook.
4. The server validates the webhook signature and maps the purchase to the Supabase `user_id`.
5. The server updates `public.user_entitlements.pro_enabled`.
6. The app refreshes entitlement state and shows the `PRO` badge.

The checkout button is intentionally still a placeholder until the Shopify product, checkout URL/session flow, and webhook mapping are known.
