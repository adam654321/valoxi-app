# Cutover timeline: Tuesday 24 November 2026

**Status:** dates confirmed by Adam 2026-11-05. Legal notice published 2026-11-05 (14 clear days end 2026-11-19, so the notice is already satisfied for 24 Nov).
**Supersedes plan.md Phase 6 where they differ** (evening window not 03:00, local PowerShell runner for the dump and restore). The step numbers (6.x) refer to `plan.md`.

Owners: **ADAM** (does it, holds prod keys, runs prod commands and DNS), **CODE** (Claude: scripts, docs, checks on non-prod, reads results Adam pastes). Claude never touches old prod or new prod directly.

## 1. What the rehearsals proved (use these numbers)

| Item | Measured 2026-11-03 |
|---|---|
| Dump of old prod | 38 s, 10,147,614 bytes |
| Restore into Neon | 22 s |
| Table counts / structure / spot checks | 3 s each |
| Whole data move, including checks | about 3 minutes |
| Counts | 94 of 94 tables, 92 of 92 sequences, 4 of 4 spot checks, STRUCT 10 of 10 |
| Clerk IDs vs prod Clerk | 54 of 54 ok |
| Stripe subscriptions vs live Stripe | 30 of 35 ok, 5 are known status drift in the source data |

Still to measure: the DO rebuild with the prod Clerk key (build-time variable). Read the build time off the DO deploy log of the next staging deploy and write it in section 4.

## 2. Before the night

| Date | What | Owner |
|---|---|---|
| Fri 6 Nov | Check the staging reconciliation email arrived (subject ends "out of step with Stripe"). If it did, remove `SMTP_ALERT_EMAIL` from staging or leave it | ADAM |
| DECIDED 2026-11-05 | Four real customers (subs 39, 44, 68, 104). All dormant since July (last activity 18 Jun to 29 Jul). Leave 39, 68, 104 to be cancelled by the fixed dunning job on its first run; email no one. Dentiva (44): check Stripe for what happened after the 28 Aug payment (cancelled 26 Aug, invoice paid 28 Aug, app shows active), then mark cancelled by hand after cutover or contact the customer | ADAM |
| By Fri 13 Nov | Secrets export: every Replit secret, both panes, into a password manager (`removals.md` section 4) | ADAM |
| By Fri 13 Nov | Cloudflare: is the `app.valoxi.ai` A record proxied or DNS-only? Note the exact current record. Note the DO team name in `assessment.md` section 0 | ADAM |
| By Fri 13 Nov | Confirm Neon plan has point-in-time recovery (readiness section 4) | ADAM |
| By Fri 13 Nov | Check old Replit prod has `SMTP_ALERT_EMAIL` set (if not, the webhook failure alert has been silent there) | ADAM |
| By Fri 13 Nov | #574: the seven ALTERs and their rollback scripted and reviewed (`assessment.md` section 5) | CODE + ADAM |
| By Fri 13 Nov | Add a cutover env file for the real run: `.env.cutover` with `DST_URL` = Neon production branch DIRECT url (not pooled). Add a `-ExpectedDstHost` for the production endpoint. Never printed | ADAM, CODE prepares the commands |
| Sat 14 Nov | Viv signs up in Clerk dev on staging (viv@shiftopsconsulting.com) so the user 2 relink is tested | ADAM |
| Mon 16 Nov | Full dress rehearsal on staging against a fresh dump into a NEW Neon branch `rehearsal-3`: stop-watch every step of 6.5 to 6.11, including the rebuild. Record real downtime | ADAM + CODE |
| Thu 19 Nov | Notice period ends. Nothing to do except confirm the live pages still say 24 November | CODE checks |
| From Fri 20 Nov | Change freeze on `main`: only cutover-critical merges | ADAM |
| Mon 23 Nov, 12:00 | Last go/no-go on the preparation list (section 6). Decide: proceed or move the date. Moving the date means editing the live notice | ADAM |

## 3. T-24 hours: Monday 23 November, 19:00

| Time | Step | Owner |
|---|---|---|
| 19:00 | 6.1 Lower `app.valoxi.ai` TTL to 60 s. Write down the current record exactly (type, value, proxied or not) | ADAM |
| 19:10 | 6.2 Add `app.valoxi.ai` as a custom domain in DO (certificate stays pending, expected) | ADAM |
| 19:20 | 6.3 Prepare the production env var set in DO WITHOUT applying it. Includes `SMTP_ALERT_EMAIL`, prod R2 bucket and token, live Resend, marketing, Nylas, Stripe keys, prod Clerk keys, build-time `VITE_CLERK_PUBLISHABLE_KEY` and `GIT_SHA` | ADAM |
| 19:40 | 6.4 Tell active users: "Tuesday 24 November, 19:00 to about 20:30 UK, the app will be briefly unavailable. Expected downtime well under an hour" | ADAM |
| 19:45 | Confirm the final dump command and the restore command by dry run: `-Step Check`, then `-DryRun` of `Dump` and `Restore` | ADAM + CODE |

## 4. T-0: Tuesday 24 November. Each step reported before the next.

Hard rule: if there is no all-clear by **20:30** (90 minutes after the freeze), roll back (section 5).
Expected: all-clear by about 19:45 to 20:00. Rebuild time: **TBD from the DO build log**.

| Time | Step | Evidence to paste | Owner |
|---|---|---|---|
| 18:45 | Pre-flight: Clerk ID check and Stripe check dry runs, `-Step Check` on source and target, health of staging | outputs | ADAM + CODE |
| 19:00 | **6.5 Freeze.** Stop the Replit deployment. Confirm `app.valoxi.ai` errors. Timestamp this: it starts the downtime | timestamp | ADAM |
| 19:03 | **6.6 Final dump** with the local runner (`CountsBefore`, `Dump`, `CountsAfter`). The database no longer changes once the app is stopped, so `CompareDrift` must show 0 mismatches. Keep a second copy of the dump | counts, dump size | ADAM |
| 19:08 | **6.7 Restore** into the Neon production branch (target guard must be the production endpoint) | exit code 0 | ADAM |
| 19:10 | **6.8 Reconcile:** `RestoredCounts`, `CompareRestored`, `SourceStructure`, `RestoredStructure`, `CompareStructure`. All must be 0 mismatches. **If not, STOP: no DNS change.** Optionally run the Clerk and Stripe checks `--all` against production as go/no-go evidence (5 known Stripe status drifts are expected) | compare outputs | ADAM |
| 19:15 | **6.9 Apply the prod env set in DO and redeploy** (full rebuild). Check `/api/health` returns the new commit, and the log shows the new Neon host. Crons are live from here, only after the Replit stop in 6.5 | health output | ADAM |
| 19:30 | **6.10 Flip DNS.** Delete the A record, add the CNAME to the DO hostname (DNS-only). Wait for the certificate to go active | `nslookup`, https 200 | ADAM |
| 19:40 | **6.11 Verify live:** sign in as Adam (Clerk prod), open company 228, open a deal model, generate a PDF, upload and delete a test document, Stripe shows the webhook endpoint healthy on its next event | checklist | ADAM |
| 19:50 | **All-clear.** Timestamp it. Downtime = freeze to all-clear | timestamp | ADAM |
| 20:30 | Hard stop. No all-clear: roll back | decision | ADAM |

Stripe and Clerk retry failed webhooks for days, and the webhook URLs stay `app.valoxi.ai`, so events during the downtime are delivered afterwards.

## 5. Rollback (available for 7 days)

Flip DNS back (delete the CNAME, restore the A record `34.111.179.208`, keep the `replit-verify` TXT) and start the Replit deployment. The old database was not written to after the freeze, so it is exactly as it was. Anything written to the new database after the all-clear is lost; decide early. Replit still runs the old billing code, which is fine.

## 6. Go / no-go checklist (Mon 23 Nov, 12:00)

- Secrets exported and checked present in DO prod env set
- Cloudflare record noted, proxied status known
- Rehearsal 3 on 16 Nov passed with a measured rebuild time
- #574 ALTERs and rollback reviewed
- Dentiva (44) checked in Stripe (the other three are decided: leave to auto-cancel)
- Staging healthy on `main`; no unmerged cutover-critical work
- Neon PITR confirmed
- Users notified

## 7. After the night

| When | What | Owner |
|---|---|---|
| Wed 25 Nov, 02:00 | First prod backup lands in R2 `valoxi-documents/backups/`. Check | ADAM |
| Wed 25 Nov, 04:00 | First dunning run on prod: with the billing fix, subs 39, 68 and 104 become canceled if still past_due and cancelled in Stripe. Check logs | ADAM + CODE |
| Wed 25 Nov, 08:00 and 08:30 | Stripe webhook failure alert and Stripe reconciliation report arrive (or not) in `SMTP_ALERT_EMAIL`. Expect 44 flagged if still active | ADAM |
| Wed 25 Nov | 7.1 restore DNS TTL to 300 or 3600 | ADAM |
| Wed 25 Nov | 7.2, 7.3 recreate Neon `dev` from the new main, update local `.env`. 7.4 apply #574 with Adam's authorisation | CODE + ADAM |
| 25 Nov to 1 Dec | 7.5 watch the crons. 7.6 DO alerting. 7.7 cancel Replit AI integrations | ADAM |
| Tue 1 Dec (T+7) | Phase 8: confirm no traffic to Replit, last dump to R2 `backups/replit-final/`, delete the Replit deployment, remove Replit GitHub app | ADAM |
| After Phase 8 | Remove the Replit rows from privacy and DPA on the site (`valoxi-site`), bump "Last updated". Push needs the `AdamValoxi` gh account | CODE + ADAM |

## 8. Open questions that can move the date

1. Rebuild time on DO with the prod Clerk key (measure on 16 Nov).
2. Cloudflare proxied status of the current A record.
3. Dentiva (44) outcome in Stripe (the other three are decided).
4. Counsel's check of the two transfer-mechanism lines on the live pages (does not block the date).
