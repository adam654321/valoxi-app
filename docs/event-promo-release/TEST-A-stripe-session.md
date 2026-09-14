# TEST A — Stripe test-mode session verification

```text
node -e "const k=process.env.STRIPE_SECRET_KEY||''; console.log('PREFIX:', k.slice(0,7)); console.log('MODE:', k.startsWith('sk_test') ? 'TEST' : k.startsWith('sk_live') ? 'LIVE' : 'UNKNOWN');"
PREFIX: sk_test
MODE: TEST

psql "$DATABASE_URL" -c "SELECT key, value FROM system_config WHERE key = 'open_access_enabled';"
         key         | value 
---------------------+-------
 open_access_enabled | true
(1 row)

curl -s -X POST http://localhost:5000/api/v2/public/checkout -H "Content-Type: application/json" -d '{"planKey":"PROFESSIONAL","interval":"month","promoSlug":"bbe-live"}'
{"checkoutUrl":"https://checkout.stripe.com/c/pay/cs_test_a1tsz9TmDSJuNtEmPenRLozsifhovQnRf1YUTQtJkS4Zfa7OoKMYh6l2uX#fidnandhYHdWcXxpYCc%2FJ2FgY2RwaXEnKSd2cGd2ZndsdXFsamtQa2x0cGBrYHZ2QGtkZ2lgYSc%2FY2RpdmApJ2JwZGZkaGppYFNkd2xka3EnPydmamtxd2ppJyknZHVsTmB8Jz8ndW5acWB2cVowNFFNcVJyN0s3d1dGdkZjd0B1X2FAczxgSzVudlJPU2RXUDVgMTV1MGI9Nm09YmMzalxkQWZzMXw1NDxMTVU3YnNSVTxzZGRuNWZifWJPM29hZ0w3dW5QMTU1NWlNdU1OYjEnKSdjd2poVmB3c2B3Jz9xd3BgKSdnZGZuYndqcGthRmppancnPycmYzwyNjQzJyknaWR8anBxUXx1YCc%2FJ3Zsa2JpYFpscWBoJyknYGtkZ2lgVWlkZmBtamlhYHd2Jz9xd3BgeCUl"}

npx tsx -e "import('stripe').then(async S => { const stripe = new S.default(process.env.STRIPE_SECRET_KEY); const list = await stripe.checkout.sessions.list({ limit: 1 }); const s = list.data[0]; console.log('SESSION:', s.id); console.log('MODE:', s.mode, '| LIVEMODE:', s.livemode); console.log('METADATA:', JSON.stringify(s.metadata)); console.log('DISCOUNTS:', JSON.stringify(s.discounts)); console.log('PAYMENT METHOD COLLECTION:', s.payment_method_collection); const full = await stripe.checkout.sessions.retrieve(s.id, { expand: ['line_items'] }); console.log('LINE ITEM PRICE:', full.line_items?.data?.[0]?.price?.id, full.line_items?.data?.[0]?.price?.lookup_key); console.log('AMOUNT TOTAL:', full.amount_total, full.currency); }).catch(e => { console.error('FAILED:', e); process.exit(1); })"
SESSION: cs_test_a1tsz9TmDSJuNtEmPenRLozsifhovQnRf1YUTQtJkS4Zfa7OoKMYh6l2uX
MODE: subscription | LIVEMODE: false
METADATA: {"billingInterval":"month","planKey":"PROFESSIONAL","promoSlug":"bbe-live"}
DISCOUNTS: []
PAYMENT METHOD COLLECTION: always
LINE ITEM PRICE: price_1TOTPw2N2rRCsCfrUZAnDWEz ma_professional_monthly_usd
AMOUNT TOTAL: 0 usd

npx tsx -e "import('stripe').then(async S => { const stripe = new S.default(process.env.STRIPE_SECRET_KEY); const list = await stripe.checkout.sessions.list({ limit: 1 }); const s = await stripe.checkout.sessions.retrieve(list.data[0].id); console.log('SUBSCRIPTION_DATA:', JSON.stringify(s.subscription_data ?? null)); console.log('TRIAL (from session):', JSON.stringify(s.subscription_details ?? null)); }).catch(e => { console.error('FAILED:', e); process.exit(1); })"
SUBSCRIPTION_DATA: null
TRIAL (from session): null

curl -s -X POST http://localhost:5000/api/v2/public/checkout -H "Content-Type: application/json" -d '{"planKey":"PROFESSIONAL","interval":"month","promoSlug":"does-not-exist"}'
{"error":"promo_not_found","message":"This promo link is not valid."}

curl -s -X POST http://localhost:5000/api/v2/public/checkout -H "Content-Type: application/json" -d '{"planKey":"PROFESSIONAL","interval":"month","promoSlug":"5d1m"}'
{"error":"fived_core_only","message":"5D New Member signup starts on Core. You can upgrade after signing up."}
```

PASS — Stripe key mode expected TEST, received TEST.

PASS — `open_access_enabled` expected `true`, received `true`.

PASS — Checkout endpoint returned a Stripe Checkout URL.

PASS — Stripe session `livemode` expected `false`, received `false`.

PASS — Session metadata `planKey` expected `PROFESSIONAL`, received `PROFESSIONAL`.

PASS — Session metadata `promoSlug` expected `bbe-live`, received `bbe-live`.

PASS — Session discounts expected empty, received `[]`.

PASS — Price lookup key expected `ma_professional_monthly_usd`, received `ma_professional_monthly_usd`.

PASS — Payment-method collection expected `always`, received `always`.

NOT RETURNED — Stripe Checkout Session retrieval returned `subscription_data: null`; no trial length is inferred.

NOT RETURNED — Stripe Checkout Session retrieval returned `subscription_details: null`; no trial length is inferred.

PASS — Unknown promo expected `promo_not_found`, received `promo_not_found`.

PASS — 5D campaign with Professional expected `fived_core_only`, received `fived_core_only`.

## Completed-checkout verification

```text
npx tsx -e "import('stripe').then(async S => { const stripe = new S.default(process.env.STRIPE_SECRET_KEY); const subs = await stripe.subscriptions.list({ limit: 1 }); const sub = subs.data[0]; if (!sub) { console.log('NO SUBSCRIPTION FOUND'); return; } const days = sub.trial_end && sub.trial_start ? (sub.trial_end - sub.trial_start) / 86400 : null; console.log('SUB:', sub.id, '| status:', sub.status, '| livemode:', sub.livemode); console.log('TRIAL START:', sub.trial_start ? new Date(sub.trial_start*1000).toISOString() : null); console.log('TRIAL END:', sub.trial_end ? new Date(sub.trial_end*1000).toISOString() : null); console.log('TRIAL LENGTH DAYS:', days); console.log('METADATA:', JSON.stringify(sub.metadata)); console.log('DISCOUNTS:', JSON.stringify(sub.discounts ?? sub.discount ?? null)); console.log('PRICE:', sub.items.data[0]?.price?.lookup_key, sub.items.data[0]?.price?.unit_amount); }).catch(e => { console.error('FAILED:', e); process.exit(1); })"
SUB: sub_1UFYd82N2rRCsCfr6q642oyw | status: trialing | livemode: false
TRIAL START: 2026-09-14T12:05:00.000Z
TRIAL END: 2026-10-14T12:05:00.000Z
TRIAL LENGTH DAYS: 30
METADATA: {"freeMonthsTotal":"1","promoSlug":"bbe-live","trial_type":"promo_free_months"}
DISCOUNTS: []
PRICE: ma_professional_monthly_usd 16700

psql "$DATABASE_URL" -c "SELECT u.id, u.email, u.user_company_id, u.assigned_promo_campaign_id, uc.company_name FROM users u JOIN user_companies uc ON uc.id = u.user_company_id ORDER BY u.id DESC LIMIT 3;"
 id  |                email                 | user_company_id | assigned_promo_campaign_id | company_name  
-----+--------------------------------------+-----------------+----------------------------+---------------
 116 | adam+7dtest@shiftopsconsulting.com   |             165 |                            | Pending Setup
 115 | adam+5d1mtest@shiftopsconsulting.com |             164 |                         15 | Pending Setup
 114 | adam+3months@valoxi.ai               |             104 |                         11 | 3 months
(3 rows)

psql "$DATABASE_URL" -c "SELECT user_company_id, plan_key, status, billing_interval, trial_ends_at, free_months_total, stripe_subscription_id FROM subscriptions ORDER BY id DESC LIMIT 3;"
 user_company_id | plan_key |  status  | billing_interval |    trial_ends_at    | free_months_total |    stripe_subscription_id    
-----------------+----------+----------+------------------+---------------------+-------------------+------------------------------
             165 | CORE     | active   | month            | 2026-08-05 23:34:49 |                 0 | sub_1TyKWN2N2rRCsCfr8JnH6GSR
             164 | CORE     | trialing | month            | 2026-08-28 23:32:34 |                 0 | sub_1TyKUC2N2rRCsCfrsHZlhY9l
             104 | CORE     | trialing | month            | 2026-09-16 14:19:38 |                 0 | sub_1Tixq32N2rRCsCfrBuEf8YVX
(3 rows)

psql "$DATABASE_URL" -c "SELECT event_type, processing_status, error_message, created_at FROM webhook_events ORDER BY id DESC LIMIT 8;"
ERROR:  column "processing_status" does not exist
LINE 1: SELECT event_type, processing_status, error_message, created...
                           ^
```

PASS — Stripe subscription status expected `trialing`, received `trialing`.

PASS — Stripe trial length expected about 30 or 31 days and not 7, received 30 days.

PASS — Stripe metadata `trial_type` expected `promo_free_months`, received `promo_free_months`.

PASS — Stripe metadata `promoSlug` expected `bbe-live`, received `bbe-live`.

PASS — Stripe discounts expected empty, received `[]`.

PASS — Stripe lookup key expected `ma_professional_monthly_usd`, received `ma_professional_monthly_usd`.

FAIL — Valoxi `plan_key` expected `PROFESSIONAL`; the completed checkout's subscription does not appear in the latest three Valoxi subscription rows.

FAIL — Valoxi status expected `trialing`; the completed checkout's subscription does not appear in the latest three Valoxi subscription rows.

FAIL — Valoxi `trial_ends_at` expected roughly one month out and not seven days; the completed checkout's subscription does not appear in the latest three Valoxi subscription rows.

FAIL — `assigned_promo_campaign_id` expected `16`; the completed checkout's user does not appear in the latest three Valoxi user rows.

FAIL — `free_months_total` expected `0`; the completed checkout's subscription does not appear in the latest three Valoxi subscription rows.

NOT DETERMINED — The prescribed webhook-events query failed because `webhook_events.processing_status` does not exist, so rows with processing status `error` could not be checked.

## Webhook-delivery verification

```text
psql "$DATABASE_URL" -c "SELECT column_name, data_type FROM information_schema.columns WHERE table_name='webhook_events' ORDER BY ordinal_position;"
   column_name   |          data_type          
-----------------+-----------------------------
 id              | integer
 source          | character varying
 event_type      | character varying
 payload         | jsonb
 status          | character varying
 error           | text
 processed_at    | timestamp without time zone
 created_at      | timestamp without time zone
 stripe_event_id | character varying
(9 rows)

rg -n "async function logWebhookEvent|function logWebhookEvent" server --glob "*.ts"
server/routes/billing.routes.ts
34:async function logWebhookEvent(

sed -n '30,69p' server/routes/billing.routes.ts
function deriveBillingInterval(lookupKey: string): BillingInterval {
  return lookupKey.toLowerCase().includes('annual') ? 'year' : 'month';
}

async function logWebhookEvent(
  eventType: string,
  stripeEventId: string | null,
  payload: unknown,
  status: string,
  error?: string
) {
  try {
    await db.insert(webhookEvents).values({
      source: 'stripe',
      stripeEventId,
      eventType,
      payload: payload as Record<string, unknown>,
      status,
      error: error ?? null,
      processedAt: new Date(),
    });
  } catch (err) {
    console.error('[Billing] Failed to log webhook event:', err);
  }
}

billingWebhookRoutes.post('/webhook/stripe', async (req: Request, res: Response) => {
  if (!config.stripe.secretKey || !config.stripe.webhookSecret) {
    console.error('[Billing] STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET not configured');
    return res.status(500).json({ error: 'stripe_not_configured' });
  }

  const stripe = new Stripe(config.stripe.secretKey);
  const signature = req.headers['stripe-signature'] as string;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      signature,

psql "$DATABASE_URL" -c "SELECT event_type, status, error, created_at FROM webhook_events ORDER BY id DESC LIMIT 10;"
          event_type           |  status   | error |         created_at         
-------------------------------+-----------+-------+----------------------------
 customer.subscription.deleted | processed |       | 2026-08-18 12:25:18.044853
 customer.subscription.deleted | processed |       | 2026-08-18 12:14:50.194994
 customer.subscription.deleted | processed |       | 2026-08-18 11:14:42.404691
 invoice.paid                  | processed |       | 2026-08-17 04:33:50.565457
 customer.subscription.updated | processed |       | 2026-08-17 03:32:55.212381
 customer.subscription.deleted | processed |       | 2026-08-16 09:55:21.205445
 customer.subscription.deleted | processed |       | 2026-08-16 09:23:41.364497
 customer.subscription.deleted | processed |       | 2026-08-15 19:54:39.088837
 customer.subscription.deleted | processed |       | 2026-08-15 19:53:10.168662
 invoice.upcoming              | processed |       | 2026-08-11 10:32:27.04295
(10 rows)

psql "$DATABASE_URL" -c "SELECT count(*) AS total, max(created_at) AS newest FROM webhook_events;"
 total |           newest           
-------+----------------------------
   195 | 2026-08-18 12:25:18.044853
(1 row)

npx tsx -e "import('stripe').then(async S => { const stripe = new S.default(process.env.STRIPE_SECRET_KEY); const eps = await stripe.webhookEndpoints.list({ limit: 10 }); console.log('ENDPOINT COUNT:', eps.data.length); eps.data.forEach(e => console.log('-', e.id, '| livemode:', e.livemode, '| status:', e.status, '| url:', e.url, '| events:', (e.enabled_events||[]).join(','))); }).catch(e => { console.error('FAILED:', e.message); })"
ENDPOINT COUNT: 1
- we_1TOS992N2rRCsCfrM2ymlgKb | livemode: false | status: disabled | url: https://85fb53ef-8f2a-4b29-b64b-c651f49dfeb5-00-2ooxl8jy2uoof.kirk.replit.dev/api/v2/billing/webhook/stripe | events: checkout.session.completed,customer.subscription.deleted,invoice.paid,invoice.payment_failed,invoice.upcoming,customer.subscription.updated

npx tsx -e "import('stripe').then(async S => { const stripe = new S.default(process.env.STRIPE_SECRET_KEY); const evs = await stripe.events.list({ limit: 10, type: 'checkout.session.completed' }); console.log('EVENTS:', evs.data.length); evs.data.forEach(e => console.log('-', e.id, new Date(e.created*1000).toISOString(), '| pending webhooks:', e.pending_webhooks)); }).catch(e => { console.error('FAILED:', e.message); })"
EVENTS: 1
- evt_1UFYd92N2rRCsCfr573YK5zy 2026-09-14T12:05:03.000Z | pending webhooks: 0

node -e "const k=process.env.STRIPE_WEBHOOK_SECRET||''; console.log('WEBHOOK SECRET PRESENT:', k.length>0, '| PREFIX:', k.slice(0,7));"
WEBHOOK SECRET PRESENT: true | PREFIX: whsec_1

rg -n "STRIPE_WEBHOOK_SECRET|constructEvent" server --glob "*.ts" | head -20
server/config.ts:57:    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
server/index.ts:81:    if (!process.env.STRIPE_WEBHOOK_SECRET) {
server/index.ts:82:      console.warn('[billing] WARNING: STRIPE_WEBHOOK_SECRET not set — webhooks will not be verified');
server/routes/billing.routes.ts:58:    console.error('[Billing] STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET not configured');
server/routes/billing.routes.ts:67:    event = stripe.webhooks.constructEvent(

rg -n "billingWebhookRoutes" server/routes/index.ts
31:import billingRoutes, { billingWebhookRoutes } from './billing.routes';
110:  app.use('/api/v2/billing', billingWebhookRoutes);

rg -n "router.post" server/routes/billing.routes.ts | head -10
815:router.post('/verify-session', isAuthenticated, validateCsrfToken, requirePermission('canManageCompany'), async (req: Request, res: Response) => {
908:router.post('/checkout', isAuthenticated, validateCsrfToken, requirePermission('canManageCompany'), async (req: Request, res: Response) => {
1098:router.post('/upgrade', isAuthenticated, validateCsrfToken, requirePermission('canManageCompany'), async (req: Request, res: Response) => {
1213:router.post('/portal', isAuthenticated, validateCsrfToken, requirePermission('canManageCompany'), async (req: Request, res: Response) => {
1249:router.post('/addon', isAuthenticated, validateCsrfToken, requirePermission('canManageCompany'), async (req: Request, res: Response) => {
1345:router.post('/remove-slot', isAuthenticated, validateCsrfToken, requirePermission('canManageCompany'), async (req: Request, res: Response) => {
1407:router.post('/remove-seat', isAuthenticated, validateCsrfToken, requirePermission('canManageCompany'), async (req: Request, res: Response) => {
1469:router.post('/cancel', isAuthenticated, validateCsrfToken, requirePermission('canManageCompany'), async (req: Request, res: Response) => {
1518:router.post('/reactivate', isAuthenticated, validateCsrfToken, requirePermission('canManageCompany'), async (req: Request, res: Response) => {
```

The real webhook-event columns are `status` and `error`.

No webhook reached this app for the September 14 test checkout. The newest logged webhook is from August 18.

Stripe emitted one `checkout.session.completed` event for the test checkout.

Stripe has one test-mode webhook endpoint and its status is `disabled`.

The Stripe webhook signing secret is present.

The full route Stripe must POST to is `/api/v2/billing/webhook/stripe`.