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