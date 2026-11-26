# RESUME: do-migration

**Updated:** 2026-10-23 UK
**Thread:** Valoxi, Replit to DigitalOcean. Nothing else.

## State
- Phase 0: Neon project created (billowing-block-98253807, eu-west-2). GitHub repo done. DO project, DNS host, secrets export, cutover window still NOT YET.
- Phase 1 and 2: Gates PASSED (see assessment.md sections 10 and 12).
- Phase 3: DONE 2026-10-23 (assessment.md section 13). Repo https://github.com/adam654321/valoxi-app. `main` and tag `replit-final` (de39a9f) pushed by Adam. Replit remotes removed; only `origin` remains. History scan: no real secret.
- Phase 4: DONE 2026-10-23 (assessment.md sections 14 and 14.1). 94 tables, not 92. rehearsal = ep-lingering-mode-zalkfz3h (expires). dev = ep-frosty-mode-zapfrf2v, restored from the same dump, vitest 34/559 on it. Local .env still points at throwaway; switching to dev is Adam's call.
- Git credentials on this machine are GitHub user AdamValoxi (collaborator on the repo). Pushes are run by Adam with the `!` prefix; the auto-mode classifier blocks `git push`.
- The Phase 3 docs commit is local until Adam pushes it.
- Prod not contacted. Local .env holds DATABASE_URL for the throwaway branch only (gitignored).

## Phase 5 prepared 2026-10-23: .do/app.yaml and docs/do-migration/phase5-staging.md (branch phase-5-do-spec). Needs Adam: DO project, Clerk dev instance, Stripe test keys, R2 bucket choice.

## Staging smoke 2026-10-28 (Adam, by hand)
- Logged in to the DO staging app, test run completed. Deal modeller works.
- NOT tested: client portal and sending the offer letter (both need email; RESEND_API_KEY deliberately unset on staging, safeguard 1).
- Open: backup-cron R2 round trip still outstanding; R2 bucket choice unrecorded.

## Resume point 2026-10-28 (reboot)
- Goal: test client portal and offer letter on staging. Email is blocked because RESEND_API_KEY is deliberately unset (safeguard 1; crons start unconditionally, so a live key could mail real customers from the dev DB).
- Plan agreed (Adam said run both checks):
  1. Scan Neon `dev` for real customer emails (read-only, counts and domains only, no addresses printed). Script: `scan.cjs` in the session scratchpad (`%TEMP%\claude\C--Users-AdamAuty-valoxi\1a196b74-18d5-4b70-b606-3a7bd67a1503\scratchpad\scan.cjs`; may need recreating). Reads DST_URL from `.env.dev`.
  2. Portal without email: portal URL is `${baseUrl}/portal/${accessToken}` (server/services/email.service.ts:58). Token is saved before the send (portal.service.ts:60-85), so create the link in staging, then read accessToken from `dev` and open the URL. The link is not logged.
- BLOCKER: `.env.dev` DST_URL fails with "password authentication failed for user 'neondb_owner'" (dev branch, eu-west-2). Likely stale or rotated. No other credentials were tried.
- Next action (needs Adam): put a fresh DIRECT connection string for the Neon `dev` branch into `.env.dev` as DST_URL, then say so. Claude then runs scan (1), then pulls the portal token (2).
- If dev has real customer emails: scrub or swap them before any Resend key goes on staging. If clean: create a staging-only Resend key, set RESEND_API_KEY only (not marketing key, webhook secret, segments, Nylas), and set ISSUE_REPORT_RECIPIENT to Adam's own address. This covers the offer letter send.
- Tested OK: login, deal modeller. Not tested yet: portal, offer letter send.

## Update 2026-10-28 (later): dev rebuilt, scan done
- Old `dev` and `rehearsal` branches EXPIRED (1-day timer). Production branch is empty by design.
- New `dev` branch created from production, NO expiry: ep-ancient-breeze-zaso9i43 (eu-west-2). Restored from rehearsal/valoxi-rehearsal.dump (exit 0, 98 relations = 94 tables + 4 views). `.env.dev` DST_URL points at it.
- Email scan result: dev HAS REAL customer emails (users 88, waitlist 83, beta_feedback 85, target_contacts 52, target_companies 68, marketing_consent_tokens 37, nylas_grants 6). Do NOT put a live Resend key on staging until scrubbed or the key is provably restricted (unverified-domain Resend account only delivers to its owner).
- SCRUBBED 2026-10-28: all emails on dev (users, waitlist, beta_feedback, target_companies, target_contacts, consent tokens, nylas_grants, user_companies, user_invitations, chase_up sent_to_contacts, broadcasts, system_config partner invoice email, offer/deal json, webhook payloads) rewritten to adam+<hash>@shiftopsconsulting.com or @valoxi.ai. Kept: adam@shiftopsconsulting.com, adam@valoxi.ai. Re-scan: only those two domains remain. Names and other PII NOT scrubbed. nylas_grants rows still carry real grant ids: keep Nylas unset on staging.
- TODO Adam: point DO staging DATABASE_URL at the new dev endpoint and redeploy (old endpoint ep-frosty-mode-zapfrf2v is gone).

## Staging smoke PASSED 2026-11-02 (Adam, by hand)
- Offer sent through the client portal, emails received, offer letter PDF downloaded and correct. Portal + email + offer letter now verified on staging.
- Latest commit on branch fix-template-path: 6c45322 (deal document templates resolve by bundled filename when stored path is missing). Merged to main via PR #5 (e1eb6f2).
- Still open: backup-cron R2 round trip, R2 bucket choice, Finding C, branch protection on main, DO build-time vars.

## Backup R2 round trip PASSED 2026-11-03
- Staging R2 bucket = `valoxi-documents-dev` (prod `valoxi-documents` untouched), token scoped to that bucket. Decision recorded.
- `scripts/verify-backup-r2.ts` (PR #6) run in DO console on commit cfa8291: pg_dump 18 -> 9,587,380 byte dump -> upload/head/download MATCH/list/delete OK.
- Real 02:00 UK cron run CONFIRMED 2026-11-03: `backups/backup-2026-11-03.sql.gz` present in `valoxi-documents-dev` (Adam checked in Cloudflare). Plan 5.5 closed.
- DO build-time vars confirmed 2026-11-03: VITE_CLERK_PUBLISHABLE_KEY present; GIT_SHA moved from RUN_TIME to BUILD_TIME by Adam.

## Cutover readiness drafted 2026-11-03
- docs/do-migration/cutover-readiness.md: Gate 0 true status, 8 stale/incomplete plan items, ordered pre-cutover checklist. plan.md stale items FIXED on branch plan-md-fixes (2026-11-03, pending PR). Open for Adam: 0.5 DNS host + current CNAME, 0.6 secrets export, 0.7 cutover date, DO region note, Neon PITR plan check.

## Gate 0 answers 2026-11-03
- DO region LON1, DNS host Cloudflare (recorded in assessment.md section 0). Current app.valoxi.ai = A 34.111.179.208 + TXT replit-verify (no CNAME).
- DPA 5.2 needs 14 days' notice before the sub-processor change: publish updated Schedule 2 first, cutover no earlier than +14 days. Draft: docs/do-migration/legal-processor-update-DRAFT.md (needs lawyer review).
- Still open: secrets export (0.6), cutover date (0.7), delete NEXT_PUBLIC_VALOXI_API_BASE from valoxi-site .env.local (Replit dev host).

## Rehearsal scripts 2026-11-03 (branch rehearsal-scripts)
- scripts/migration/check-clerk-ids.mjs, check-stripe-subs.mjs, rehearsal-lib.mjs (+ test): read-only, refuse old prod, support --dry-run. Dry-run on dev OK (users 88, 53 with clerk id; subs 52, 34 with stripe id). Runbook: cutover-readiness.md section 5.
- Window decided: weeknight evening, not Wednesday, ~19:00-20:00, 90-minute go/no-go. Date TBD (>= 14 days after Schedule 2 notice).

## Rehearsal restore in progress 2026-11-03
- Neon branch `rehearsal-2` = ep-calm-smoke-za9wqm88 (eu-west-2, PG 18.6, empty, no expiry), URL in gitignored .env.rehearsal. Viv (users.id 2) re-linked on dev: email viv@shiftopsconsulting.com, clerk_user_id NULL (rollback json in session scratchpad); Gmail draft to Viv saved, staging URL https://squid-app-5dwfn.ondigitalocean.app/.
- Docker route hung (0 bytes after 30 min). Replaced by scripts/migration/rehearsal-run.ps1 (PowerShell, local PG18 client). Tested against dev stand-in: 94 COUNT lines, dump 9.96 MB in 8 s, guards refuse dev/old-prod/pooled/wrong host. DONE 2026-11-03 (rehearsal-2026-11-03.txt): dump 38 s (10,147,614 B), restore 22 s exit 0, 94 tables and 92 sequences match, only live `session` row drifts (909 vs 908). NEXT: Clerk-ID check and Stripe subscription check on rehearsal-2 (Adam runs with prod keys), plus structure-checks.sql.

## Next action (needs Adam)
1. DONE: branch protection on `main` (plan 3.4), ruleset `protect-main` active: no deletion, no force push, PR required. Verified via API 2026-11-03.
2. Say go for Phase 4 (rehearsal restore). Adam runs the prod pg_dump (client must be PostgreSQL 18 or newer). I do not touch prod.
3. Set NYLAS_CONNECT_GMAIL_VISIBLE=true on DO later (assessment.md section 11).

## Deferred / deploy-dependent
- Finding C: FIXED, merged PR #7 (2026-11-03). One allowlist guard in vitest setupFiles (server/test-utils/db-host-guard.ts), default allowed endpoint = Neon dev `ep-ancient-breeze-zaso9i43`; extra via TEST_DB_ALLOWED_ENDPOINTS. Old/`.prod.` hosts always blocked. Five inline guards removed. Run against Neon dev 2026-11-03: 35/35 files, 565/565 tests (559 baseline + 6 new). Needs GOOGLE_GEMINI_API_KEY=placeholder-not-a-real-key to collect 3 files (assessment.md line 284).
- Uncommitted, not mine: scripts/send-marketing-consent-emails.ts modified, _to_delete/ untracked. Left alone.

## Billing cancel guards (branch billing-cancel-guards)
Found by the rehearsal-2 Stripe check: 5 subs (39, 44, 68, 104 real; 35 test) had DB active/past_due but Stripe canceled.
Cause: invoice.paid / invoice.payment_failed ignored a cancelled sub and flipped it back to active/past_due; the dunning job then
retried the Stripe cancel every night forever. Fixes: (1) invoice events skip cancelled subs (billing.routes.ts), (2) dunning job
reconciles an already-cancelled sub instead of looping (billing-guards.ts), (3) daily 08:30 London report-only reconciliation email
to SMTP_ALERT_EMAIL (stripe-reconciliation.service.ts). Tests: 3 new files, full suite 604/604.
DEPLOY NOTE: on the first 04:00 run after deploy, subs 39, 68, 104 (past_due >14 days, Stripe canceled) are set to canceled without an
email; sub 44 (active) is only reported by the 08:30 job. Decide about those customers BEFORE deploying.

Billing guards DEPLOYED to staging 2026-11-05 (health commit 8245a10). 08:30 reconciliation job registered and ran; it skipped because
SMTP_ALERT_EMAIL was not set. Adam is setting it on staging (expect one noisy email: staging has live sub ids but Stripe test keys, so
every lookup gives resource_missing). Then remove it from staging or leave it. SET IT ON PROD (plan 6.3). Check old Replit prod has it too.
STAGING RECONCILIATION EMAIL CHECKED 2026-11-06: arrived 08:30 at adam@valoxi.ai, 18 checked, 0 mismatches, 18 resource_missing (expected, test keys vs live ids). Job and delivery work. Adam is removing SMTP_ALERT_EMAIL from staging to stop daily noise. Mismatch detection first meets live Stripe on prod Wed 25 Nov 08:30 (expect sub 44 flagged if still active).

Legal notice PUBLISHED 2026-11-05 (counsel approved; no exact transfer wording given, mechanism text taken from each vendor DPA, counsel to check
the two lines). Live: valoxi.ai/dpa v1.1 and /privacy show DigitalOcean + Neon effective 24 November 2026, Replit until then. Site auto-deploys
from main (Cloudflare Pages project valoxi-site, GitHub AdamValoxi/valoxi-site; push needs gh account AdamValoxi). Earliest cutover Fri 2026-11-20;
proposed Tue 2026-11-24 19:00 UK. After cutover + Phase 8 (day 7+): remove Replit rows, bump Last updated.

CUTOVER TIMELINE written 2026-11-05: docs/do-migration/cutover-timeline.md (Tue 24 Nov 2026, freeze 19:00 UK, hard stop 20:30, rehearsal 3 on Wed 11 Nov (brought forward 2026-11-06), go/no-go Mon 23 Nov 12:00).

DECISION 2026-11-05 (Adam): subs 39, 68, 104 are left to auto-cancel on the first fixed dunning run; no emails. All four customers dormant since July. Dentiva (44) open: check Stripe, then hand-fix or contact after cutover.

## SUPERSEDED, see "RESTART HERE" at the end of this file (was: restart point of 2026-11-05, after PR #21 merged)
State: all branches merged to main, including PR #21 (rehearsal 3 runbook, e69916d). Staging runs billing guards (commit 8245a10). Nothing pending to push or merge.
1. DONE: rehearsal-3-runbook pushed, PR #21 opened and merged by Adam.
2. NEXT: Rehearsal 3 is planned for Wed 11 Nov (all prep brought forward 2026-11-06; cutover date stays Tue 24 Nov because the live notice says 24 Nov; moving it means editing the notice). Steps are in docs/do-migration/rehearsal-3-runbook.md (Parts 0-5; Part 5 tests the #574 scripts on rehearsal-3). Needs new Neon branch `rehearsal-3`, `.env.rehearsal3`, `.env.cutover`, and the endpoint names in `-ExpectedDstHost`.
3. After it runs: Adam pastes ELAPSED lines, Part 2 table count (must be 0), DO rebuild and live times. Claude records them in rehearsal-2026-11-11.txt and cutover-timeline.md section 4.
Adam's open items (see cutover-timeline.md sections 2 and 6): remove SMTP_ALERT_EMAIL from staging (reconciliation email check done 6 Nov); by Tue 10 Nov secrets export, Cloudflare proxied status, Neon PITR, Dentiva (44) in Stripe, SMTP_ALERT_EMAIL on old Replit prod, DO team name; Viv Clerk dev sign-up and user 2 relink DONE 2026-11-06 (worked, no issues reported); #574 ALTERs review.
Cutover: Tue 24 Nov 2026, freeze 19:00 UK, hard stop 20:30. Go/no-go Mon 23 Nov 12:00.
Not mine, leave alone: modified scripts/send-marketing-consent-emails.ts, untracked _to_delete/.
Rules: never print secrets or connection strings; Claude never touches old or new prod; commands in separate code blocks; Adam pushes, Claude opens PRs, Adam merges. site repo pushes need gh account AdamValoxi.

## Black Friday offer 2026-11-12 (marketing site, spans the cutover)
- Live: valoxi.ai/black-friday/ (also /event/). valoxi-site PR merged by Adam 2026-11-12, both URLs 200, screenshot checked. Site repo on this machine: `Documents\Auty Consultancy Automation\Website\Valoxi - Copy - Copy\valoxi-site` (the other two copies are stale).
- Offers (Professional, new accounts, end 23:59 GMT Mon 30 Nov): one month free on monthly (slug `bf26-free-month`); annual at $917.04 first year, 54% less than 12 x $167, renews $1,603.20 (slug `bf26-annual`, coupon `BF26_ANNUAL_PRO` $686.16 off).
- NOT DONE as of 2026-11-12: coupon and the two campaign rows on old prod. Buttons show "no longer available" until then. Prompt for Replit: docs/do-migration/black-friday-replit-prompt.md. No code change (promo code identical on replit-final and main); rows travel in the cutover dump.
- Cutover checks added to cutover-timeline.md (sections 2, 4 steps 6.8 and 6.11, 6, 7). Buttons fail during the freeze window; no Black Friday send on Tue 24 Nov evening.
- Open: is a "once" coupon consumed by the $0 trial invoice? Prompt uses a 1-month repeating coupon to avoid the question.
- 2026-11-12 later: coupon BF26_ANNUAL_PRO created (live, Professional product, 1 month) and both campaign rows inserted on old prod via Replit (Adam). Both checkouts return 200 with a checkoutUrl. Finding: real annual Professional price is 160320 ($1,603.20), not $1,608, so the offer charges $917.04. Site fixed on branch black-friday-price-fix (valoxi-site), needs push and merge. Still to do: Adam clicks both buttons and reads the price on the Stripe Checkout page (the session API shows 0 during a trial, so the discount is not yet seen applied).
- 2026-11-12 VERIFIED by Adam on live Stripe Checkout (not paid): monthly = about a month free then $167 a month; annual = 7 days free then $917.04 a year "until coupon expires" (Stripe's wording for the 1-month coupon, left as is). Site price fix merged and live: page shows $917.04 and $1,603.20. Black Friday is ready to send. Remaining: cutover checks in cutover-timeline.md only.
- 2026-11-12 homepage: the Professional card in the valoxi.ai pricing section shows the Black Friday deal and links to /black-friday/ until the deadline, then reverts by itself (skipped when the URL has ?promo=). Merged and verified live. Shared constants: valoxi-site src/lib/blackFriday.ts.

## 2026-11-12: secrets collected, rehearsal 3 passed

- Secrets: `scripts/migration/collect-prod-secrets.ps1` (hidden prompts, `-Check`, `-Only NAME`) wrote gitignored `.env.do-prod`. 39 of 39 saved, 0 flagged. Not in Replit prod, so not collected: SMTP_USER, SMTP_PASS, SMTP_PORT. Set directly on DO: DATABASE_URL, GIT_SHA, NODE_ENV, PORT.
- Neon strings: `scripts/migration/set-dst-url.ps1` (`-Target rehearsal3|cutover`, `-Pooled`, `-Check`). `.env.rehearsal3` = branch rehearsal-3, endpoint ep-dry-bonus-zay1bg7r. `.env.cutover` = branch production, endpoint ep-cold-night-za5w03lp. Each holds DST_URL (direct) and POOLED_URL (goes to DO as DATABASE_URL).
- Rehearsal 3: passed, record in `rehearsal-2026-11-12.txt`. 0 mismatches everywhere. Rebuild about 5 min. Restore was 6 min 30 s only because ProtonVPN was on: VPN OFF on the night (added to 18:45 pre-flight).
- #574: old prod already has CASCADE x7 (since 23 Oct at the latest). 7.4 becomes precheck only. Unknown: why assessment.md section 5 says otherwise for 16 Oct.
- All of the above merged in PR #29 (bc4c948). Adam's items from this day were closed on 13 Nov, see below.

## 2026-11-13: preparation list closed

- Cloudflare: app.valoxi.ai A record is DNS-only. DO team name: Valoxi.
- Neon: was on the free plan (6 hour history). Adam upgraded; history window now 7 days. Old rehearsal branches deleted; production, dev, rehearsal-3 remain. Production re-checked empty, server now PostgreSQL 18.7.
- Dentiva (sub 44): cancelled in Stripe 26 Aug. Mark cancelled by hand on new prod after cutover. Adam checked the 28 Aug payment: no refund is due.
- Secrets: NOT in a password manager yet. Replit is the master copy until Phase 8; they must be saved elsewhere before the Replit deployment is deleted.
- Merged in PR #30 (c25b835).
- Nothing open before go/no-go (Mon 23 Nov 12:00) except: Thu 19 Nov check the live pages still say 24 November; freeze on main from Fri 20 Nov; users notified Mon 23 Nov 19:40.

## RESTART HERE (updated 2026-11-13, end of session)

State: app repo on `main` at c25b835 (PRs #29 and #30 merged). Site repo: all three Black Friday PRs merged and live; its local checkout is still on branch `black-friday-pricing-card` (switch to main and pull before the next site change; needs gh account AdamValoxi).
Uncommitted on app `main`, to go in the next PR (Thu 19 Nov check): this file, and one line in cutover-timeline.md (Dentiva: no refund due).
Not mine, leave alone: modified scripts/send-marketing-consent-emails.ts, untracked _to_delete/.

The preparation list is CLOSED. Every go/no-go item in cutover-timeline.md section 6 is done except "Users notified" (Mon 23 Nov 19:40) and the standing checks below.

Dates
1. Thu 19 Nov, CODE: check valoxi.ai/dpa and /privacy still say 24 November. Open a PR with the uncommitted docs.
2. Fri 20 Nov: change freeze on `main` starts (cutover-critical merges only).
3. Mon 23 Nov 12:00: go/no-go (section 6).
4. Mon 23 Nov 19:00 to 19:45, ADAM: lower TTL, add app.valoxi.ai as a custom domain in DO, prepare the prod env set WITHOUT applying, notify users, dry runs (`-Step Check`, `-DryRun` of Dump and Restore).
5. Tue 24 Nov 18:45 pre-flight (VPN OFF), 19:00 freeze, hard stop 20:30.
6. Wed 25 Nov: backup 02:00, dunning 04:00, alert and reconciliation emails 08:00 and 08:30, TTL back, recreate `dev`, #574 precheck, Dentiva.
7. Tue 1 Dec: Black Friday expires 00:00 UTC; Phase 8 (delete Replit) only after the secrets are in a password manager.

Open for ADAM (none blocks the date)
- Save the 39 secrets in a password manager. Adam said he will. Until then Replit is the only master copy; `.env.do-prod` is a working copy on one machine. Tell Claude when done so section 6 and the Phase 8 row can be marked.
- Did `SMTP_ALERT_EMAIL` get removed from STAGING (to stop the daily reconciliation email)? Never confirmed.
- Optional: delete stale local files `.env.rehearsal` and any `.env.rehearsal2` (their Neon branches are deleted).

Open for CODE
- For Mon 23 Nov 19:20 (step 6.3): help Adam enter the DO prod env set from `.env.do-prod`, names only. Plus, not in that file: `DATABASE_URL` = POOLED_URL from `.env.cutover`; `GIT_SHA` and `VITE_CLERK_PUBLISHABLE_KEY` are BUILD-TIME; `NODE_ENV`, `PORT`. Not set anywhere and not in Replit prod: SMTP_USER, SMTP_PASS, SMTP_PORT (the app runs without them today).
- For the night: `rehearsal-run.ps1` defaults still point at the deleted rehearsal-2 branch (`.env.rehearsal`, `ep-calm-smoke-za9wqm88`). The real run must pass `-DstEnv .env.cutover -ExpectedDstHost ep-cold-night-za5w03lp` and its own `-OutDir`. Write the exact night commands into the timeline before Mon 23 Nov and dry-run them at 19:45.
- For Wed 25 Nov: a script file to mark sub 44 (Dentiva) cancelled on new prod, for Adam to authorise and run. And `574-precheck.sql` on new prod: expect CASCADE x7, then nothing to apply.
- After 1 Dec: remove the Black Friday code from valoxi-site (src/lib/blackFriday.ts and its users; it switches itself off, so no rush) and decide what `/event` shows. After Phase 8: remove the Replit rows from privacy and DPA, bump "Last updated".

Known unknowns
- DNS flip and certificate time on the night: never measured, cannot be rehearsed.
- Restore with the VPN off was not re-timed after rehearsal 3 (22 s is the 3 Nov figure; 6 min 30 s with ProtonVPN on).
- Why assessment.md section 5 records the #574 constraints as SET NULL / NO ACTION on 16 Oct when every dump since 23 Oct shows CASCADE.
- Counsel's check of the two transfer-mechanism lines on the live legal pages (does not block the date).
- Black Friday: whether a "once" coupon survives the $0 trial invoice (avoided by using a 1-month repeating coupon).

State of things outside the repo
- Neon project: paid plan, history window 7 days. Branches: production (ep-cold-night-za5w03lp, empty, PostgreSQL 18.7), dev (staging and local use it, do not delete), rehearsal-3 (ep-dry-bonus-zay1bg7r, holds the 12 Nov copy with CASCADE x7; delete after the cutover).
- Staging (valoxi-staging on DO): healthy, `GIT_SHA` left as the label `rehearsal3`, still on the dev database.
- Local gitignored files, never print: `.env.do-prod`, `.env.cutover`, `.env.rehearsal3`, `.env.prod`. Delete `.env.do-prod` and `rehearsal3\valoxi-rehearsal.dump` (customer data) after the cutover.
- Cloudflare: app.valoxi.ai is an A record to 34.111.179.208, DNS-only. DO team: Valoxi.
- Black Friday: live and verified; buttons fail from the 19:00 freeze until the all-clear, so no Black Friday email or ad push on Tue 24 Nov evening.

Rules: never print secrets or connection strings (use the scripts' `-Check` modes, names and verdicts only); Claude never touches old or new prod (rehearsal-3 and staging health are fine); commands in separate code blocks; Claude opens PRs, Adam merges; commit only when asked; site repo pushes need gh account AdamValoxi, then switch back to adam654321.

## 2026-11-18: status check (six days out)

- Legal pages checked a day early: valoxi.ai/dpa and /privacy both 200 and both say 24 November 2026. Glance again on Thu 19 Nov if wanted; nothing changed since 5 Nov.
- Staging /api/health 200, commit label `rehearsal3`. app.valoxi.ai still resolves to 34.111.179.208. Local `main` level with origin at c25b835.
- Night commands WRITTEN: cutover-timeline.md section 4a (`$cut` splat: `.env.cutover`, OutDir `cutover`, `ep-cold-night-za5w03lp`). Note: the Monday `Restore -DryRun` aborts with "dump not found" because the fresh OutDir has no dump yet; that is the expected pass (host guard runs first).
- SMTP_ALERT_EMAIL: Adam confirmed 2026-11-18 it was removed from staging. Closed. (It stays set on old Replit prod and must be in the DO prod env set, step 6.3.)
- These docs go in the PR from branch `cutover-night-commands` (opened 2026-11-18).
- Still open for Adam: secrets into a password manager (blocks Phase 8 only), users notified Mon 23 Nov 19:40.

## 2026-11-23: GO

- Adam called GO on Mon 23 Nov for the cutover on Tue 24 Nov 2026, freeze 19:00 UK, hard stop 20:30.
- Tonight (section 3 of cutover-timeline.md): 19:00 TTL to 60 s and record the current A record; 19:10 DO custom domain; 19:20 prod env set prepared NOT applied (CODE helps, names only); 19:40 users notified; 19:45 dry runs with `$cut` (section 4a).
- Glance at Neon Settings: history window still 7 days.
- Still open, not blocking: secrets into a password manager (blocks Phase 8 only).
- DO security notices received 2026-11-23 (PHP Nov 19 releases, OpenJDK CVE-2026-114938, NGINX HTTP/2 CVE-2026-123633/123007). Checked the Valoxi app: Dockerfile is node:22-bookworm-slim plus the PostgreSQL client, no PHP, Java or nginx; App Platform's edge is DO-managed. Not a cutover blocker. Open for Adam: check any OTHER resources in the DO account (Droplets, 1-Click images) that may run PHP, Java or nginx.
- 2026-11-23 6.1 DONE: app.valoxi.ai A 34.111.179.208, DNS-only, TTL now 60 s (Cloudflare 1.1.1.1 answers ttl 60). Original TTL value not recorded; set back to 300 or 3600 on Wed 25 Nov (7.1).
- 2026-11-23 6.2 DONE: app.valoxi.ai added as custom domain on valoxi-staging (pending). CNAME target for the flip: squid-app-5dwfn.ondigitalocean.app (DNS-only).
- 2026-11-23 6.3 PREPARED OFFLINE, not in DO: DO saves env edits straight into a redeploy, so the prod set is held in gitignored .env.do-bulk (43 vars: .env.do-prod + DATABASE_URL=POOLED_URL of .env.cutover + NODE_ENV, PORT 8080, GIT_SHA 75139e9). Checks OK: pooled ep-cold-night, APP_URL app.valoxi.ai, R2 valoxi-documents, pk_live_/sk_live_, Gmail visible true. Pasted into the DO Bulk Editor at 6.9 (after Replit stop). Delete .env.do-bulk with .env.do-prod after cutover.
- 2026-11-24 TIME CHANGE (Adam): cutover moves from 19:00 to about 22:00 UK on Tue 24 Nov. Every section 4 time shifts by +3 h: pre-flight 21:45 (VPN off), freeze 22:00, hard stop 23:30. Users emailed in the morning with 22:00 to about 23:30. Date unchanged, so the live legal notice (effective 24 Nov) still holds.
- 2026-11-24 00:27 dry runs (Adam, VPN off): Check PASS (source ep-old-recipe-an7e4afw us-east-1, server 16.16; target ep-cold-night-za5w03lp direct, server 18.7, tables in public 0; pg_dump 18.3). Dump -DryRun PASS. Restore -DryRun PASS (host guard accepted ep-cold-night-za5w03lp, then "dump not found" as expected). All T-24h steps done; next is the morning user email, then 21:45 pre-flight.
- 6.4 user email scheduled by Adam for 08:00 Tue 24 Nov (window 22:00 to about 23:30 UK).
- 2026-11-24 NEW Phase 8 item: Replit workspace DEV database is not covered by the plan. Not lost tonight (only the prod deployment stops). Before Phase 8: decide if it holds anything not in prod; if yes, dump it into a Neon branch. Adam asked about a dev rehearsal today; CODE advised against (staging already proves the dev path; open risks are prod-only).

## 2026-11-24 NIGHT LOG
- 22:13 GO. Pre-flight by CODE: staging /api/health ok (commit label rehearsal3), app.valoxi.ai 200 on Replit (34.111.179.208). Hard stop = freeze time + 90 min.
- 22:15 Check PASS (target ep-cold-night-za5w03lp, 0 tables, pg_dump 18.3).
- 22:16 FREEZE: Replit deployment stopped (Adam). Hard stop 23:46.
- 22:17-22:18 6.6 DONE: CountsBefore 94, Dump 10,580,987 B in 30 s, CountsAfter 94, CompareDrift COUNT=94 SEQ=92 SPOT=4 mismatches=0. Second copy cutover\valoxi-cutover-copy.dump.
- 22:19-22:20 6.7/6.8 DONE: Restore exit 0 in 16 s; CompareRestored COUNT=94 SEQ=92 SPOT=4 mismatches=0; CompareStructure STRUCT=10 mismatches=0.
- ~22:30 6.9 env set applied in DO (secrets encrypted), deploy started. Tidy-up later: move app to the correct DO project; optional rename (do NOT recreate: CNAME targets squid-app-5dwfn.ondigitalocean.app).
- 22:34 6.9 LIVE: squid-app /api/health ok, commit 75139e9, uptime 146 s; root 200. Replit custom domain left in place (rollback path) until Phase 8.
- 22:44 Neon production shows connections (Adam). 6.10 CNAME app -> squid-app-5dwfn.ondigitalocean.app saved (DNS-only).
- 22:45 app.valoxi.ai LIVE ON DO: CNAME resolves to squid-app, https 200, cert valid, /api/health commit 75139e9. www.app.valoxi.ai still A 34.111.179.208 (Replit); not referenced in code; left for later decision.
- 23:11 6.11 Adam: sign-in, company 228, deal model, PDF, upload/delete, Black Friday checkouts all OK. Stripe webhook check pending.
- 23:15 ALL CLEAR (Adam). Downtime 22:16 to about 23:15. Stripe webhooks: 0 failures this week, no events during downtime; first live delivery to be checked Wed morning (no old event resent: handlers act on payloads).
- Calendar reminder set: Wed 25 Nov 09:00 "Valoxi: post-cutover morning checks".

## RESTART HERE (25 Nov morning)
Valoxi runs on DigitalOcean (app valoxi-staging, squid-app-5dwfn) with Neon production ep-cold-night-za5w03lp. Replit deployment stopped, untouched, rollback available 7 days (section 5 of cutover-timeline.md).
Morning: Stripe first webhook 200; R2 valoxi-documents/backups 25 Nov file; 04:00 dunning (39, 68, 104 cancelled); 08:00/08:30 emails; TTL back to 300.
CODE to do: Dentiva sub 44 script (Adam authorises and runs), 574-precheck.sql on new prod, recreate Neon dev + new staging app, delete .env.do-bulk/.env.do-prod/cutover dumps/rehearsal3 dump/active-users CSV when no longer needed, PR with these docs.
Tidy-up: move DO app to right project; www.app.valoxi.ai (A to Replit) delete or repoint; Replit dev DB decision before Phase 8.
- 23:51 'We're back' email sent (Adam). active-users CSV deleted.

## 2026-11-25 MORNING CHECKS: ALL PASS
- Site: app.valoxi.ai 200, /api/health 200, CNAME to squid-app-5dwfn confirmed.
- 04:00 dunning on DO: 3x GET /v1/subscriptions 200, no DELETE (the nightly 404 DELETE loop from Replit's old code, seen 17 and 24 Nov, has stopped). Subs 39, 68, 104 reconciled.
- 08:00 alert job ran (GET /v1/events 200). 08:30 reconciliation email: 15 checked (was 18, so the 3 dropped out), 0 lookup errors, 2 mismatches: sub 35 (company 34, known test sub) and sub 44 (company 56, Dentiva), both app active / Stripe canceled.
- Stripe webhooks 200. R2 backup 25 Nov 02:00:05 GMT present. Cloudflare TTL back to 300.
NEXT: one-off script for subs 35 and 44 (Adam authorises and runs), 574 precheck, delete sensitive local files, docs PR.
- 2026-11-25: Adam decided subs 35 and 44: correct the record only, no email. Scripts written: scripts/migration/fix-subs-35-44-check.sql (read only) and fix-subs-35-44-apply.sql (guarded, all-or-nothing, writes admin.reconciled_already_canceled event). Adam runs on new prod.
- PARKED until cutover closed: admin area overhaul (users active/cancelled, last sign-in, missed payments, Stripe subs count, balance, payouts; waitlist retired). See memory valoxi-admin-overhaul.
- 2026-11-25 10:30 UTC: fix-subs-35-44-apply.sql RUN by Adam on new prod. Subs 35, 44 now canceled, 2 audit events. Expect 0 mismatches in 26 Nov 08:30 report. 574 precheck next.
- 2026-11-25: 574-precheck on new prod: CASCADE x7, FK574_FOUND|7. #574 already in place, nothing to apply. CLOSED.
- 2026-11-25: DELETED (Adam approved): 3 dumps (cutover x2, rehearsal3 x1) and .env.do-bulk. Kept: .env.do-prod (until password manager), .env.cutover, .env.rehearsal3, count .txt files.
- 2026-11-25: DELETED (Adam approved): rehearsal/ and rehearsal2/ dumps. No *.dump files left in repo.
- 2026-11-25: PR #32 opened (branch cutover-complete, c9832c8). Adam merges.

## 2026-11-25 DEV RECREATED (plan 7.2)
- New Neon branch dev-2026-11-25 from production, no expiry: ep-holy-resonance-zazrpf52. .env.dev holds DST_URL + POOLED_URL for it (set-dst-url.ps1 -Target dev, new option).
- Confirmed copy of today's prod (sub 44 canceled, 2 admin events, 89 users, 94 tables).
- Scrubbed: scripts/migration/scrub-dev-emails.mjs --expect ep-holy-resonance-zazrpf52 --apply. 745 foreign addresses in 12 columns, 824 rows updated, re-scan 0. Names/other PII not scrubbed. nylas_grants keep real grant ids: keep Nylas unset on staging. Stripe ids are live: staging uses test keys.
- Test guard now allows ep-holy-resonance-zazrpf52 and always blocks ep-cold-night. Full suite on new dev: 39 files, 605/605 (needs --maxWorkers=2 on this machine, else OOM).
- Branch dev-branch-recreate (not pushed yet). Open: what is ep-square-pine-zaoqy54e (local .env DATABASE_URL)? Switch local .env to new dev. Then new staging app. Then delete old dev (ep-ancient-breeze), rehearsal-3, and .env.rehearsal3.
- 2026-11-25: local .env DATABASE_URL was ep-square-pine-zaoqy54e (eu-west-2, not in Adam's Neon project, password fails: dead/stale). Switched to new dev pooled ep-holy-resonance-zazrpf52 (plan 7.3).

## RESTART HERE (2026-11-25 evening, after session crash)
Recovered from disk; the crashed session's chat is lost, so anything not listed here is unknown.
- Thread 1, new dev/staging app on DO (plan 7.2 continued): Neon dev-2026-11-25 ready and scrubbed, local .env on it, branch dev-branch-recreate committed (680f747), not pushed. Stopped at the SECRETS stage for the new app. Nothing on disk records which secrets were entered: no staging env file exists, .do/app.yaml unchanged since 23 Oct. The old staging app became prod at 6.9, so its staging values (Clerk dev keys, Stripe test keys, R2 valoxi-documents-dev token) were overwritten there and must come from each vendor dashboard. Rules for the dev app: DATABASE_URL = POOLED_URL from .env.dev; Stripe TEST keys; R2 bucket valoxi-documents-dev; Nylas unset; RESEND_API_KEY unset or staging-only key; SMTP_ALERT_EMAIL unset.
- Thread 2, side piece, branded email batch: scripts/send-branded-list.ts written 18:02 (untracked). Preview works (re-run after crash on the _example folder). NOTHING SENT: only campaign folder is Documents\Valoxi Sends\_example (3 dummy rows), no send-log.csv anywhere. Real recipients.csv and message.md not created yet. Order: --preview, --test, --send --confirm=N. Uses RESEND_API_KEY_MARKETING from .env.do-prod (present).
- After both: push dev-branch-recreate + PR, delete old dev (ep-ancient-breeze), rehearsal-3, .env.rehearsal3.

## 2026-11-25 late: Black Friday email to the event list (thread 2)
- Campaign folder: Documents\Valoxi Sends\2026-11-26 black-friday-bbe. message.md DRAFTED from the Jag/Viv call (informal, event = The Business Buying Experience Live, Sept 2026; link valoxi.ai/black-friday/ with utm_campaign=bf26-bbe). preview.html written. recipients.csv is header only: waiting for Adam's attendee list (about 250).
- NOTHING SENT. Copy goes to the group for approval first (Adam posts it), send planned for the morning of 26 Nov.
- Customer filter plan: no prod access needed. Dev emails are adam+<first 12 hex of md5(original)>, so hash each attendee email and match against users on dev (copy of 25 Nov prod). Script not written yet (needs the list format).
- Tracking: click tracking switched ON for news.valoxi.ai via the Resend API 2026-11-25 evening (Adam asked; verified click_tracking=true, open tracking still off). Applies to EVERY email sent from news.valoxi.ai, not only this campaign. send-branded-list.ts now tags each send with campaign=<folder name>.

## 2026-11-25 evening: Black Friday extended to Fri 4 Dec, annual offer loses its trial (PREPARED, NOT LIVE)
Adam asked for both. Nothing is committed, pushed, deployed or run on prod. Live site and prod still say Mon 30 Nov with a 7-day trial on annual.
- Deadline, prod data: scripts/migration/bf26-extend-check.sql (read only) and bf26-extend-apply.sql (guarded, all-or-nothing; expires_at 2026-12-01 -> 2026-12-05 00:00:00 UTC on slugs bf26-free-month and bf26-annual). Tested on Neon dev (applied there; second run refuses). Adam runs on new prod, same way as fix-subs-35-44.
- Deadline, site: valoxi-site branch black-friday-extend (from origin/main, uncommitted): blackFriday.ts (OFFER_ENDS_AT 5 Dec 00:00 UTC, labels "Friday 4 December" / "Fri 4 Dec"), page metadata, Cyber Monday wording removed. tsc clean.
- No trial on bf26-annual, app: new server/services/checkout-trial.ts (+ test, 5 pass) and public-checkout.routes.ts uses it. NO_TRIAL_PROMO_SLUGS = bf26-annual: card charged $917.04 at signup. Ends by itself when the campaign expires; plain annual checkout keeps 7 days. Uncommitted in the app working tree (currently on dev-branch-recreate; needs its own branch from main, PR, merge, DO deploy).
- No trial, site: annual terms line in BlackFridayOffer.tsx now says no free trial, charged at signup (same uncommitted working tree as the deadline change; split into two commits so the date can ship without the trial change).
- ORDER: (1) run bf26-extend-apply.sql on prod and merge the site date change, any order, before Mon 30 Nov 23:59. (2) app no-trial deploy FIRST, then the site terms line. After (2) Adam opens the annual Stripe Checkout (do not pay) and confirms $917.04 due today, no trial.
- Stripe: Adam to confirm coupon BF26_ANNUAL_PRO has no redeem-by date.
- Email copy (message.md, preview.html) updated to Friday 4 December and re-sent to adam@valoxi.ai. cutover-timeline.md still says Tue 1 Dec for the expiry: update when this ships.
- The Black Friday code removal on valoxi-site moves from after 1 Dec to after 5 Dec. Phase 8 (Replit) is not affected.
- 2026-11-25 19:30: COMMITTED AND PRs OPEN (Adam asked). Site: valoxi-site PR #5 (date, branch black-friday-extend) and PR #6 (annual terms, branch black-friday-no-trial, sits on #5, merge after the app deploy). App: valoxi-app PR #34 (branch bf26-annual-no-trial, 8a72a5b: checkout-trial helper + test, route change, both bf26-extend SQL scripts). Local app checkout is on bf26-annual-no-trial; dev-branch-recreate is already merged (PR #33, main c82c1ca). gh active account back on adam654321. Still to do: Adam merges, runs bf26-extend-apply.sql on prod, checks the Stripe coupon and the annual checkout. RESUME.md and send-branded-list.ts still uncommitted.
- 2026-11-25 ~20:35 UTC: bf26-extend-apply.sql RUN by Adam on new prod (UPDATE 2, COMMIT). Both bf26 rows now expire 2026-12-05 00:00:00 UTC. PRs merged 20:27 UTC: valoxi-app #34 (main e81a576), valoxi-site #5 and #6. Site shows Friday 4 December. OPEN: the app did not auto-deploy (.do/app.yaml deploy_on_push: false); Adam triggers the DO deploy from main, then checks the annual Stripe Checkout shows $917.04 due today, no trial. Until then the page says "no free trial" while Stripe still gives 7 days.
- 2026-11-26 00:16 UTC: app deploy of #34 VERIFIED by CODE. Health ok, uptime 3 h 11 min (restart about 21:05 UTC 25 Nov; label still 75139e9 because GIT_SHA was not changed). Both bf26 checkouts return 200. Annual Stripe Checkout opened, not paid: "Total due today" GBP 727.49 (Stripe's local-currency view of $917.04), no trial, then GBP 1,271.83 a year after the coupon. Site shows Friday 4 December and "There is no free trial on this offer". Black Friday extension and no-trial change are LIVE and consistent. Three unpaid checkout sessions left to expire.

## 2026-11-26: Black Friday event email, list built, tests out, NOT SENT
- Copy approved by Adam as it stands (video link checked 200, no price figures). Campaign folder: Documents\Valoxi Sends\2026-11-26 black-friday-bbe.
- recipients.csv built from Downloads\Business Buying Experience Attendees List.xlsx: 247 rows with an email, 15 duplicates and 11 existing Valoxi users removed (md5 match against Neon dev, copy of 25 Nov prod), 221 final. 24 names without an email skipped; sponsors block has no emails.
- Suppression added to scripts/send-branded-list.ts: Documents\Valoxi Sends\suppressed.csv (email,reason,date), applies to every campaign folder, checked by --send and --test. Empty so far. Unsubscribes arrive by email at hello@valoxi.ai (footer reply or List-Unsubscribe mailto) and are added by hand; pull bounces and complaints from Resend after the send. --test now takes --name.
- Tests sent 26 Nov via the script ([TEST] subject) to Viv, Daniel (5D), Jag and Adam.
- NEXT: Adam says "send to 221" -> --send --confirm=221, then report from send-log.csv. Then back to thread 1 (dev/staging app secrets on DO).
- 2026-11-26 SENT (Adam gave the go-ahead after the group approved the tests): 221 accepted by Resend, 0 failed, log in the campaign folder (send-log.csv). Status a few minutes later: 208 delivered, 4 clicked, 7 still in transit, 2 bounced (both added to suppressed.csv). Follow-up: re-check the 7, add any later bounces or complaints, watch hello@valoxi.ai for unsubscribes for a week. Clicks: Resend tag campaign=2026-11-26-black-friday-bbe; site visits: utm_campaign=bf26-bbe.
- NEXT: thread 1, dev/staging app secrets on DO. First question for Adam: does the new DO app exist yet and were any secrets entered?
- 2026-11-26: first unsubscribe added to suppressed.csv; file now holds 2 bounces + 1 unsubscribe.

## 2026-11-26: dev/staging app secrets (thread 1), script ready
- Adam confirmed: the new DO dev app EXISTS, no secrets entered yet.
- New scripts/migration/collect-dev-secrets.ps1 writes gitignored .env.do-dev (23 names). -AutoOnly run by CODE: 14 saved automatically (DATABASE_URL = pooled ep-holy-resonance from .env.dev, new SESSION_SECRET, Gemini/R2 account/site URL/5D/test company copied from .env.do-prod, fixed values incl. R2_BUCKET_NAME valoxi-documents-dev). 9 missing, all Adam's: APP_URL, Clerk dev pk/sk/webhook secret (VITE_ copy is automatic), Stripe test sk/webhook secret, R2 dev token id/secret. -Check flags live keys, values equal to prod, and any RESEND_/SMTP_/NYLAS secret.
- Webhooks must be NEW endpoints on the dev app URL: Clerk dev /api/v2/webhooks/clerk (user.created), Stripe test /api/v2/billing/webhook/stripe. The old staging endpoints point at squid-app-5dwfn, which is now PROD: delete or repoint them.
- NEXT: Adam runs the script, pastes .env.do-dev into the DO Bulk Editor (VITE_CLERK_PUBLISHABLE_KEY build time, encrypt secrets), deploys; CODE health-checks. Then delete Neon old dev (ep-ancient-breeze) + rehearsal-3, .env.rehearsal3, switch to main, PR with RESUME.md, send-branded-list.ts, collect-dev-secrets.ps1.
- 2026-11-26: two more unsubscribes added to suppressed.csv (one replied under a different surname from the list; address to be confirmed by Adam). File now 2 bounces + 3 unsubscribes.
- 2026-11-26: that unsubscribe address confirmed by Adam (names and addresses are in suppressed.csv only, not in this repo). Dev app: first deploy FAILED (no env yet; the Dockerfile requires VITE_CLERK_PUBLISHABLE_KEY at build), so no URL yet. doctl on this machine has contexts carepilot, clovaar, default only: no Valoxi team access, CODE cannot read the app URL. Plan is two passes: (1) Clerk dev keys + Stripe test key + R2 dev token -> deploy -> URL exists; (2) create the Clerk and Stripe webhook endpoints on that URL, add the two whsec_ values with -Only, redeploy. APP_URL in .env.do-dev is now the literal ${APP_URL} (DO bindable), not typed.
- 2026-11-26 NAMING (Adam): the DO apps were renamed. `valoxi-prod` = PRODUCTION (the app that was valoxi-staging, squid-app-5dwfn, app.valoxi.ai). `valoxi-staging` = the NEW staging/dev app on Neon dev-2026-11-25. Every earlier line in this file that says "valoxi-staging" for production is historical. .do/app.yaml still says name: valoxi-staging (it was the old staging spec): review before reuse.
- 2026-11-26: .env.do-dev checked by CODE (21 of 23, webhook secrets pending, no live keys, nothing equal to prod), pasted into the new valoxi-staging by Adam; deploy LIVE per Adam. Pass 2 next: Clerk dev + Stripe test webhook endpoints on the staging URL, then -Only for the two whsec_ values and redeploy.
- 2026-11-26: new staging URL https://valoxi-staging-v25cm.ondigitalocean.app. CODE check: /api/health 200 ok, root 200, bundle carries the Clerk TEST publishable key only. Health shows commit "unknown" (GIT_SHA not set on this app; cosmetic, set GIT_SHA=${_self.COMMIT_HASH} at build time if wanted). Pass 2 webhooks: Clerk dev /api/v2/webhooks/clerk (user.created); Stripe test /api/v2/billing/webhook/stripe with the 6 events the code handles: checkout.session.completed, customer.subscription.updated, customer.subscription.deleted, invoice.paid, invoice.payment_failed, invoice.upcoming.
- 2026-11-26: both webhook secrets collected; .env.do-dev 23 of 23, 0 to check (differ from each other and from prod). NEXT: Adam adds the two to valoxi-staging on DO (encrypted) and redeploys; CODE health-checks; Adam signs in and smoke-tests; then clean-up (Neon old dev + rehearsal-3, .env.rehearsal3, PR).
- 2026-11-26: valoxi-staging redeployed with both webhook secrets. CODE check: health 200, root 200, Stripe webhook route answers invalid_signature to an unsigned POST (so the secret is loaded), Clerk route answers missing_headers; prod untouched (health 200, no restart). OPEN: Adam's smoke test (sign in; Stripe test event to the endpoint returns 200; Clerk test event). Then clean-up.
- 2026-11-26 STAGING LOGIN LOOP, cause and fix: sign-in is resolved by users.clerk_user_id only (server/middleware/clerk-auth.ts). Dev is a copy of prod, so its 54 clerk ids are PRODUCTION-instance ids; a Clerk DEVELOPMENT sign-in matches no row and loops. Clerk dev has 27 users; only two have a dev DB row by email: adam@shiftopsconsulting.com (user 1) and viv@shiftopsconsulting.com (user 2). CODE linked both on dev (new scripts/migration/link-dev-clerk-users.cjs, guards: dev endpoint + sk_test_ only; run `node scripts/migration/link-dev-clerk-users.cjs <rollback.json>`). Old values in cutover/dev-clerk-relink-rollback-2026-11-26.json (untracked, do NOT commit). Must be re-run every time dev is recreated from prod. adam@valoxi.ai and the adam+... test accounts have no row on dev and cannot sign in to staging.
- 2026-11-26: Adam's staging smoke test PASSED (sign-in as adam@shiftopsconsulting.com and the checks all look good). New staging app is done. Remaining clean-up: Adam deletes Neon old dev (ep-ancient-breeze) and rehearsal-3; then delete .env.rehearsal3 and stale .env.rehearsal; PR staging-app-and-email-tooling.
