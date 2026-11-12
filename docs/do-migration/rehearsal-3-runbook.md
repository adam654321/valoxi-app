# Rehearsal 3: dress rehearsal, Wednesday 11 November 2026

Purpose: run the data move and the app steps of cutover end to end with a stopwatch, on a fresh dump, WITHOUT touching the Neon `production` branch and WITHOUT changing the live app. Output: the real downtime number and the DO rebuild time for `cutover-timeline.md` section 4.

Run in Windows PowerShell from the repo root `C:\Users\AdamAuty\valoxi`. Never paste connection strings or keys into chat. Old prod is only read.

## Part 0: one-off setup (about 10 minutes)

1. Neon console, project `billowing-block-98253807`: create branch `rehearsal-3` from `production` (empty), no expiry. Copy its DIRECT connection string (not pooled) and note the endpoint name (looks like `ep-xxxx-xxxx-xxxxxxxx`).
2. Create `.env.rehearsal3` in the repo root (gitignored, same pattern as `.env.rehearsal`), one line: `DST_URL="<rehearsal-3 DIRECT url>"`.
3. Read the endpoint of the Neon `production` branch in the console, create `.env.cutover` with `DST_URL="<production DIRECT url>"`. This file is only used by the read-only `Check` below until the real night.

## Part 1: data move, with timings

Allow scripts for this window only, and set the rehearsal-3 options once:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
```

```powershell
$r3 = @{ DstEnv = '.env.rehearsal3'; OutDir = 'rehearsal3'; ExpectedDstHost = 'ep-dry-bonus-zay1bg7r' }
```

Then, one at a time. Every step prints ELAPSED; write the numbers down.

```powershell
.\scripts\migration\rehearsal-run.ps1 -Step Check @r3
```

```powershell
.\scripts\migration\rehearsal-run.ps1 -Step CountsBefore @r3
```

```powershell
.\scripts\migration\rehearsal-run.ps1 -Step Dump @r3
```

```powershell
.\scripts\migration\rehearsal-run.ps1 -Step CountsAfter @r3
```

```powershell
.\scripts\migration\rehearsal-run.ps1 -Step CompareDrift @r3
```

```powershell
.\scripts\migration\rehearsal-run.ps1 -Step Restore @r3
```

```powershell
.\scripts\migration\rehearsal-run.ps1 -Step RestoredCounts @r3
```

```powershell
.\scripts\migration\rehearsal-run.ps1 -Step CompareRestored @r3
```

```powershell
.\scripts\migration\rehearsal-run.ps1 -Step SourceStructure @r3
```

```powershell
.\scripts\migration\rehearsal-run.ps1 -Step RestoredStructure @r3
```

```powershell
.\scripts\migration\rehearsal-run.ps1 -Step CompareStructure @r3
```

Expected: COUNT lines 94, `CompareDrift` and `CompareRestored` show only the live `session` row (on the real night the app is stopped, so 0), structure `STRUCT=10 mismatches=0`.

## Part 2: production branch still empty and reachable (read only)

```powershell
.\scripts\migration\rehearsal-run.ps1 -Step Check -DstEnv .env.cutover -OutDir rehearsal3 -ExpectedDstHost ep-cold-night-za5w03lp
```

Must say `tables in public: 0`. If it shows tables, STOP and tell Claude: something was restored into production.

## Part 3: rebuild timing on staging (the unknown in the timeline)

Cutover changes a BUILD_TIME variable (`VITE_CLERK_PUBLISHABLE_KEY`), which forces a full image rebuild. Measure that on staging without changing any behaviour:

1. DO console, `valoxi-staging`, Settings, change the build-time variable `GIT_SHA` to any new value (for example `rehearsal3`). Save. DO rebuilds the image.
2. Open the deployment, note the Build duration and the total time until Live. Write both down.
3. Check health:

```powershell
(Invoke-RestMethod https://squid-app-5dwfn.ondigitalocean.app/api/health).ok
```

4. Optional: set `GIT_SHA` back, or leave it. It is only a label.

## Part 4: optional, app against the restored copy

Only if time allows. Staging uses Clerk DEV keys, so signing in will not match the production Clerk ids in the restored data; this checks that the app starts and migrations behave, not logins.

1. DO console, staging, set `DATABASE_URL` to the `rehearsal-3` POOLED url. Save (redeploy).
2. Runtime Logs: confirm it connects to the `rehearsal-3` host and starts without errors.
3. Put `DATABASE_URL` back to the dev branch value. Confirm health again.

## Part 5: test the #574 scripts on rehearsal-3 (only this branch)

Proves `574-precheck.sql`, `574-apply.sql` and `574-rollback.sql` work on a real restored copy. Run after Part 1 has restored into `rehearsal-3`. These scripts CHANGE the database, so the guard below refuses anything except the rehearsal-3 endpoint. Never point them at the production branch or old prod during the rehearsal.

Set up once (reads the URL from `.env.rehearsal3` and never prints it). Replace the endpoint with the rehearsal-3 one:

```powershell
$psql = 'C:\Program Files\PostgreSQL\18\bin\psql.exe'; $r3host = 'ep-dry-bonus-zay1bg7r'; $u = ((Get-Content .env.rehearsal3 | Where-Object { $_ -like 'DST_URL=*' } | Select-Object -First 1).Substring(8)).Trim().Trim('"').Trim("'"); if ($u -notlike "*$r3host*") { throw 'URL is not the rehearsal-3 endpoint. STOP.' } else { 'target is rehearsal-3' }
```

1. Before: expect SET NULL x5, NO ACTION x2 and `FK574_FOUND|7`.

```powershell
& $psql $u -X -A -t -F '|' -f scripts\migration\574-precheck.sql -o rehearsal3\574-before.txt; Get-Content rehearsal3\574-before.txt
```

2. Apply. Must end with `COMMIT` and no ERROR.

```powershell
& $psql $u -X -f scripts\migration\574-apply.sql
```

3. After apply: expect CASCADE x7 and `FK574_FOUND|7`.

```powershell
& $psql $u -X -A -t -F '|' -f scripts\migration\574-precheck.sql -o rehearsal3\574-after-apply.txt; Get-Content rehearsal3\574-after-apply.txt
```

4. Rollback. Must end with `COMMIT` and no ERROR.

```powershell
& $psql $u -X -f scripts\migration\574-rollback.sql
```

5. After rollback: must be identical to step 1 (the dependent-row counts too).

```powershell
& $psql $u -X -A -t -F '|' -f scripts\migration\574-precheck.sql -o rehearsal3\574-after-rollback.txt; fc.exe rehearsal3\574-before.txt rehearsal3\574-after-rollback.txt
```

Expected: `FC: no differences encountered`.

If a guard aborts (`guard: <constraint> is ..., expected ...`), nothing was changed. Paste the message to Claude: the real prod definition differs from the docs and the script needs adjusting before the real run. Leave the branch in the rolled-back state (step 5) so it matches production.

## Record

Paste the ELAPSED lines from Part 1, the Part 2 table count, the Part 3 build and live times, and the Part 5 outputs (or any guard message) to Claude. They go into `rehearsal-2026-11-11.txt` and `cutover-timeline.md` section 4. Do NOT run Clerk or Stripe checks against old prod keys again unless asked.

## Clean up

Leave `rehearsal-3` in Neon until the cutover is done, then delete it. Delete `rehearsal3\valoxi-rehearsal.dump` from your disk after the cutover; it holds customer data.
