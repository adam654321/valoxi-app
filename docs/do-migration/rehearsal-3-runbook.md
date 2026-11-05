# Rehearsal 3: dress rehearsal, Monday 16 November 2026

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
$r3 = @{ DstEnv = '.env.rehearsal3'; OutDir = 'rehearsal3'; ExpectedDstHost = 'ep-REPLACE-WITH-REHEARSAL3-ENDPOINT' }
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
.\scripts\migration\rehearsal-run.ps1 -Step Check -DstEnv .env.cutover -OutDir rehearsal3 -ExpectedDstHost ep-REPLACE-WITH-PRODUCTION-ENDPOINT
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

## Record

Paste the ELAPSED lines from Part 1, the Part 2 table count, and the Part 3 build and live times to Claude. They go into `rehearsal-2026-11-16.txt` and `cutover-timeline.md` section 4. Do NOT run Clerk or Stripe checks against old prod keys again unless asked.

## Clean up

Leave `rehearsal-3` in Neon until the cutover is done, then delete it. Delete `rehearsal3\valoxi-rehearsal.dump` from your disk after the cutover; it holds customer data.
