# Black Friday 2026: Replit prompt (old prod, data only)

Written 2026-11-12. The offer page is live at `valoxi.ai/black-friday/` (also `/event/`). Its two buttons
post to `app.valoxi.ai/api/v2/public/checkout` with slugs `bf26-free-month` and `bf26-annual`.

No code change is needed anywhere: `public-checkout.routes.ts`, `promo-code.service.ts` and the
`promo_code_campaigns` schema are identical on `replit-final` and `main`. The two rows reach new prod in
the cutover dump on 24 Nov; the coupon lives in Stripe. Cutover checks are in `cutover-timeline.md`.

## Step 1 (Adam, in the Stripe dashboard, LIVE mode, before the prompt)

Create a coupon:

- ID: `BF26_ANNUAL_PRO`
- Type: fixed amount, 686.16 USD
- Duration: multiple months, 1 month (see the note below)
- Applies to: the Professional product only

Why not "once": the annual checkout starts with the standard 7-day trial. It is not confirmed that a
"once" coupon survives the $0 trial invoice. One month covers the first real charge on day 7 either way
and has lapsed long before the renewal.

$1,603.20 (annual Professional, confirmed from a live session 2026-11-12) less $686.16 is $917.04, which is 54.2% less than 12 x $167.

## Step 2: paste this into Replit Agent

```
This is a DATA-ONLY task on the PRODUCTION database. Do not change any code, schema, migration,
secret or environment variable. Do not deploy or restart anything. Never print secrets or
connection strings. If anything below does not match what you find, STOP and report; do not
improvise a fix.

Context: the marketing site has a Black Friday page whose two buttons POST to
/api/v2/public/checkout with planKey PROFESSIONAL and promoSlug "bf26-free-month" (interval month)
or "bf26-annual" (interval year). Both slugs need a row in promo_code_campaigns. The existing
checkout code already handles both shapes; it must not be edited.

Step 1, read only. Against the PRODUCTION database, run and show me the output of:

  select id, name, slug, stripe_coupon_id, referral_source, free_months_total, max_total_claims,
         is_active, expires_at, post_free_period_coupon_id
  from promo_code_campaigns
  where slug in ('bbe-live', 'bf26-free-month', 'bf26-annual');

Confirm which database you ran it on. If either bf26 slug already exists, STOP and report.

Step 2, read only. Using the live Stripe key already in the environment, retrieve the coupon
BF26_ANNUAL_PRO and show its id, amount_off, currency, duration, duration_in_months, valid and
applies_to. It must be amount_off 68616, currency usd, valid true. If it is missing or different,
STOP and report. Do not create or edit any coupon.

Step 3, the only write. In ONE transaction on the PRODUCTION database:

  insert into promo_code_campaigns
    (name, slug, stripe_coupon_id, referral_source, free_months_total, max_total_claims,
     is_active, expires_at, post_free_period_coupon_id)
  values
    ('Black Friday 2026: one month free (Professional monthly)', 'bf26-free-month',
     'UNUSED_TRIAL_ONLY', 'black_friday_2026', 1, null, true, '2026-12-01 00:00:00', null),
    ('Black Friday 2026: 54% off first year (Professional annual)', 'bf26-annual',
     'BF26_ANNUAL_PRO', 'black_friday_2026', 0, null, true, '2026-12-01 00:00:00', null)
  on conflict (slug) do nothing
  returning id, slug;

It must return exactly 2 rows. If not, roll back and report. expires_at is UTC (the column has no
time zone, same as the bbe-live row). Then re-run the Step 1 query and show the result.

Step 4, verify against the production app, without paying. Run both of these and show the HTTP
status and whether a checkoutUrl came back (do not print the full URL):

  curl -s -X POST https://app.valoxi.ai/api/v2/public/checkout -H "Content-Type: application/json" \
    -d '{"planKey":"PROFESSIONAL","interval":"month","promoSlug":"bf26-free-month"}'

  curl -s -X POST https://app.valoxi.ai/api/v2/public/checkout -H "Content-Type: application/json" \
    -d '{"planKey":"PROFESSIONAL","interval":"year","promoSlug":"bf26-annual"}'

For each session created, retrieve it from Stripe (expand line_items and total_details.breakdown)
and report: amount_subtotal, amount_total, the discount applied (coupon id and amount), and the
subscription trial length. Expected:
  - bf26-free-month: no discount, trial of about one calendar month, price 16700 a month.
  - bf26-annual: coupon BF26_ANNUAL_PRO, discount 68616 on a 160320 annual price, 7-day trial.
Do not open or complete either checkout. Leave the sessions to expire.

Step 5. Report in a short list: database used, the two new row ids, the coupon details, and the
Step 4 results. State clearly anything that did not match the expected values.
```

If Replit Agent cannot reach the production database, run the Step 3 SQL yourself in the Replit
production database pane, then do the two curl calls from any terminal.

## Step 3 (Adam, by hand, before sending the link to anyone)

On `valoxi.ai/black-friday/` click each button and read the Stripe Checkout page: the free month must
show a trial then $167 a month; the annual must show $917.04 due after the 7-day trial. Do not pay.

## Optional: staging

To see it on DO staging first, create the same coupon in Stripe TEST mode and run the Step 3 insert on
the Neon `dev` branch. Staging uses test keys, so the live coupon does not exist there.
