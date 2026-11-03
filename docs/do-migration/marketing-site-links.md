# Marketing site links and promo slugs: migration impact

**Checked:** 2026-11-03. **Thread:** Valoxi. Read-only audit; nothing in the site folder was edited.
**Site folder:** `C:\Users\AdamAuty\Documents\Auty Consultancy Automation\Website\Valoxi - Copy - Copy\valoxi-site`
**Scope:** `src`, `public`, `functions` only. `.next`, `out`, `node_modules`, scratch scripts and screenshots were not audited, except `out/` and the live site for the baked API host.

## Verdict

Nothing on the marketing site needs to change for the cutover to work, provided the three conditions in section 5 hold. The site reaches the app only through the domain `app.valoxi.ai`, which the DNS flip repoints. The promo slugs live in the app database and survived the restore.

## 1. How the site depends on the app

| Link / call | Where | Cutover effect |
|---|---|---|
| `https://app.valoxi.ai/sign-in` (3 links) | `src/app/event/EventOffer.tsx` and others | Follows DNS. No change |
| `GET {APP}/api/v2/public/config` (open-access flag, Nylas flags) | `src/lib/api.ts`, `ConfigProvider.tsx`, `layout.tsx` | Follows DNS. Needs CORS and `open_access_enabled` in the DB |
| `POST {APP}/api/v2/public/checkout` (`{planKey, interval, promoSlug?}`) | `PricingToggle.tsx`, `EventOffer.tsx` | Follows DNS. Needs promo rows and live Stripe coupons |
| `POST app.valoxi.ai/api/v2/public/waitlist` | site forms | Follows DNS |
| `functions/api/contact.ts` | Cloudflare Pages Function | Not app dependent |
| Email CTA `https://valoxi.ai/?promo=5d` | `server/email.service.ts:917` | Points at the site, not the app. No change |

`APP_BASE` = `NEXT_PUBLIC_VALOXI_API_BASE` or the default `https://app.valoxi.ai`. It is inlined at BUILD time.

## 2. The discounted sign-up slugs

Two routes carry a slug: `/?promo=<slug>` on the homepage (`PricingToggle.tsx`) and `/event` (fixed `bbe-live`). The site sends the slug to the app; the mapping lives in the app table `promo_code_campaigns`, so no slug is stored in the site.

Verified on Neon `dev` (restored from the prod dump), read-only, 2026-11-03:

| slug | active | expires | free months | claim cap | Stripe coupon present |
|---|---|---|---|---|---|
| `5d-community` | yes | none | 0 | none | yes |
| `early-bird` | NO | none | 0 | none | yes |
| `5d` | yes | none | 3 | none | yes (+ post-free coupon) |
| `welcome` | yes | none | 0 | none | yes |
| `5d1m` | yes | none | 1 | none | yes (+ post-free coupon) |
| `bbe-live` | yes | **2026-10-03 22:00 UTC (passed)** | 1 | 400 | yes |

`open_access_enabled` = `true` in `system_config`. All six rows came through the restore, so the slugs keep working after cutover as long as the same database is restored.

## 3. Findings

1. **`/event` is an intentionally expired campaign (Adam confirmed 2026-11-03).** `bbe-live` was the time-limited Business Buying Experience Live offer and expired 2026-10-03, so the app returns `promo_not_found` and the page's button shows its error state. Not a migration issue and nothing to fix. The page is `noindex`. Optional later: delete `src/app/event/` and rebuild the site. Inferred from the dump data; a live probe was blocked because it could create a Stripe object.
2. **Stale local build with the Replit dev host baked in.** `valoxi-site/out/` (built 2026-09-18) has `PUBLIC_CHECKOUT_URL` and `PUBLIC_CONFIG_URL` hardcoded to a `*.kirk.replit.dev` host, because `.env.local` sets `NEXT_PUBLIC_VALOXI_API_BASE` to it. The LIVE site is fine: its deployed JavaScript points at `https://app.valoxi.ai` (checked 2026-11-03). Risk: deploying from this folder as-is would silently point checkout at a dead Replit dev app. Fix before the next site deploy: remove or repoint that `.env.local` line, then rebuild.
3. **Legal pages name Replit as the processor.** `src/app/privacy/page.tsx` (lines 260, 312, 354) and `src/app/dpa/page.tsx` (line 277) list "Replit, Inc., application hosting and database, United States, SCCs". After cutover the processors are DigitalOcean (hosting) and Neon (database, eu-west-2 London), plus Cloudflare for R2 if documents are covered. Needs a legal update, with the international transfer wording (the data moves from the US to the UK/EU) and the DPA Schedule 2 sub-processor list.
4. **Stripe coupons are live-mode IDs.** Promo campaigns store Stripe coupon IDs. On staging (Stripe TEST keys) a promo checkout will fail because those coupons do not exist in test mode. Expected; not a bug. After cutover (live keys) they resolve.

## 4. Baseline of the live integration (Replit prod, before cutover)

`node scripts/migration/check-marketing-integration.mjs` against `https://app.valoxi.ai` with origin `https://valoxi.ai`: 9 of 9 PASS (config 200 and flags, CORS allow and foreign-origin 403, checkout preflight 204, checkout reaches the promo lookup with an unknown slug, `/sign-in` 200). The script creates nothing in Stripe.

## 5. Conditions for the cutover to be invisible to the site

1. `MARKETING_SITE_URL` on DO prod is UNSET or exactly `https://valoxi.ai` (no trailing slash, no `www`). The public CORS allowlist is that single origin in production (`server/middleware/public-cors.ts`).
2. DO prod runs with `NODE_ENV=production` (the Dockerfile sets it), otherwise the production CORS branch changes.
3. The final restore carries `promo_code_campaigns` and `system_config` unchanged (reconciliation 6.8 covers it).

## 6. Add to plan 6.11 (verify live)

Run `node scripts/migration/check-marketing-integration.mjs https://app.valoxi.ai https://valoxi.ai` and require 9 of 9 PASS. Then in a browser open `https://valoxi.ai/?promo=5d`, click through to Stripe Checkout, confirm the discount shows, and CLOSE the tab without paying. That creates one unpaid Stripe session, which is acceptable at cutover and proves live Stripe coupons resolve.
