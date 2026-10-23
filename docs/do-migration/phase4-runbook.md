# Phase 4 runbook: rehearsal dump and restore

Run from `C:\Users\AdamAuty\valoxi` in Git Bash. Adam runs every step that touches the old
production database (4.3 and the source counts). Nothing here writes to the old database.
Connection strings stay in gitignored files and are never pasted into chat.

All `psql`, `pg_dump` and `pg_restore` calls go through the project Docker image, which has
the PostgreSQL 18 client. Build it first if `docker images valoxi` is empty:
`docker build --build-arg VITE_CLERK_PUBLISHABLE_KEY=pk_test_placeholder -t valoxi .`

## 0. One-off setup (Adam)

Create two files in the repo root. Both match `.env.*` in `.gitignore` and `.dockerignore`.
One line each, no quotes:

- `.env.prod`: `SRC_URL=<old Replit-owned DIRECT url, no -pooler>`
- `.env.rehearsal`: `DST_URL=<new Neon DIRECT url for the rehearsal branch, no -pooler>`

## 1. Create the rehearsal branch (Adam, Neon console, plan 4.1)

Project `billowing-block-98253807`, create branch `rehearsal` from `production`. Do not
restore into `production`: it stays clean until cutover. Database `neondb`, role
`neondb_owner`. Copy the DIRECT connection string into `.env.rehearsal`.

## 2. Source counts BEFORE the dump (Adam)

    export MSYS_NO_PATHCONV=1
    mkdir -p rehearsal
    docker run --rm --env-file .env.prod -v "$(pwd -W)/scripts/migration:/m:ro" --entrypoint sh valoxi -c 'psql "$SRC_URL" -X -A -t -F "|" -f /m/table-counts.sql; psql "$SRC_URL" -X -A -t -F "|" -f /m/spot-checks.sql' > rehearsal/source-before.txt
    grep -c '^COUNT|' rehearsal/source-before.txt

If the Docker route cannot reach the old database, run the same two SQL files from the
Replit shell instead and download the output.

## 3. Dump (Adam, plan 4.3)

    docker run --rm --env-file .env.prod -v "$(pwd -W)/rehearsal:/out" --entrypoint sh valoxi -c 'pg_dump "$SRC_URL" -Fc --no-owner --no-privileges -f /out/valoxi-rehearsal.dump'
    ls -l rehearsal/valoxi-rehearsal.dump

## 4. Source counts AFTER the dump (Adam)

Same command as step 2, output to `rehearsal/source-after.txt`.

    node scripts/migration/compare-counts.mjs rehearsal/source-before.txt rehearsal/source-after.txt

Production is live during the rehearsal, so tables that are written to constantly (session,
activity or audit rows) can differ between before and after. Any table that differs here is
EXPECTED to differ against the restored copy by the same kind of drift. Everything else must
match exactly. At cutover (6.8) the app is stopped, so there it must match on all rows.

## 5. Restore into the rehearsal branch (plan 4.4)

This writes to the new Neon `rehearsal` branch only. It does not touch the old database or
`production`.

    docker run --rm --env-file .env.rehearsal -v "$(pwd -W)/rehearsal:/in:ro" --entrypoint sh valoxi -c 'pg_restore -d "$DST_URL" --no-owner --no-privileges --clean --if-exists --exit-on-error /in/valoxi-rehearsal.dump' 2>&1 | tail -40

`--exit-on-error` is added to the plan's command so a partial restore cannot pass as
success. With `--clean --if-exists` on an empty branch, harmless "does not exist, skipping"
notices are normal.

## 6. Restored counts (plan 4.5, 4.6)

    docker run --rm --env-file .env.rehearsal -v "$(pwd -W)/scripts/migration:/m:ro" --entrypoint sh valoxi -c 'psql "$DST_URL" -X -A -t -F "|" -f /m/table-counts.sql; psql "$DST_URL" -X -A -t -F "|" -f /m/spot-checks.sql' > rehearsal/restored.txt
    node scripts/migration/compare-counts.mjs rehearsal/source-after.txt rehearsal/restored.txt

Tell Claude when done. Claude reads the comparison output, writes
`docs/do-migration/rehearsal-<date>.txt` and closes Gate 4.

## What this does not do

- It does not change the old production database.
- It does not touch Neon `production` or `throwaway`.
- It does not prove cutover timing. The 6.6 dump is taken with the app stopped.
