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
| Fri 6 Nov | DONE 2026-11-06: staging reconciliation email arrived at 08:30 (to adam@valoxi.ai, from noreply@send.valoxi.ai, subject "18 subscription(s) out of step with Stripe"). 18 checked, 0 status mismatches, 18 lookup errors, all `resource_missing`: expected, staging has live sub ids but Stripe test keys. Proves the job runs and the email delivers; the mismatch logic is covered by unit tests and first meets live Stripe on prod Wed 25 Nov. Adam is removing `SMTP_ALERT_EMAIL` from staging to stop the daily noise | ADAM |
| DECIDED 2026-11-05 | Four real customers (subs 39, 44, 68, 104). All dormant since July (last activity 18 Jun to 29 Jul). Leave 39, 68, 104 to be cancelled by the fixed dunning job on its first run; email no one. Dentiva (44): check Stripe for what happened after the 28 Aug payment (cancelled 26 Aug, invoice paid 28 Aug, app shows active), then mark cancelled by hand after cutover or contact the customer | ADAM |
| By Tue 10 Nov | Secrets export: every Replit secret, both panes, into a password manager (`removals.md` section 4) | ADAM |
| By Tue 10 Nov | DONE 2026-11-13: the `app.valoxi.ai` A record is **DNS-only** (not proxied), value `34.111.179.208` as in section 5. DO team name: **Valoxi** | ADAM |
| By Tue 10 Nov | DONE 2026-11-13: the Neon project was on the free plan (history window 6 hours at most). Adam upgraded to a paid plan and the history window is now **7 days**, applying to all branches. Connection strings unchanged | ADAM |
| By Tue 10 Nov | Check old Replit prod has `SMTP_ALERT_EMAIL` set (if not, the webhook failure alert has been silent there) | ADAM |
| By Tue 10 Nov | DONE 2026-11-12: #574 scripts (precheck, apply, rollback, both guards) proven on `rehearsal-3`. FINDING: old prod already has all seven constraints as ON DELETE CASCADE (true in the dumps of 23 Oct, 3 Nov and 12 Nov; `assessment.md` section 5 records SET NULL and NO ACTION on 16 Oct). So 7.4 should be a no-op: run the precheck, apply only if it does not show CASCADE x7 | CODE + ADAM |
| By Tue 10 Nov | Add a cutover env file for the real run: `.env.cutover` with `DST_URL` = Neon production branch DIRECT url (not pooled). Add a `-ExpectedDstHost` for the production endpoint. Never printed | ADAM, CODE prepares the commands |
| Mon 9 Nov | DONE 2026-11-06 (early): Viv signed up in Clerk dev on staging (viv@shiftopsconsulting.com) and the user 2 relink worked. Viv reports no issues so far | ADAM |
| Wed 11 Nov | DONE 2026-11-12 (a day late): rehearsal 3 passed, see `rehearsal-2026-11-12.txt`. Counts 94/94, sequences 92/92, spot 4/4, structure 10/10, 0 mismatches. Dump 58 s. Restore 6 min 30 s because ProtonVPN was on (221 ms per round trip); 22 s expected with it off. Rebuild about 5 minutes Save to Live. Production branch confirmed empty | ADAM + CODE |
| By Tue 10 Nov | DONE 2026-11-12: secrets collected into gitignored `.env.do-prod` (39 names, all format checks pass) with `scripts/migration/collect-prod-secrets.ps1`; `.env.cutover` and `.env.rehearsal3` hold the direct and pooled Neon strings (`scripts/migration/set-dst-url.ps1`). Production endpoint `ep-cold-night-za5w03lp`. `SMTP_ALERT_EMAIL` is set on old Replit prod | ADAM + CODE |
| Before the link goes out | Black Friday offer (live on the site 2026-11-12 at `valoxi.ai/black-friday/`, also served at `/event/`; ends 23:59 GMT Mon 30 Nov, so it spans the cutover). Needs, on OLD prod: Stripe live coupon `BF26_ANNUAL_PRO` ($686.16 off, Professional only) and two `promo_code_campaigns` rows, slugs `bf26-free-month` and `bf26-annual`, `expires_at` 2026-12-01 00:00:00 UTC. Data only, no code change: the promo and checkout code is identical on `replit-final` and `main`. The rows reach new prod in the cutover dump; the coupon lives in Stripe and needs nothing | ADAM |
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
Expected: all-clear by about 19:45 to 20:00. Rebuild time: **about 5 minutes from Save to Live** (measured on staging in rehearsal 3, 2026-11-12; the 15 minutes allowed for 6.9 is ample).

| Time | Step | Evidence to paste | Owner |
|---|---|---|---|
| 18:45 | Pre-flight: **VPN off** (rehearsal 3 on 12 Nov: with ProtonVPN on, the restore took 6 min 30 s instead of 22 s). Clerk ID check and Stripe check dry runs, `-Step Check` on source and target, health of staging | outputs | ADAM + CODE |
| 19:00 | **6.5 Freeze.** Stop the Replit deployment. Confirm `app.valoxi.ai` errors. Timestamp this: it starts the downtime | timestamp | ADAM |
| 19:03 | **6.6 Final dump** with the local runner (`CountsBefore`, `Dump`, `CountsAfter`). The database no longer changes once the app is stopped, so `CompareDrift` must show 0 mismatches. Keep a second copy of the dump | counts, dump size | ADAM |
| 19:08 | **6.7 Restore** into the Neon production branch (target guard must be the production endpoint) | exit code 0 | ADAM |
| 19:10 | **6.8 Reconcile:** `RestoredCounts`, `CompareRestored`, `SourceStructure`, `RestoredStructure`, `CompareStructure`. All must be 0 mismatches. **If not, STOP: no DNS change.** Optionally run the Clerk and Stripe checks `--all` against production as go/no-go evidence (5 known Stripe status drifts are expected). Black Friday: confirm both campaign rows arrived, `select slug, is_active, expires_at from promo_code_campaigns where slug like 'bf26-%'` must return 2 rows | compare outputs | ADAM |
| 19:15 | **6.9 Apply the prod env set in DO and redeploy** (full rebuild). Check `/api/health` returns the new commit, and the log shows the new Neon host. Crons are live from here, only after the Replit stop in 6.5 | health output | ADAM |
| 19:30 | **6.10 Flip DNS.** Delete the A record, add the CNAME to the DO hostname (DNS-only). Wait for the certificate to go active | `nslookup`, https 200 | ADAM |
| 19:40 | **6.11 Verify live:** sign in as Adam (Clerk prod), open company 228, open a deal model, generate a PDF, upload and delete a test document, Stripe shows the webhook endpoint healthy on its next event. Black Friday: on `valoxi.ai/black-friday/` click both offer buttons and confirm Stripe Checkout opens (free month: 1 month trial, $167 after; annual: $917.04 after the 7-day trial). Do not pay | checklist | ADAM |
| 19:50 | **All-clear.** Timestamp it. Downtime = freeze to all-clear | timestamp | ADAM |
| 20:30 | Hard stop. No all-clear: roll back | decision | ADAM |

Stripe and Clerk retry failed webhooks for days, and the webhook URLs stay `app.valoxi.ai`, so events during the downtime are delivered afterwards.

Black Friday during the freeze: the offer page stays up (it is on Cloudflare Pages) but its buttons call `app.valoxi.ai`, so from 19:00 until the all-clear a visitor gets "Checkout did not open" with a contact link. Do not schedule a Black Friday email or ad push for Tuesday evening. On rollback the offers keep working: the rows are still on old prod.

## 5. Rollback (available for 7 days)

Flip DNS back (delete the CNAME, restore the A record `34.111.179.208`, keep the `replit-verify` TXT) and start the Replit deployment. The old database was not written to after the freeze, so it is exactly as it was. Anything written to the new database after the all-clear is lost; decide early. Replit still runs the old billing code, which is fine.

## 6. Go / no-go checklist (Mon 23 Nov, 12:00)

- Secrets exported and checked present in DO prod env set. State 2026-11-13: collected in `.env.do-prod` (39 of 39); NOT yet in a password manager, Replit is the source of truth until it is taken down. They MUST be in a password manager before Phase 8 deletes the Replit deployment
- Cloudflare record noted, proxied status known
- Rehearsal 3 on 11 Nov passed with a measured rebuild time
- #574 ALTERs and rollback reviewed
- Dentiva (44) checked in Stripe (done 2026-11-13: Stripe shows the subscription cancelled on 26 Aug, so the app's "active" is wrong. After cutover mark sub 44 cancelled by hand; the Wed 25 Nov 08:30 reconciliation report will flag it until then. Not yet looked at: whether the 28 Aug payment was for a period after the cancellation and should be refunded, Adam's call). The other three are decided: leave to auto-cancel
- Staging healthy on `main`; no unmerged cutover-critical work
- Neon PITR confirmed (done 2026-11-13: paid plan, history window 7 days; glance at Settings again on the day to see it still says 7 days)
- Users notified
- Black Friday: both `bf26-` campaign rows on old prod, both buttons open Stripe Checkout at the right price, no Black Friday send planned for Tuesday evening

## 7. After the night

| When | What | Owner |
|---|---|---|
| Wed 25 Nov, 02:00 | First prod backup lands in R2 `valoxi-documents/backups/`. Check | ADAM |
| Wed 25 Nov, 04:00 | First dunning run on prod: with the billing fix, subs 39, 68 and 104 become canceled if still past_due and cancelled in Stripe. Check logs | ADAM + CODE |
| Wed 25 Nov, 08:00 and 08:30 | Stripe webhook failure alert and Stripe reconciliation report arrive (or not) in `SMTP_ALERT_EMAIL`. Expect 44 flagged if still active | ADAM |
| Wed 25 Nov | 7.1 restore DNS TTL to 300 or 3600 | ADAM |
| Wed 25 Nov | Mark Dentiva (sub 44) cancelled by hand on new prod (Stripe: cancelled 26 Aug). Script file, Adam's authorisation | CODE + ADAM |
| Wed 25 Nov | 7.2, 7.3 recreate Neon `dev` from the new main, update local `.env`. 7.4 #574: run `574-precheck.sql` on new prod; expected CASCADE x7 already (see section 2), so nothing to apply. Apply only if it differs, with Adam's authorisation | CODE + ADAM |
| Tue 1 Dec, 00:00 UTC | Black Friday offers expire on the server (`expires_at`); the page shows its closed state by itself. Afterwards point `/event` at the next campaign or leave it | ADAM |
| 25 Nov to 1 Dec | 7.5 watch the crons. 7.6 DO alerting. 7.7 cancel Replit AI integrations | ADAM |
| Tue 1 Dec (T+7) | Phase 8: FIRST confirm every secret is in a password manager (Replit is the only master copy until then), then confirm no traffic to Replit, last dump to R2 `backups/replit-final/`, delete the Replit deployment, remove Replit GitHub app | ADAM |
| After Phase 8 | Remove the Replit rows from privacy and DPA on the site (`valoxi-site`), bump "Last updated". Push needs the `AdamValoxi` gh account | CODE + ADAM |

## 8. Open questions that can move the date

1. CLOSED 2026-11-12: rebuild time on DO is about 5 minutes.
2. CLOSED 2026-11-13: the A record is DNS-only.
3. CLOSED 2026-11-13: Dentiva (44) is cancelled in Stripe since 26 Aug. Does not move the date.
4. Counsel's check of the two transfer-mechanism lines on the live pages (does not block the date).
