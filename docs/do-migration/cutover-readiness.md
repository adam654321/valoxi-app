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
| 0.7 | Cutover window | ADAM | DECIDED shape (2026-11-03): a weeknight EVENING, any day except Wednesday, start about 19:00 to 20:00 UK (not 03:00). Hard go/no-go: if no all-clear within 90 minutes of the freeze, roll back (6.12). Avoids all Replit cron times. Date still to pick: at least 14 days after the DPA Schedule 2 notice is published |

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

## 5. Rehearsal checks (days before cutover, no user impact)

Run against the RESTORED new Neon database, never the old Replit prod. All three are read-only and refuse `ep-old-recipe`. Adam runs them with prod keys; Claude does not touch prod.

1. **Rehearsal restore.** Adam takes a fresh prod dump (PostgreSQL 18 client) and restores it into Neon main. Nothing points at main yet, so this is harmless. Time the restore: that is the real length of 6.7.
2. **Counts and spot checks.** `scripts/migration/table-counts.sql` and `spot-checks.sql` on both sides, then `node scripts/migration/compare-counts.mjs source.txt restored.txt`. Must exit 0 (94 tables, 4 views, all sequences).
3. **Clerk IDs.** `DATABASE_URL=<new Neon url> CLERK_SECRET_KEY=<sk_live_...> node scripts/migration/check-clerk-ids.mjs --all`. Confirms every `clerk_user_id` exists in the prod Clerk instance and primary emails match. On dev, 53 of 88 users have a Clerk ID; the rest cannot be checked.
4. **Stripe subscriptions.** `DATABASE_URL=<new Neon url> STRIPE_SECRET_KEY=<rk_live_... read-only restricted key> node scripts/migration/check-stripe-subs.mjs --all`. Compares status, customer id and cancel-at-period-end for each subscription that has a Stripe id. Use a restricted key with read access to Subscriptions only.
5. Add `--dry-run` to 3 and 4 first to see what will be checked without any API calls.
6. Re-run 1 to 4 against the FINAL restore at the window (6.8) as the go/no-go evidence.
