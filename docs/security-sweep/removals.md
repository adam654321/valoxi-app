# Security Sweep — Removals / Apply Checklist

Status: T1 substance APPLIED (T1.2 valoxi-site outstanding) / T2 APPLIED + PROD VERIFIED (2026-05-28, action log v69) / T3+ post-launch
Owner: Adam
Related: plan.md, assessment.md, action log v68+, lessons.md (LN-012, LN-013)

Operational checklist. Items get ticked off as tiers ship.

---

## Tier 1 — Adam-direct edits (zero-Replit, urgent)

### T1.1 — .gitignore rewrite + delete repo-root DB dumps — APPLIED (substance, 2026-05)

PROD DATA CHECK:
- [x] Run `git log --all --diff-filter=A --name-only | grep -E '\.(sql|dump)$|backup_'` in Replit shell. Result: 12 PII files in history. Scenario 1 (Replit-only remote) → bounded blast radius. Deferred git filter-repo to a coordinated weekend within 30 days (team re-clone required after force-push).

Applied:
- [x] `.gitignore` rewrite landed (full patterns: *.sql, *.dump, backup_*, .env*, *.pem, uploads/, attached_assets/, .local/, *.tar.gz)
- [x] All 10 backup_*.sql / backup_*.dump files deleted from repo root
- [x] Commit + push landed

Outstanding (T1.1-DEFERRED):
- [ ] `git filter-repo` to scrub 12 PII files from history — coordinated weekend within 30 days

### T1.2 — Supabase service role key — RE-SCOPED, outstanding (Adam-direct on valoxi-site)

PROD DATA CHECK result:
- [x] Supabase project DELETED. Key rotation moot; remove-from-wrangler step is the only remaining work.

Outstanding:
- [ ] Remove `NEXT_PUBLIC_SUPABASE_URL` from `valoxi-site/wrangler.toml`
- [ ] Remove `NEXT_PUBLIC_SUPABASE_ANON_KEY` from `valoxi-site/wrangler.toml`
- [ ] Remove `SUPABASE_SERVICE_ROLE_KEY` from `valoxi-site/wrangler.toml`
- [ ] Commit + push valoxi-site; verify Cloudflare auto-deploy

### T1.3 — postMerge stanza in .replit — APPLIED in substance (2026-05)

- [x] `scripts/post-merge.sh` deleted (no longer on disk)
- [x] `[postMerge]` stanza neutralised in `.replit` (path="", timeoutMs=0 — cannot execute)
- [ ] Cosmetic full-stanza removal (3 lines) outstanding. Defer to T5 cleanup; functional risk is closed.

---

## Tier 2 — Combined Replit slice (before marketing M.* slices)

### T2.1 + T2.2 — Trust proxy + global rate limit + fail-closed CORS — APPLIED + PROD VERIFIED (2026-05-28, v69)

PROD DATA CHECK — REVISED:
The originally-spec'd check (sample RateLimit-Remaining on authenticated requests) was mis-targeted. Authenticated limiters are user-keyed and behave identically regardless of trust-proxy state. The decisive question was hop count, settled by architecture: `app.valoxi.ai` is DNS-only to Replit autoscale (one LB hop), so `trust proxy: 1` is correct. No diagnostic needed.

Pre-applied state in pull (17), unverified via Replit checkpoint commit:
- [x] `app.set('trust proxy', 1)` already present in `server/routes.ts` (NOT server/index.ts as planned — the actual express setup entrypoint)
- [x] `generalLimiter` already imported and mounted globally as `app.use('/api/', generalLimiter)` in `server/routes.ts`

Verified-in-place by this slice via prod curl: both behave correctly.

Applied (this slice, verified):
- [x] `publicCors` rewritten — multi-origin allowlist (prod `config.marketing.siteUrl` always, `localhost:3000`/`127.0.0.1:3000` ONLY when `config.server.isProduction` is false), explicit 403 + `CORS_ORIGIN_REJECTED` body when Origin is set but disallowed, no-Origin requests pass through unchanged
- [x] `validateOrigin`: throws at module load when allowlist empty AND `NODE_ENV=production`; dev keeps the runtime fail-open warn
- [x] Dead `authLimiter` export deleted from `rate-limit.ts`

NOT applied by design (scope changed from removals.md original):
- ~~publicConfigRoutes limiter (600/15min/IP)~~ — `generalLimiter` on `/api/` now covers it, dedicated limiter is now defence-in-depth not a gap. Deferred to T3 if traffic justifies.
- ~~Webhook routes limiter (100/min/IP)~~ — same. Inversely, *exclusion* of webhook paths from generalLimiter is a real defence-in-depth item — see T2-CARRY below.
- ~~publicTeamRoutes limiter (50/15min/IP)~~ — same.

V-check:
- [x] TSC clean — exactly 1 pre-existing error, portal.service.ts:81
- [x] grep authLimiter → 0 hits, generalLimiter → 3 hits (export + import + apply)
- [x] Dev curl: localhost:3002 → 200 + ACAO, evil.com → 403 + CORS_ORIGIN_REJECTED, no-Origin → 200, OPTIONS → 204 + ACAO
- [x] validateOrigin throw gate: NODE_ENV=production → throws; NODE_ENV=development → warn only
- [x] Prod-mode simulation in dev (`MARKETING_SITE_URL=https://valoxi.ai NODE_ENV=production`): valoxi.ai accepted, localhost rejected, evil.com rejected
- [x] PROD curl post-deploy: OPTIONS valoxi.ai → 204 + ACAO, GET valoxi.ai → 200 + ACAO, GET evil.com → 403 no ACAO

### T2-CARRY — items uncovered during T2 that defer to T3

- [ ] **T3.9 (NEW) — Exclude webhook paths from generalLimiter.** Webhooks are signature-verified and idempotent (dedup via webhook_events). They key on the provider IP under generalLimiter, so all of Stripe shares one 1000/15min bucket. A Stripe event replay or burst could 429 legitimate webhooks on the money path. Fix: add webhook paths to generalLimiter's `skip` (match `req.originalUrl`, not `req.path`, because inside the limiter mounted at `/api/` paths are mount-relative).
- [ ] **T3.10 (NEW) — Re-home checkout off waitlistLimiter.** Checkout currently sits on `waitlistLimiter` (10/15min/IP), tight for declined-card retries or NAT'd buyers. Dedicated `checkoutLimiter` at ~30/15min/IP. Lost-revenue risk only if volume justifies; defer until M.* live.
- [ ] **T3.11 (NEW) — Swap publicConfigRoutes mount order above publicCheckoutRoutes.** PROD-VERIFIED finding 2026-05-28: GET `/api/v2/public/config` currently returns `ratelimit-policy: 10;w=900` because Express walks the publicCheckoutRoutes mount first (sharing prefix `/api/v2/public`); waitlistLimiter decrements before the router falls through to publicConfigRoutes. Pre-existing, not a T2 regression. **Must land before M.3 ships** — every Cloudflare visitor will pull /config on every page load, burning waitlistLimiter tokens instead of generalLimiter tokens.

---

## Tier 3 — Post-launch defence-in-depth (individual slices)

### T3.1 — Stripe webhook returns 500 not 200 on internal error
- [ ] billing.routes.ts outer catch block returns 500
- [ ] Verify Stripe retries on synthetic 500 (test mode)

### T3.2 — Stripe customer.metadata cross-check
- [ ] billing.routes.ts:95 cross-checks session.metadata.userCompanyId against customer.metadata.userCompanyId
- [ ] Mismatch logs DOUBLE-PAYMENT-ALERT-CLASS event and refuses provisioning

### T3.3 — Waitlist endpoint stops disclosing email enumeration
- [ ] public-waitlist.routes.ts returns identical 201 regardless of pre-existing
- [ ] Confirmation email skip logic moves server-side (CF function no longer reads alreadyRegistered flag)

### T3.4 — nosniff + CSP sandbox in serveFile()
- [ ] documents-files.routes.ts serveFile() sets `X-Content-Type-Options: nosniff`
- [ ] Sets `Content-Security-Policy: default-src 'none'; sandbox` (or chosen shape — open decision #7)
- [ ] Hits all file-serving paths uniformly

### T3.5 — pg_try_advisory_lock on cron handlers
- [ ] Each cron handler in billing.cron.ts, chase-up.cron.ts, backup.cron.ts wrapped in `SELECT pg_try_advisory_lock(LOCK_ID)`
- [ ] Skip-on-fail-to-acquire with log message
- [ ] Unique LOCK_ID per cron handler

### T3.6 — Orphan-revoke 60s buffer
- [ ] handleUserCreated queues revoke decision with 60s delay
- [ ] Re-check user matching at delay end
- [ ] If matched, drop revoke; if still unmatched, revoke
- [ ] Mechanism (in-memory vs DB-backed) — open decision #4

### T3.7 — Beta-feedback screenshot endpoint ownership scoping
- [ ] beta-feedback.routes.ts /screenshot/:key checks requested key against betaFeedback.screenshotUrl for a row the requesting user owns OR isSystemAdmin
- [ ] 403 on mismatch

### T3.8 — Backup strategy decision + implementation
- [ ] Decision recorded (open decision #5): Neon snapshot branches vs Replit Object Storage vs document-only
- [ ] If Neon: cron script invokes Neon API to create snapshot branch
- [ ] If Object Storage: cron pushes gzipped dump to replit-objstore-*
- [ ] If document-only: delete backup.cron.ts, document Neon's automatic backups in replit.md
- [ ] Existing cron either updated or removed

---

## Tier 4 — Operational hardening (sequenced)

### T4.1 — validateConfig() at boot
- [ ] New function `validateConfig()` in server/config.ts
- [ ] Required list in prod: DATABASE_URL, SESSION_SECRET, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, GOOGLE_GEMINI_API_KEY, CLERK_WEBHOOK_SIGNING_SECRET
- [ ] Called at bottom of server/index.ts, throws if any required missing and NODE_ENV=production
- [ ] Existing console.warns kept for dev visibility

### T4.2 — Rename smtp.alertEmail to alerts.recipientEmail
- [ ] server/config.ts: introduce `alerts.recipientEmail` reading new ALERTS_RECIPIENT_EMAIL env var
- [ ] Fallback to SMTP_ALERT_EMAIL during transition
- [ ] billing.cron.ts updated to use new key
- [ ] Drop the rest of the smtp block from config.ts
- [ ] Drop SMTP_* env vars from Replit secrets manager

### T4.3 — admin-tools /switch-plan audit-or-remove
- [ ] Decision recorded (open decision #6): keep with audit log or remove
- [ ] If keep: insert admin_action_log row on every switch
- [ ] If remove: delete admin-tools.routes.ts, remove /switch-plan UI in frontend, drop betaPlanOverride column

### T4.4 — Admin user reactivation endpoint
- [ ] POST /api/v2/admin/users/:id/reactivate added to admin.routes.ts
- [ ] Flips isActive=true AND clears clerk_user_id (allows re-signup)
- [ ] Inserts admin_action_log row
- [ ] isSystemAdmin gated

### T4.5 — revokeOrphanClerk 500 + audit log
- [ ] webhooks.routes.ts: when clerkClient.users.deleteUser fails, return 500 from handler (triggers Clerk retry)
- [ ] On every revoke (success or failure), insert security_event_log row with (clerkUserId, email, reason, timestamp)

### T4.6 — valoxi-site contact form honeypot + CF rate limit
- [ ] Add hidden honeypot field to RegisterForm/contact form
- [ ] Server-side: reject if honeypot field populated
- [ ] Cloudflare dashboard: add rate-limit rule on /api/contact path (e.g. 5/min/IP)

---

## Tier 5 — Cleanup (opportunistic)

### T5.1 — beta_feedback → issue_reports consolidation
- [ ] DROP TABLE issue_reports (0 prod rows, 4 dev rows — verify on dev first)
- [ ] Rename beta_feedback table → issue_reports
- [ ] Rename server/routes/beta-feedback.routes.ts → issue-reports.routes.ts
- [ ] routes/index.ts: repath /api/v2/beta-feedback → /api/v2/issue-reports
- [ ] Update client to call new path
- [ ] Drop server/routes/beta.routes.ts if /config is no longer needed by admin-tools (verify first)
- [ ] Remove BETA_MODE and VITE_BETA_MODE from .replit userenv.shared

### T5.2 — Dead env var sweep
- [ ] Remove OPEN_ACCESS_ENABLED from Replit secrets manager
- [ ] Remove RESEND_SEGMENT_SIGNED_UP_NO_PLAN from Replit secrets manager

### T5.3 — Test scripts production guard
- [ ] server/scripts/test-dunning-day7.ts: add `if (NODE_ENV==='production') process.exit(1)` at top
- [ ] Same for test-dunning-day14.ts, test-dunning-phase4.ts, test-dunning-state.ts, test-trial-expiry.ts