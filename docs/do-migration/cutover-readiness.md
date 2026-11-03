# Cutover readiness (Phase 0 and Phase 6 prerequisites)

**Written:** 2026-11-03. **Thread:** Valoxi, Replit to DigitalOcean. Nothing else.
Companion to `plan.md` (Phase 6 steps are NOT repeated here) and `assessment.md` section 0.

Status key: DONE (evidence in repo or docs), ADAM (only Adam can answer or do), CODE (Claude can do).

## 1. Gate 0 (plan.md Phase 0), current truth

`assessment.md` section 0 still says NOT YET for every row. It is stale; update it from this table.

| # | Decision | Status | Evidence / what is missing |
|---|---|---|---|
| 0.1 | Region | DONE | Neon eu-west-2 (London). DO staging app exists. ADAM: confirm DO region is lon1 (not recorded anywhere I can read) |
| 0.2 | Neon account and project | DONE | Project `billowing-block-98253807`, org `org-holy-base-64540790`, eu-west-2. Production branch empty by design; `dev` branch `ep-ancient-breeze-zaso9i43`, no expiry |
| 0.3 | GitHub repo | DONE | https://github.com/adam654321/valoxi-app (private), `main` protected (ruleset `protect-main`), tag `replit-final` at de39a9f |
| 0.4 | DO account and project | DONE | Staging app running, commit shown by `/api/health`. ADAM: note the DO team/account name in assessment.md section 0 (not visible from the Claude machine's doctl contexts) |
| 0.5 | DNS host for `app.valoxi.ai` | ADAM | Plan assumes Cloudflare. Not confirmed. Need: where it is managed, that Adam can edit it, and the CURRENT CNAME target (needed for rollback 6.12) |
| 0.6 | Secrets export | ADAM | Every Replit secret, BOTH panes (app and deployment, they can differ), into a password manager entry. Checklist: `removals.md` section 4. Nothing else holds these |
| 0.7 | Cutover window | ADAM | Plan default: a weeknight 03:00 UK with the next morning free. Pick the date. TTL lowering (6.1) must happen 24h before |

## 2. Things the plan says that are now wrong or incomplete

FIXED in `plan.md` on 2026-11-03 (branch plan-md-fixes); kept here as the record of what changed.

1. **Table count.** 6.8 says "all 92 tables". Real count is 94 tables plus 4 views (98 relations), per assessment 14 and the dev restore.
2. **Restore target.** 6.7 says Neon main "still holds the rehearsal data". It does not: the production branch is empty by design, the rehearsal and old dev branches expired. `--clean --if-exists` is still harmless, but the reconciliation baseline is "empty then final dump", not "rehearsal then final dump".
3. **Clerk key is build-time.** `VITE_CLERK_PUBLISHABLE_KEY` is a BUILD_TIME variable (Dockerfile fails the build without it). 6.9 says "apply the production env var set, redeploy". Switching staging (dev Clerk) to prod Clerk therefore needs a full rebuild, not a restart. Allow build time inside the 03:00 window, or build early on a second DO app and promote.
4. **R2 bucket.** Staging uses `valoxi-documents-dev` with a token scoped to it. Production must use `valoxi-documents` with the prod token. Add `R2_BUCKET_NAME`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` to the 6.3 prod env var set. Confirm the first prod 02:00 backup lands in `valoxi-documents/backups/` (backup cron prunes that prefix to the newest 7).
5. **Crons start unconditionally** (`server/index.ts:99-101`: billing, chase-up, backup). On the day prod keys go on DO, the crons are live against real customers. Replit's deployment must already be stopped (6.5) so two instances never run the crons at once. Do not set live Resend, marketing, Nylas or Stripe keys on DO before the freeze.
6. **Staging safeguards must be reversed deliberately.** Staging deliberately has no Resend key, no marketing key, no Nylas, and `ISSUE_REPORT_RECIPIENT` set to Adam. The prod set in 6.3 must list each of these explicitly. Also `NYLAS_CONNECT_GMAIL_VISIBLE=true` (assessment 11).
7. **Dump client version.** The final dump (6.6) is run from the Replit shell; the restore client must be PostgreSQL 18 or newer, as in the Phase 4 rehearsal.
8. **#574 constraints.** Phase 7.4 applies seven ALTERs (the dump carries those constraints as they were, as SET NULL and NO ACTION). Have the ALTERs and rollback scripted and reviewed before 03:00, not after.

## 3. Adam's pre-cutover checklist (in order)

| When | Step | Owner |
|---|---|---|
| Any time | Record 0.1, 0.4, 0.5, 0.7 answers at the top of `assessment.md` section 0 | ADAM |
| Any time | Secrets export (0.6), both Replit panes, tick `removals.md` section 4 | ADAM |
| Any time | Confirm who can edit DNS for `app.valoxi.ai` and note the current CNAME | ADAM |
| Any time | Fix plan.md items in section 2 above | CODE (Claude, on a branch) |
| Any time | Rehearse the 6.5 to 6.11 sequence end to end on staging against a fresh dump, time it, write the real downtime | ADAM + CODE |
| T-24h | 6.1 lower TTL to 60s, 6.2 add custom domain in DO, 6.3 prep prod env set (not applied), 6.4 notify users | ADAM |
| T-0 | 6.5 to 6.11 as written in plan.md, Adam present, each step reported | ADAM + CODE (I do not touch prod; Adam runs prod dumps and DNS) |
| T+0 | Rollback 6.12 available for seven days | ADAM |
| T+1 | First prod 02:00 backup lands in `valoxi-documents/backups/` | ADAM |

## 4. Still open outside cutover

- Neon PITR plan: plan 0.2 assumes Launch or Scale for point-in-time recovery. Confirm the project is on a plan that has it before cutover.
- DO alerting (7.6) and Replit AI integration cancellation (7.7) are post-cutover.
