# Security Sweep — Removals / Apply Checklist

Status: ASSESS COMPLETE / APPLY NOT STARTED
Owner: Adam
Related: plan.md, assessment.md, action log v68+

Operational checklist. Items get ticked off as tiers ship.

---

## Tier 1 — Adam-direct edits (zero-Replit, urgent)

### T1.1 — .gitignore rewrite + delete repo-root DB dumps

PROD DATA CHECK first:
- [ ] Run `git log --all --diff-filter=A --name-only | grep -E '\.(sql|dump)$|backup_'` in Replit shell. If any results, the dumps are in git history — escalate to disclosure plan.

Then:
- [ ] Replace `.gitignore` with full content from apply pack
- [ ] Delete `backup_prod_20260417_115333.sql`
- [ ] Delete `backup_prod_20260417_115930.sql`
- [ ] Delete `backup_prod_20260423_precutover.sql`
- [ ] Delete `backup_prod_20260426_pre100.sql`
- [ ] Delete `backup_20260423_223324.dump`
- [ ] Delete `backup_20260423_223931.dump`
- [ ] Delete `backup_20260423_224225.dump`
- [ ] Delete `backup_20260423_224443.dump`
- [ ] Delete `backup_20260423_224623.dump`
- [ ] Delete `backup_20260423_225914.dump`
- [ ] Commit + push

### T1.2 — Supabase service role key rotation

PROD DATA CHECK first:
- [ ] Confirm Supabase project still exists in Supabase dashboard
- [ ] If yes, confirm whether the service role key has been used recently (Supabase API logs)

Then:
- [ ] Supabase dashboard → Settings → API → Reset `service_role` key
- [ ] Remove `NEXT_PUBLIC_SUPABASE_URL` from `valoxi-site/wrangler.toml`
- [ ] Remove `NEXT_PUBLIC_SUPABASE_ANON_KEY` from `valoxi-site/wrangler.toml`
- [ ] Remove `SUPABASE_SERVICE_ROLE_KEY` from `valoxi-site/wrangler.toml`
- [ ] Commit + push valoxi-site
- [ ] Verify Cloudflare auto-deploy completes

### T1.3 — Delete postMerge stanza from .replit

- [ ] Remove the `[postMerge]` stanza (3 lines) from `.replit`
- [ ] Delete `scripts/post-merge.sh` (no longer referenced)
- [ ] Commit + push

---

## Tier 2 — Combined Replit slice (before marketing M.* slices)

### T2.1 + T2.2 — Trust proxy + global rate limit + fail-closed CORS

PROD DATA CHECK first:
- [ ] Sample `RateLimit-Remaining` response headers from prod (any 2-3 authenticated requests)
- [ ] If counter shows persistent 0 for users who haven't submitted: shared-bucket failure mode
- [ ] If counter never decrements: skip-localhost failure mode
- [ ] Record finding before apply

Assess slice:
- [ ] Confirm `app.set('trust proxy', ...)` not present in server/index.ts
- [ ] Confirm `generalLimiter` and `authLimiter` imported nowhere
- [ ] Confirm publicConfigRoutes mount has no rate limit
- [ ] Confirm validateOrigin throws path
- [ ] Confirm publicCors next() path

Apply:
- [ ] Add `app.set('trust proxy', 1)` to server/index.ts (top of express setup, before any middleware)
- [ ] Apply `generalLimiter` globally after body parsers, before registerRoutes
- [ ] Add IP-keyed limiter to publicConfigRoutes mount (600/15min/IP, polling-friendly)
- [ ] Add light limiter to webhook routes mount (100/min/IP)
- [ ] Add limiter to publicTeamRoutes mount (50/15min/IP)
- [ ] Delete `authLimiter` export from rate-limit.ts
- [ ] validateOrigin: throw at module load if APP_URL/REPLIT_DOMAINS unset in prod (NODE_ENV check)
- [ ] publicCors: 403 if Origin header set but doesn't match allowed list

V-check:
- [ ] TSC clean (baseline still 1 error: portal.service.ts:81)
- [ ] Dev workflow restart, curl from localhost confirms rate limit headers present
- [ ] Cross-origin POST from valoxi.ai test domain to /api/v2/public/checkout returns 200 with correct CORS headers
- [ ] Cross-origin POST from `evil.com` to same returns 403
- [ ] grep `app.set('trust proxy'` returns 1 hit in server/index.ts
- [ ] grep `generalLimiter` returns 2+ hits (declaration + at least one apply)
- [ ] grep `authLimiter` returns 0 hits
- [ ] Localhost dev still bypasses rate limits (isLocalhost check fires correctly)

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