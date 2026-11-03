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

## Next action (needs Adam)
1. DONE: branch protection on `main` (plan 3.4), ruleset `protect-main` active: no deletion, no force push, PR required. Verified via API 2026-11-03.
2. Say go for Phase 4 (rehearsal restore). Adam runs the prod pg_dump (client must be PostgreSQL 18 or newer). I do not touch prod.
3. Set NYLAS_CONNECT_GMAIL_VISIBLE=true on DO later (assessment.md section 11).

## Deferred / deploy-dependent
- Finding C: FIXED on branch finding-c-test-db-guard (2026-11-03), pending PR merge. One allowlist guard in vitest setupFiles (server/test-utils/db-host-guard.ts), default allowed endpoint = Neon dev `ep-ancient-breeze-zaso9i43`; extra via TEST_DB_ALLOWED_ENDPOINTS. Old/`.prod.` hosts always blocked. Five inline guards removed. Not yet run against dev DB (needs Adam's go).
- Uncommitted, not mine: scripts/send-marketing-consent-emails.ts modified, _to_delete/ untracked. Left alone.
