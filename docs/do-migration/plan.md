# PLAN: move Valoxi off Replit to DigitalOcean App Platform

**Workstream:** do-migration
**Written:** 22 October 2026, from the `de39a9f` export (the live publish commit)
**Local repo:** `C:\Users\AdamAuty\Valoxi`
**Audience:** Claude Code, executing step by step with Adam. Each phase ends with a
verification gate. Do not start the next phase until the gate passes and Adam says go.
**Companion docs:** `assessment.md` (findings and reasoning), `removals.md` (tick list).

---

## 0. THE SHAPE OF THE JOB

Only the Node process moves. The database moves once, by dump and restore, because the
current Neon project is owned by Replit's account and cannot be adopted. Everything else
(R2 bucket, Clerk, Stripe, Resend, Nylas, Gemini) is external and keyed to
`app.valoxi.ai`, which does not change.

```
TODAY     browser -> app.valoxi.ai -> Replit autoscale -> Neon (Replit-owned) + R2
AFTER     browser -> app.valoxi.ai -> DO App Platform  -> Neon (Adam-owned)   + R2 (same bucket)
```

Cutover is: stop Replit, final dump, restore, flip DNS. Target downtime ten minutes at
03:00 UK. Replit stays intact as the rollback for seven days.

**Rules that apply throughout**

- Nothing on Replit is deleted until phase 8. Replit is the rollback.
- No data cleanup during migration. The 41 dead-reference models, the 569 NULL-source
  rows and the SET NULL constraints all migrate exactly as they are. Fix them afterwards on
  the new database. Two changes at once is how you lose track.
- Every production write, on either side, is authorised by Adam in his own message. Never
  asserted inside a prompt or a script.
- Secrets never enter the repo. `.env` is gitignored. Values live in a password manager
  and in DO's encrypted env vars.
- Every count is timestamped. Prod accretes while we measure it.
- Prefer the smallest change that works. This is a lift, not a refactor.

---

## PHASE 0: DECISIONS AND ACCOUNTS (Adam, before any code)

| # | Decision | Default | Why it matters |
|---|---|---|---|
| 0.1 | **Region.** DO and Neon must be in the same region | **London (lon1) and Neon eu-west-2 or eu-central-1, whichever Neon offers nearest** | Users are UK. Today every query crosses the Atlantic. Decide once; moving the DB twice is pointless |
| 0.2 | **Neon account.** Adam's own, new project `valoxi` | Create at console.neon.tech, Launch or Scale plan for PITR and branching | Owning the DB is the whole point. PITR replaces the `/tmp` backup cron |
| 0.3 | **GitHub repo.** New private repo `valoxi-app` under Adam's org | Create empty, no README | DO App Platform deploys from GitHub. Replit's git goes away |
| 0.4 | **DO account and project.** Project `Valoxi` | Billing in place, GitHub connected to DO | |
| 0.5 | **DNS.** Confirm where `app.valoxi.ai` is managed (Cloudflare, since the marketing site is on Pages) and that Adam can edit it | | Cutover is a DNS change. TTL must be lowered 24h before |
| 0.6 | **Secrets export.** Copy every Replit secret (app and deployment panes, they can differ) into a password manager entry | Checklist in `removals.md` §4 | The secrets are the only thing on Replit that does not exist anywhere else |
| 0.7 | **Cutover window.** A weeknight 03:00 UK, with the following morning free | | |

**Gate 0:** all seven answered and recorded at the top of `assessment.md` §0.

---

## PHASE 1: LOCAL BASELINE

Prove the code runs outside Replit before changing anything.

1.1 Node 22 and npm installed locally (`.replit` pins `nodejs-22`). `node -v` prints 22.x.
1.2 In `C:\Users\AdamAuty\Valoxi`: `npm ci`. Record any install warnings.
1.3 Create `.env` from `.env.example` (created in 1.4). Point `DATABASE_URL` at a
    throwaway Neon branch, NOT at Replit prod. `PROD_DATABASE_URL` stays unset locally until
    phase 7.
1.4 Create `.env.example` listing every variable in `assessment.md` §3 with empty values.
    Commit it. Add `.env` to `.gitignore` if absent.
1.5 `npm run check`. **Expected: exit 0, zero TypeScript errors** (baseline per #537).
1.6 `npx vitest run`. **Expected: 34 files, 559 tests passed.** If tests need a database,
    they use the throwaway branch from 1.3. Record which tests, if any, need one.
1.7 `npm run build`. Expected: `dist/index.js` and `dist/public/` produced.
1.8 `npm run dev` with the throwaway DB. Hit `http://localhost:5000`. Expected: the
    sign-in page renders. Clerk will not authenticate on localhost against the prod
    instance; that is expected and is covered in phase 5.

**Gate 1:** 1.5, 1.6, 1.7 clean. Record the numbers with a timestamp in `assessment.md`.

---

## PHASE 2: DE-REPLIT THE CODE

Small, surgical, one commit per item. Each item has a grep assertion.

2.1 **Vite plugins.** `vite.config.ts`: remove the `@replit/vite-plugin-runtime-error-modal`
    import and use, and the conditional `@replit/vite-plugin-cartographer` block.
    `npm uninstall @replit/vite-plugin-runtime-error-modal @replit/vite-plugin-cartographer`.
    Assert: `grep -c "@replit" vite.config.ts` is 0.
2.2 **Unused package.** `npm uninstall @replit/object-storage`.
    Assert: `grep -rc "@replit/object-storage" server shared client` all 0 (it already is;
    this removes the dependency only).
2.3 **Config fields.** `server/config.ts:39-42` reads `REPLIT_DEV_DOMAIN`, `REPL_SLUG`,
    `REPL_OWNER`, `REPL_ID` into `config.replit.*`. First: `grep -rn "config.replit\|replSlug\|replOwner\|replId\|devDomain" server client shared --include=*.ts --include=*.tsx`.
    If zero consumers, delete the block. If consumers exist, STOP and report before editing.
2.4 **APP_URL fallbacks.** `server/config.ts:5-9` and `server/middleware/csrf.ts:52-70`
    fall back to `REPLIT_DOMAINS`. Leave the logic, it is harmless when `APP_URL` is set.
    Change only the warning text in csrf.ts so it no longer mentions `REPLIT_DOMAINS`.
    On DO, `APP_URL=https://app.valoxi.ai` is mandatory. Add a startup assertion in
    `server/index.ts`: in production, throw if `APP_URL` is unset.
2.5 **Health endpoint.** Add `GET /api/health` returning
    `{ ok: true, commit: process.env.GIT_SHA ?? 'unknown', node: process.version, uptime }`.
    No auth, no DB call. DO uses it as the health check. This closes #552.1 (the deployment
    could never report its running commit). `GIT_SHA` is set by the Dockerfile build arg in
    2.8.
2.6 **Backup cron.** `server/cron/backup.cron.ts` writes to `/tmp`, which is ephemeral on
    both platforms. Change the destination to the R2 bucket under `backups/` with the same
    7-day prune, using the existing `fileStorageService` client. Keep the schedule. Neon PITR
    is the real safety net; this is belt and braces and it is cheap.
2.7 **Gemini warning noise.** `server/services/gemini-client.ts:91` logs at every client
    construction. Log once per process (module-level flag). Cosmetic, but it is ERROR level
    in prod logs and will drown real errors.
2.8 **Dockerfile** at repo root:
    ```
    FROM node:22-bookworm-slim
    RUN apt-get update && apt-get install -y --no-install-recommends \
          chromium fonts-liberation ca-certificates postgresql-client \
        && rm -rf /var/lib/apt/lists/*
    ENV PUPPETEER_SKIP_DOWNLOAD=1 PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium NODE_ENV=production
    WORKDIR /app
    COPY package.json package-lock.json ./
    RUN npm ci
    COPY . .
    ARG GIT_SHA=unknown
    ENV GIT_SHA=$GIT_SHA
    RUN npm run build && npm prune --omit=dev
    EXPOSE 8080
    CMD ["node", "dist/index.js"]
    ```
    `postgresql-client` is for `pg_dump` from the DO console during the migration and for
    the backup cron. `.dockerignore`: `node_modules`, `dist`, `.git`, `uploads`,
    `attached_assets`, `audit`, `playwright-report`, `test-results`, `*.log`, `.env*`.
2.9 **Local Docker proof.** `docker build -t valoxi .` then
    `docker run --env-file .env -p 8080:8080 valoxi`. Expected: `/api/health` returns 200,
    sign-in page renders, and one PDF generation path works (Puppeteer finds Chromium).
    If Docker is not installed locally, this proof moves to the DO staging deploy in 5.4.
2.10 **Delete Replit files.** `.replit`, `replit.md`, `.config/` (untracked), `nohup.out`,
    `tier2-run.log`. Move anything useful from `replit.md` into `docs/` first.
2.11 **Repo hygiene.** `uploads/` (19 MB of local test files) and `attached_assets/`
    (5 MB) are checked in. Leave them this pass; note for later.

**Gate 2:** `npm run check` 0 errors, `npx vitest run` 559 passed, `npm run build` clean,
`grep -rc "REPL_\|REPLIT_\|@replit" server shared client vite.config.ts package.json`
shows only the two tolerated fallbacks in config.ts and csrf.ts. Docker proof done or
explicitly deferred to 5.4.

---

## PHASE 3: GITHUB

3.1 `git remote -v`. Remove any Replit remote. Add `origin` = the new GitHub repo.
3.2 Confirm `.env` is not tracked: `git ls-files | grep -c "^\.env$"` must be 0. Scan
    history for secrets before the first push: `git log -p | grep -cE "AIza[0-9A-Za-z_-]{35}|sk_live_|whsec_|re_[A-Za-z0-9]{20,}"`.
    If nonzero, STOP and report. Rewriting history is a separate decision for Adam.
3.3 `git push -u origin main`.
3.4 Branch protection on `main`: require PR, no force push. Feature branches from here on.
3.5 Tag the pre-migration commit: `git tag replit-final de39a9f && git push --tags`.

**Gate 3:** repo visible on GitHub at the right commit, tag present, secret scan zero.

---

## PHASE 4: NEON AND THE REHEARSAL RESTORE

4.1 In the new Neon project, create database `neondb`, role `neondb_owner` (matching the
    dump's expectations so `--no-owner` is not strictly required, but use it anyway).
4.2 Record the pooled and direct connection strings in the password manager. The app uses
    the pooled one. `pg_dump`/`pg_restore` use the direct one.
4.3 **Rehearsal dump from Replit prod**, run from the Replit workspace shell (it has the
    network path and `pg_dump`):
    ```
    pg_dump "$PROD_DATABASE_URL" -Fc --no-owner --no-privileges -f /tmp/valoxi-rehearsal.dump
    ```
    Download it. This is a read; it needs no authorisation, but say what you are doing.
4.4 **Restore locally** into the new Neon project's main branch:
    ```
    pg_restore -d "<NEW_DIRECT_URL>" --no-owner --no-privileges --clean --if-exists /tmp/valoxi-rehearsal.dump
    ```
4.5 **Count reconciliation.** Create `scripts/migration/table-counts.sql`:
    ```
    SELECT relname, n_live_tup FROM pg_stat_user_tables ORDER BY relname;
    ```
    is an estimate. Use exact counts: generate `SELECT 'table', count(*) FROM table UNION ALL ...`
    for all 92 tables from `information_schema.tables`. Run on both sides within the same
    minute. Every row must match. Also compare `SELECT last_value FROM <each sequence>` for
    every sequence. Save both outputs in `docs/do-migration/rehearsal-<date>.txt`.
4.6 Spot checks beyond counts: `SELECT max(id), max(created_at) FROM documents`,
    `deal_models`, `financial_periods`, `document_evidence`. Same both sides.
4.7 Create a Neon branch `dev` from main. This is the local development database from now
    on. Point local `.env` at it. Re-run `npx vitest run` against it.

**Gate 4:** rehearsal counts match on all 92 tables and all sequences. Recorded with
timestamps. Adam has seen the file.

---

## PHASE 5: DO APP PLATFORM, STAGING

5.1 Create the app from the GitHub repo, Dockerfile build, region per 0.1, **one instance**
    (the crons run in-process and must not double-fire), smallest instance size that holds
    Puppeteer (1 GB RAM minimum; start at 1 vCPU / 2 GB).
5.2 HTTP port 8080. Health check path `/api/health`.
5.3 Env vars: every variable in `assessment.md` §3, marked as secrets. For staging:
    - `DATABASE_URL` = the Neon `dev` branch pooled URL
    - `APP_URL` = the DO default URL (`https://valoxi-xxxxx.ondigitalocean.app`)
    - Clerk: **development instance** keys, with the DO URL added as an allowed origin in
      Clerk's dev instance. Production Clerk keys are bound to `valoxi.ai` and will not
      work on the staging URL.
    - Stripe: **test mode** keys and a test-mode webhook endpoint pointing at the staging URL.
    - `GOOGLE_GEMINI_API_KEY`: the real key (rotated per #559 if that has happened).
    - R2: the real bucket. Uploads from staging land in the real bucket under the normal
      key scheme; this is acceptable because staging is pointed at the dev database and
      keys are per document id. If Adam prefers isolation, create `valoxi-documents-dev`.
5.4 Deploy. Confirm `/api/health` shows the right commit SHA. Confirm the build log shows
    Chromium installed.
5.5 **Smoke list, all must pass on staging:**
    - Sign up and sign in via Clerk dev instance
    - Create a target company, upload a PDF, watch it classify and extract (Gemini call
      with the `x-goog-api-key` header; log shows the 8-char prefix)
    - Open the deal model, generate an offer PDF (Puppeteer)
    - Delete the document; confirm its figures leave the database (#577)
    - Stripe test checkout completes and the webhook is received (billing.routes.ts:67)
    - Clerk webhook `/api/webhooks/clerk` receives a user.created event
    - Portal submission flow (token link) works
    - One cron fires: temporarily schedule the backup cron for two minutes ahead, confirm a
      file lands in R2 under `backups/`, revert the schedule
5.6 Load the app for ten minutes of normal use. Check DO logs for anything at ERROR that
    was not there on Replit.

**Gate 5:** every smoke item ticked by Adam personally, not narrated by a tool.

---

## PHASE 6: CUTOVER

**T minus 24 hours**
6.1 Lower `app.valoxi.ai` TTL to 60 seconds in DNS. Note the current target (the Replit
    CNAME) in `assessment.md` so it can be restored.
6.2 In DO, add `app.valoxi.ai` as a custom domain. DO issues a certificate once DNS points
    at it; it will show pending until then. That is expected.
6.3 Prepare the production env var set in DO but do not apply it yet: prod Clerk keys,
    live Stripe keys and the existing live webhook secret, `APP_URL=https://app.valoxi.ai`,
    `DATABASE_URL` = new Neon main pooled URL.
6.4 Tell users, if any are active, that there is a ten-minute window at 03:00.

**T zero, 03:00 UK. Adam present. Each step reported before the next.**
6.5 **Freeze.** Stop the Replit deployment (Deployments pane, Stop). Confirm
    `https://app.valoxi.ai` returns an error. This is the write freeze. Timestamp it.
6.6 **Final dump** from the Replit workspace shell (the workspace still runs; only the
    deployment is stopped):
    `pg_dump "$PROD_DATABASE_URL" -Fc --no-owner --no-privileges -f /tmp/valoxi-final.dump`
    Download it. Keep a second copy somewhere safe immediately.
6.7 **Restore** into Neon main. Main still holds the rehearsal data, so:
    `pg_restore -d "<NEW_DIRECT_URL>" --no-owner --no-privileges --clean --if-exists /tmp/valoxi-final.dump`
    `--clean` drops and recreates each object before loading it.
6.8 **Count reconciliation**, same script as 4.5, both sides. All 92 tables and all
    sequences must match. If one does not, STOP. Do not flip DNS. Investigate or roll back
    (6.12).
6.9 Apply the production env var set to the DO app (6.3). Redeploy. Confirm `/api/health`
    and that the log shows the app connecting to the new Neon host.
6.10 **Flip DNS.** `app.valoxi.ai` CNAME to the DO app hostname. Wait for DO's certificate to
    go active (usually under five minutes with a 60s TTL).
6.11 **Verify live:** sign in as Adam (Clerk prod), open company 228, open a deal model,
    generate a PDF, upload and delete a test document, check Stripe dashboard shows the
    webhook endpoint healthy on its next event (or send a test event from Stripe).
    Timestamp the all-clear. Downtime = 6.5 to 6.11.

**Rollback, available for seven days**
6.12 Flip DNS back to the Replit CNAME. Start the Replit deployment. The old database was
    never written to after 6.5, so it is exactly as it was at the freeze. Anything written to
    the new database after 6.11 is lost; that is the only cost, and it shrinks to zero the
    sooner the decision is made.

---

## PHASE 7: AFTER CUTOVER

7.1 Restore DNS TTL to 300 or 3600.
7.2 Recreate the Neon `dev` branch from the new main so dev is a known copy of prod on a
    known date. This closes the "dev branch identity" item parked since August.
7.3 Local `.env`: `DATABASE_URL` = dev branch. `PROD_DATABASE_URL` = new prod, inspection
    only by convention, exactly as before. Every prod query is still
    `DATABASE_URL="$PROD_DATABASE_URL"`.
7.4 **#574.** The seven constraints restored as SET NULL and NO ACTION, because the dump
    carries them as they were. Apply the seven ALTERs by exact constraint name on the new
    prod, rollback to hand, with Adam's authorisation. Constraint names and current states
    are in `assessment.md` §5.
7.5 Watch the crons for a week. Billing at 04:00, 08:00, 09:00, 09:05, 09:15 and hourly;
    chase-up at 09:00; backup at 02:00. They now run on a process that never sleeps, so
    expect them to fire for the first time reliably. Check for any that misbehave when they
    actually run.
7.6 Add DO alerting: deploy failure, health check failure, CPU and memory thresholds.
7.7 Cancel Replit AI integrations if still billed. Do not delete the Repl.
7.8 Update `claude/START-HERE.md` baselines: new prod host prefix, new dev identity, the
    `/api/health` endpoint now exists.

---

## PHASE 8: DECOMMISSION REPLIT (day 7 or later)

8.1 Confirm no traffic has reached Replit for seven days (its logs are empty).
8.2 Take one last `pg_dump` of the Replit database and store it in R2 under
    `backups/replit-final/`. Belt and braces.
8.3 Delete the Replit deployment. Keep the Repl itself for 30 days as a code archive, then
    delete it or leave it; it costs nothing stopped.
8.4 Remove the Replit GitHub app or any other Replit integration from GitHub.
8.5 Close the workstream: action log pack, `removals.md` fully ticked, `START-HERE.md`
    updated.

---

## WHAT RESUMES AFTER THIS

The v84.1 §6 sequence, on the new platform, with one difference: deploys are `git push`
to `main`, and the implementer is Claude Code with a local checkout, not Replit via relay.
Assess, build, authorise, apply, V-check still applies. Next up is #574 (phase 7.4 above),
then #549, the one-calculation rework, once Adam answers the screen-recompute question.
