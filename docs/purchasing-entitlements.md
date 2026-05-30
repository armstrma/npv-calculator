# Purchasing and Entitlements

## Current POC

Entitlement state lives in `public.user_entitlements`.

The app now resolves the raw Pro flag into a feature matrix through `src/lib/entitlementAccess.js`.

Current free limits:

- basic NPV calculator
- accept / reject result
- up to 5 years of cash flows
- 1 saved cloud project
- 3 saved local projects
- basic chart
- basic assumptions summary
- limited analysis surface
- free example templates

Current Pro unlocks:

- unlimited cash-flow horizons
- dynamic months / quarters / years period calculations
- sensitivity analysis
- editable example templates
- more cloud and local projects

Future Pro/classroom candidates are represented in the feature matrix but should still be treated as heavier roadmap work:

- exportable reports: CSV, XLSX, PDF, PPT
- multi-project comparison
- scenario comparison
- guided educational mode
- saved project tagging
- classroom/institutional controls

The badge remains a UI indicator:

- signed out users do not see the badge
- signed in users without a row, or with `pro_enabled = false`, do not see the badge
- signed in users with `pro_enabled = true` see the badge

Frontend gating is not a security boundary. Cloud writes still need Supabase RLS or server-side checks, and future premium Netlify Functions must verify the authenticated session and entitlement server-side.

To manually grant upgraded access during testing or for a demo, insert or update the signed-in user's row in Supabase. `expires_at` can be `null` for no expiry, or a timestamp for a temporary grant.

```sql
insert into public.user_entitlements (user_id, pro_enabled, source, expires_at)
values ('USER_UUID_HERE', true, 'manual-demo', now() + interval '14 days')
on conflict (user_id)
do update set
  pro_enabled = excluded.pro_enabled,
  source = excluded.source,
  expires_at = excluded.expires_at;
```

For a named user, find their id from Supabase Auth first:

```sql
select id, email
from auth.users
where email = 'person@example.com';
```

Revoke the entitlement with:

```sql
update public.user_entitlements
set pro_enabled = false,
    source = 'manual',
    expires_at = now()
where user_id = 'USER_UUID_HERE';
```

Extend an existing demo:

```sql
update public.user_entitlements
set pro_enabled = true,
    source = 'manual-demo',
    expires_at = now() + interval '30 days'
where user_id = 'USER_UUID_HERE';
```

## Shopify Checkout Wiring

The upgrade modal starts checkout through:

```text
/api/create-shopify-checkout
```

That Netlify Function verifies the Supabase session and redirects the user to these Shopify product links:

- Monthly: `https://store.npvlab.com/products/npv-lab-pro-monthly?variant=43267024027761`
- Annual: `https://store.npvlab.com/products/npv-lab-pro-monthly?variant=43267033071729`

These product links are intentionally simple for the current checkout test. They do not carry the signed order attributes needed for automatic entitlement grants:

- `npv_supabase_user_id`
- `npv_plan`
- `npv_entitlement_state`

To automatically grant Pro from a webhook, switch back to a checkout/cart creation flow that carries those attributes into the Shopify order.

## Shopify Webhook

Create a Shopify webhook pointing to the deployed Netlify function:

```text
https://YOUR_NETLIFY_SITE_URL/api/shopify-webhook
```

Use JSON format. For the current one-time products, use the paid-order/payment event Shopify exposes in the webhook picker.

The function verifies Shopify's `X-Shopify-Hmac-SHA256` header, verifies the signed checkout state, then upserts `public.user_entitlements` with `pro_enabled = true`.

## Required Netlify Environment Variables

Set these in Netlify project settings before testing live checkout:

```text
SHOPIFY_WEBHOOK_SECRET=...
SHOPIFY_CHECKOUT_SIGNING_SECRET=...
SUPABASE_URL=https://uhiazxydcuxdihtgfkxg.supabase.co
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

`SHOPIFY_CHECKOUT_SIGNING_SECRET` can be any long random string. `SHOPIFY_WEBHOOK_SECRET` must match the signing secret Shopify shows for the webhook.

Optional overrides if the Shopify products change:

```text
SHOPIFY_MONTHLY_PRODUCT_URL=https://store.npvlab.com/products/npv-lab-pro-monthly?variant=43267024027761
SHOPIFY_ANNUAL_PRODUCT_URL=https://store.npvlab.com/products/npv-lab-pro-monthly?variant=43267033071729
```

## Subscription Note

The current integration treats Monthly and Annual as one-time purchases because the Shopify products are not configured as recurring subscriptions yet. That means the webhook grants Pro and nothing automatically revokes it later.

For true auto-renewing Pro plans, configure Shopify subscriptions/selling plans first. Shopify cart permalinks do not support selling plans, so the checkout creation flow should move from permalink URLs to Storefront API cart creation once subscriptions are ready.
