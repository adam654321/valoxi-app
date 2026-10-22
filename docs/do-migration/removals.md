# REMOVALS AND CHECKLIST: Replit to DigitalOcean

Tick as done, with date and commit where there is one. Nothing in §5 is ticked before
day 7 after cutover.

## 1. Code removals (phase 2)

- [ ] `vite.config.ts`: `@replit/vite-plugin-runtime-error-modal` import and plugin
- [ ] `vite.config.ts`: `@replit/vite-plugin-cartographer` conditional block
- [ ] `package.json`: `@replit/vite-plugin-runtime-error-modal`
- [ ] `package.json`: `@replit/vite-plugin-cartographer`
- [ ] `package.json`: `@replit/object-storage` (zero imports)
- [ ] `server/config.ts:39-42`: `config.replit.*` block, ONLY after the consumer grep is zero
- [ ] `server/middleware/csrf.ts:65,70`: warning text no longer names `REPLIT_DOMAINS`
- [ ] `.replit`
- [ ] `replit.md` (salvage anything useful into `docs/` first)
- [ ] `.config/` (untracked)
- [ ] `nohup.out`, `tier2-run.log`

## 2. Code additions (phase 2)

- [x] `.env.example` with every variable in `assessment.md` §3 (2026-10-22, `c1ea1a3`; 47 vars, no values; scripts-only vars other than `PROD_DATABASE_URL` deliberately omitted)
- [x] `.gitignore` includes `.env`, `.env.*` (2026-10-22, already present at `de39a9f` lines 17-19, `!.env.example` excepted; no change needed)
- [ ] `GET /api/health` (commit, node, uptime; no auth, no DB)
- [ ] Production startup assertion: `APP_URL` must be set
- [ ] `server/cron/backup.cron.ts` writes to R2 `backups/`, not `/tmp`
- [ ] `gemini-client.ts` integration warning logs once per process
- [ ] `Dockerfile`
- [ ] `.dockerignore`
- [ ] `scripts/migration/table-counts.sql` (exact counts, all tables, all sequences)
- [ ] `docs/do-migration/rehearsal-<date>.txt` (both sides, timestamped)

## 3. Accounts and infrastructure

- [ ] Neon project created in Adam's account, region decided
- [ ] Neon `main` and `dev` branches
- [ ] GitHub repo created, `main` protected, `replit-final` tag pushed
- [ ] Secret scan of git history: zero hits
- [ ] DO app created: Dockerfile, 1 instance, health check `/api/health`
- [ ] DO staging env vars set (dev DB, Clerk dev instance, Stripe test)
- [ ] Clerk dev instance: DO staging URL allowed
- [ ] Stripe test-mode webhook endpoint for staging
- [ ] DO custom domain `app.valoxi.ai` added (cert pending until DNS)
- [ ] DNS TTL lowered to 60s at T minus 24h; previous CNAME target recorded here: `________`

## 4. Secrets copied from Replit (app pane AND deployment pane)

Tick when the value is in the password manager. Never paste values into this file.

- [ ] APP_URL
- [ ] CLERK_ENABLED
- [ ] CLERK_SECRET_KEY
- [ ] CLERK_PUBLISHABLE_KEY
- [ ] VITE_CLERK_PUBLISHABLE_KEY
- [ ] CLERK_WEBHOOK_SIGNING_SECRET
- [ ] DATABASE_URL (old, Replit-owned; kept for the dump only)
- [ ] PROD_DATABASE_URL (old, Replit-owned; kept for the dump only)
- [ ] GOOGLE_GEMINI_API_KEY
- [ ] ISSUE_REPORT_RECIPIENT
- [ ] MARKETING_SITE_URL
- [ ] NYLAS_API_KEY
- [ ] NYLAS_API_URI
- [ ] NYLAS_CLIENT_ID
- [ ] NYLAS_CONNECT_GMAIL_VISIBLE
- [ ] NYLAS_CONNECT_OUTLOOK_VISIBLE
- [ ] NYLAS_REDIRECT_URI
- [ ] NYLAS_STATE_SECRET
- [ ] R2_ACCESS_KEY_ID
- [ ] R2_ACCOUNT_ID
- [ ] R2_BUCKET_NAME
- [ ] R2_SECRET_ACCESS_KEY
- [ ] RESEND_API_KEY
- [ ] RESEND_API_KEY_MARKETING
- [ ] RESEND_MARKETING_FROM_ADDRESS
- [ ] RESEND_SEGMENT_ACTIVE_SUBSCRIBERS
- [ ] RESEND_SEGMENT_ALL_USERS
- [ ] RESEND_SEGMENT_CANCELLED_SUBSCRIBERS
- [ ] RESEND_SEGMENT_PAST_DUE
- [ ] RESEND_SEGMENT_TEST_INTERNAL
- [ ] RESEND_SEGMENT_TRIALING
- [ ] RESEND_WEBHOOK_SECRET
- [ ] SESSION_SECRET
- [ ] SMTP_ALERT_EMAIL
- [ ] SMTP_FROM_EMAIL
- [ ] SMTP_HOST
- [ ] SMTP_PASS
- [ ] SMTP_PORT
- [ ] SMTP_SECURE
- [ ] SMTP_USER
- [ ] STRIPE_SECRET_KEY
- [ ] STRIPE_WEBHOOK_SECRET
- [ ] FIVE_D_BILLING_START
- [ ] TEST_INTERNAL_USER_COMPANY_ID
- [ ] NYLAS_CONNECT_GMAIL_VISIBLE must be `true` and NYLAS_CONNECT_OUTLOOK_VISIBLE `false` on DO (values came from `.replit`, see assessment.md section 11)
- [ ] Any variable present in Replit that is NOT in this list: record its name here and
      decide whether it is live: `________`

## 5. Cutover and after

- [ ] Rehearsal restore: all 92 tables and all sequences match (date: ____)
- [ ] Staging smoke list in `plan.md` 5.5: every item ticked by Adam
- [ ] 6.5 Replit deployment stopped (timestamp: ____)
- [ ] 6.6 Final dump taken and copied to a second location
- [ ] 6.7 Restore into Neon main complete
- [ ] 6.8 Final counts match both sides (file: ____)
- [ ] 6.9 Prod env vars applied to DO, redeployed, `/api/health` correct
- [ ] 6.10 DNS flipped, DO certificate active
- [ ] 6.11 Live verification by Adam (timestamp: ____). Downtime: ____ minutes
- [ ] 7.1 DNS TTL restored
- [ ] 7.2 Neon `dev` recreated from new main
- [ ] 7.3 Local `.env` and `PROD_DATABASE_URL` convention updated
- [ ] 7.4 #574 seven ALTERs applied on new prod, rollback recorded, Adam authorised
- [ ] 7.5 One week of cron observation, notes: ____
- [ ] 7.6 DO alerts configured
- [ ] 7.8 `START-HERE.md` baselines updated
- [ ] 8.1 Seven days, zero Replit traffic
- [ ] 8.2 Final Replit dump stored in R2 `backups/replit-final/`
- [ ] 8.3 Replit deployment deleted
- [ ] 8.4 Replit integrations removed from GitHub
- [ ] 8.5 Action log pack written, workstream closed
