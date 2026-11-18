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
