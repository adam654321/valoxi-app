# ASSESSMENT: Replit to DigitalOcean migration

**Assessed:** 22 October 2026 against the `de39a9f` export, which is the live publish
commit of 16 October plus nothing (the export's working tree matches HEAD apart from an
untracked `.config/` and `tier2-run.log`).
**Method:** read-only grep and file inspection of the export. No database queried for this
document except where a figure is cited from an earlier dated capture.

## 0. DECISIONS (filled in at phase 0)

| Decision | Answer | Date |
|---|---|---|
| Region | NOT YET (kickoff message left the template unfilled) | 2026-10-22 |
| Neon project | NOT YET | 2026-10-22 |
| GitHub repo | NOT YET | 2026-10-22 |
| DO project | NOT YET | 2026-10-22 |
| DNS host | NOT YET | 2026-10-22 |
| Secrets exported to | NOT YET | 2026-10-22 |
| Cutover window | NOT YET | 2026-10-22 |

Needed from Adam, by phase: a throwaway Neon branch URL to finish Gate 1 (1.3, 1.6, 1.8);
GitHub repo before phase 3; Neon project and region before phase 4; DO project before
phase 5; secrets export, DNS host and cutover window before phase 6.

## 1. WHAT IS COUPLED TO REPLIT, AND HOW TIGHTLY

| Item | Where | Tightness | Action |
|---|---|---|---|
| Hosting, build, TLS, DNS target | `.replit` `[deployment]`: `npm run build`, `npm run start`, autoscale | The job itself | Dockerfile + DO App Platform |
| Database | `javascript_database` integration; `PROD_DATABASE_URL` is `ep-old-recipe` on Neon us-east-1, owned by Replit's Neon org, no console access | Hard. Must move | pg_dump / pg_restore into Adam's own Neon project |
| `REPLIT_DOMAINS` / `REPLIT_DEV_DOMAIN` | `server/config.ts:5-9`, `server/middleware/csrf.ts:52-70` | Soft. `APP_URL` takes precedence | Set `APP_URL`; add a production startup assertion |
| `REPL_SLUG`, `REPL_OWNER`, `REPL_ID` | `server/config.ts:39-42` into `config.replit.*` | Unknown until consumers are grepped | Phase 2.3 |
| `@replit/vite-plugin-runtime-error-modal`, `@replit/vite-plugin-cartographer` | `vite.config.ts:4,13` | Dev only | Remove |
| `@replit/object-storage` | `package.json:51`, zero imports | None | Uninstall |
| `AI_INTEGRATIONS_GEMINI_BASE_URL` | `gemini-client.ts:89-93`, warning only; all calls bypass Replit's proxy by design | None | Log once instead of per construction |
| Backups | `server/cron/backup.cron.ts` writes `/tmp/backup-*.sql.gz`, 7-day prune | Ephemeral on any platform | Write to R2 `backups/`; Neon PITR is the real net |
| Legacy local files | wipe scripts exclude `file_path LIKE 'uploads/%'`, so rows may point at Replit local disk | Already lost on every autoscale redeploy | Count on prod before cutover (§6). Cleanup, not migration |
| Node version | `.replit` modules `nodejs-22` | | `node:22-bookworm-slim` |
| Port | `server/index.ts:71` reads `PORT`, default 5000 | | DO sets `PORT`; Dockerfile exposes 8080 |
| Static serving | `server/vite.ts:70` serves `dist/public` relative to `dist/index.js` | Fine | Build in the image |
| Puppeteer | `server/utils/pdf-generator.ts:4-5` honours `PUPPETEER_EXECUTABLE_PATH` | Fine | Install Chromium in the image, set the env |
| Sessions | `connect-pg-simple`, `secure: isProd`, `sameSite: 'lax'`, `trust proxy 1` | Fine behind DO's proxy | None |
| Crons | `node-cron`, in process: backup 02:00, billing 04:00/08:00/09:00/09:05/09:15/hourly, chase-up 09:00 | Autoscale scales to zero, so these fire only if an instance is awake | One always-on instance on DO. Expect them to run reliably for the first time |

## 2. WHAT DOES NOT MOVE

- **R2 bucket** `valoxi-documents` via the S3 SDK (`server/services/file-storage.service.ts`).
  Same credentials, same bucket, same key scheme.
- **Clerk.** `@clerk/express` middleware on `/api/v2`, `@clerk/react` with
  `VITE_CLERK_PUBLISHABLE_KEY`. Production instance bound to `valoxi.ai`. Webhook at
  `/api/webhooks/clerk`. All keyed to the domain, which does not change.
- **Stripe.** Webhook verified at `server/routes/billing.routes.ts:67` with
  `STRIPE_WEBHOOK_SECRET`. Endpoint URL unchanged. Stripe retries failed deliveries for
  days, so the cutover window loses nothing.
- **Resend, Nylas, Gemini, SMTP.** Secrets only.
- **Users' logins.** Clerk tokens are independent of our server. Server sessions are in
  the database and migrate with it.

## 3. ENVIRONMENT VARIABLES (46 read by code, plus SDK-implicit ones)

From `grep -rhoE "process\.env\.[A-Z0-9_]+"` over `server`, `shared`, `scripts`, and
`import.meta.env` over `client`:

**Runtime, required on DO**
`APP_URL` `CLERK_ENABLED` `CLERK_WEBHOOK_SIGNING_SECRET` `DATABASE_URL`
`GOOGLE_GEMINI_API_KEY` `ISSUE_REPORT_RECIPIENT` `MARKETING_SITE_URL` `NODE_ENV`
`NYLAS_API_KEY` `NYLAS_API_URI` `NYLAS_CLIENT_ID` `NYLAS_CONNECT_GMAIL_VISIBLE`
`NYLAS_CONNECT_OUTLOOK_VISIBLE` `NYLAS_REDIRECT_URI` `NYLAS_STATE_SECRET` `PORT`
`PUPPETEER_EXECUTABLE_PATH` `R2_ACCESS_KEY_ID` `R2_ACCOUNT_ID` `R2_BUCKET_NAME`
`R2_SECRET_ACCESS_KEY` `RESEND_API_KEY` `RESEND_API_KEY_MARKETING`
`RESEND_MARKETING_FROM_ADDRESS` `RESEND_SEGMENT_ACTIVE_SUBSCRIBERS` `RESEND_SEGMENT_ALL_USERS`
`RESEND_SEGMENT_CANCELLED_SUBSCRIBERS` `RESEND_SEGMENT_PAST_DUE` `RESEND_SEGMENT_TEST_INTERNAL`
`RESEND_SEGMENT_TRIALING` `RESEND_WEBHOOK_SECRET` `SESSION_SECRET` `SMTP_ALERT_EMAIL`
`SMTP_FROM_EMAIL` `SMTP_HOST` `SMTP_PASS` `SMTP_PORT` `SMTP_SECURE` `SMTP_USER`
`STRIPE_SECRET_KEY` `STRIPE_WEBHOOK_SECRET` `FIVE_D_BILLING_START` `TEST_INTERNAL_USER_COMPANY_ID`

**SDK-implicit, required on DO** (not grep-visible, read inside the libraries)
`CLERK_SECRET_KEY` `CLERK_PUBLISHABLE_KEY` and, at build time, `VITE_CLERK_PUBLISHABLE_KEY`
(Vite inlines it into the client bundle, so it must be present during `npm run build` in
the Docker image, as a build arg or env).

**Scripts only, not needed on DO**
`COMPANY_ID` `CONFIRM_WRITE` `DRY_RUN` `EXECUTE` `EXPECT_DB_HOST` `EXPECT_DB_NAME` `FROM_ID`
`MODE` `TO_ID` `USER_ID` `PROD_DATABASE_URL` (local inspection only)

**Replit only, dropped**
`REPLIT_DOMAINS` `REPLIT_DEV_DOMAIN` `REPL_ID` `REPL_OWNER` `REPL_SLUG`
`AI_INTEGRATIONS_GEMINI_BASE_URL`

Check the Replit app pane AND the deployment pane: Replit allows them to differ and the
deployment pane is what prod actually runs with. `APP_URL` is known to be set on the
deployment because email links carry `app.valoxi.ai`.

## 4. WHY DO APP PLATFORM, WHY NEON, WHY LONDON

**App Platform over a Droplet.** Build from GitHub on push, managed TLS, rollbacks, logs,
health checks. It is the nearest thing to what Replit autoscale did, minus scale-to-zero.
A Droplet means owning Docker, nginx, certbot and OS patching for one small app. Not worth
it. Revisit only if App Platform's pricing or limits bite.

**One instance.** The crons are in-process. Two instances means two 09:00 billing runs.
If horizontal scaling is ever needed, the crons move to a DO scheduled job or a leader
lock first.

**Neon in Adam's account over DO Managed Postgres.** The code uses
`@neondatabase/serverless` over WebSocket (`server/db.ts`). DO Postgres would mean
swapping the driver, and losing branching, which is how dev and prod are separated today.
Neon PITR replaces the `/tmp` backup cron with something that actually survives a redeploy.

**London.** The users are UK. Every query today crosses to us-east-1. DO lon1 and the
nearest Neon EU region, decided once. If Adam prefers to keep us-east-1 to minimise
variables on cutover night, that is defensible; the plan is region-agnostic and only
insists that DO and Neon match.

## 5. THE SEVEN CONSTRAINTS, PROD STATE AT 16 OCTOBER (for #574 after cutover)

Read-only capture, `ep-old-recipe`, 16 October 2026 12:14 UK. The dump carries these as
they are, so they will be identical on the new database until #574 runs there.

| Constraint | Table | Column | Now | Target |
|---|---|---|---|---|
| `balance_sheets_source_document_id_fkey` | balance_sheets | source_document_id | SET NULL | CASCADE |
| `document_evidence_analysis_result_id_fkey` | document_evidence | document_analysis_result_id | SET NULL | CASCADE |
| `document_evidence_document_id_fkey` | document_evidence | document_id | SET NULL | CASCADE |
| `document_evidence_figure_period_id_fkey` | document_evidence_figure | document_evidence_period_id | NO ACTION | CASCADE |
| `document_evidence_period_evidence_id_fkey` | document_evidence_period | document_evidence_id | NO ACTION | CASCADE |
| `financial_periods_source_document_id_fkey` | financial_periods | source_document_id | SET NULL | CASCADE |
| `income_statements_source_document_id_fkey` | income_statements | source_document_id | SET NULL | CASCADE |

`document_access_log_document_id_fkey` is NO ACTION; the application deletes those rows
first (#567), so it does not block.

## 6. OPEN QUESTIONS TO ANSWER DURING THE WORK

1. Consumers of `config.replit.*` (phase 2.3). Grep before deleting.
2. Prod rows with `file_path LIKE 'uploads/%'` across `documents`, `deal_documents`,
   `external_submissions`. One read-only count. If nonzero, those files are already gone
   and the rows need a decision, separately from the migration.
3. Do any tests require a live database? Phase 1.6 answers it.
4. Does the Clerk production instance need `app.valoxi.ai` re-verified after the DNS
   change? It should not, since the domain and its DNS verification records are unchanged,
   but check Clerk's dashboard shows the domain healthy after cutover.
5. Stripe webhook endpoint: same URL, same secret. Confirm in the Stripe dashboard that the
   first post-cutover event delivers 200.
6. Nylas redirect URI is `app.valoxi.ai`-based and unchanged; confirm one reconnect works
   after cutover.
7. `uploads/` and `attached_assets/` are 24 MB of committed test material. Out of scope
   now; candidates for removal from the repo later.

## 7. SIZE AND RISK

**Effort:** four to five working days, most of it testing. Code changes are a couple of
hours. The restores and the count reconciliation are a day. Staging smoke is a day.
Cutover is an evening.

**Downtime:** target ten minutes, 03:00 UK. Freeze, dump, restore, reconcile, flip.

**Data loss risk:** the database is copied, not moved; the old one is untouched after the
freeze and remains the rollback for seven days. The only loss scenario is a rollback after
writes have landed on the new side, and that window is under Adam's control.

**What could go wrong, and the answer**
- Count mismatch at 6.8: do not flip. Investigate or roll back. Nothing is lost.
- Puppeteer fails in the container: caught at 2.9 or 5.5, before cutover.
- Clerk refuses the new origin: caught at 5.5 with the dev instance; prod instance is
  domain-bound and the domain does not change.
- DO health check flaps on cold start: raise the initial delay; `/api/health` makes no DB
  call so it cannot be the database.
- Crons that never actually ran on autoscale start running on DO and expose a latent bug:
  phase 7.5 watches for exactly this.

## 8. CONVENTION CHANGES AFTER THE MOVE

- Implementer is Claude Code on the local checkout. Replit relay prompts end.
- Deploy is a merge to `main`. The HEAD commit and `/api/health` prove what is running;
  the bundle-hash convention (#367) is retired.
- Every prod query is still `DATABASE_URL="$PROD_DATABASE_URL"`.
- `db:push` stays blocked (#188). Migrations are explicit SQL with named constraints (#189).
- Action log: migration items start at #578 and are packed as v84.2 onward. v85 remains
  reserved for the one-calculation rework unless Adam reassigns it.

## 9. PHASE 1 RESULTS (local baseline)

**Run:** 2026-10-22, 16:09 to 16:15 UTC (17:09 to 17:15 UK). Windows 11, Node v22.14.0,
npm 11.3.0. HEAD at start `de39a9f`, tagged locally as `replit-final` (not pushed).
No `.env` present. No database reachable. Prod was not contacted.

| Step | Result | Time (UTC) |
|---|---|---|
| 1.1 Node 22 | `v22.14.0` | 16:09 |
| 1.2 `npm ci` | First attempt FAILED, see finding A. After fix: exit 0, 1202 packages added, 21 audit findings (11 moderate, 9 high, 1 critical), 4 deprecation warnings | 16:11 |
| 1.4 `.env.example` | 47 variables, zero values, matches section 3 exactly. `.env`, `.env.*` ignored; `.env.example` tracked | 16:12 |
| 1.5 `npm run check` | exit 0, zero TypeScript errors | 16:13:09 |
| 1.6 `npx vitest run` | **NOT AT BASELINE.** No DB: 17 files fail, 403 tests pass. Dummy URL: 18 files clean, 438 pass, 22 fail, 80 skipped, 540 counted. See finding B | 16:13:31 |
| 1.7 `npm run build` | exit 0, `dist/index.js` 1.5 MB, `dist/public/` 3.4 MB | 16:14:43 |
| 1.8 `npm run dev` | NOT RUN (needs the throwaway DB from 1.3) | |

### Finding A: `package-lock.json` is welded to Replit's package mirror

345 of 1202 `resolved` URLs pointed at `package-firewall.replit.internal` (332) and
`package-firewall.replit.local` (13). Neither resolves outside Replit, so `npm ci` fails
on any other machine with `ENOTFOUND` and npm 11 then dies with "Exit handler never
called", which hides the cause. The Phase 2.8 Docker build would have failed the same way.
Not in the plan.

Fix, commit `c839760`: rewrite those URLs to `https://registry.npmjs.org/` (the path is
identical apart from the `/npm/` prefix). Only `resolved` lines changed (345 insertions,
345 deletions, 0 other lines). `integrity` hashes untouched, so npm rejects any tarball
that is not byte-identical to what Replit locked. Assertion: all 1202 entries now resolve
to `registry.npmjs.org`; `npm ci` exit 0.

### Finding B: 16 of 34 test files need a live database

`server/db.ts:9` throws at import if `DATABASE_URL` is unset, so with no variable 17 files
never load (156 tests not run). With a dummy unreachable URL (`127.0.0.1:1`) one of them
(`im-detector`) loads and mostly passes, leaving 16 that need a real database:

| File | With dummy URL | Notes |
|---|---|---|
| `subscription-suspension.test.ts` | 12 fail | no skip guard, hits DB in `afterEach` |
| `suspension-check-in.test.ts` | 10 fail | no skip guard, deletes `team_notifications` rows |
| `forward-path-gate.test.ts` | 3 pass, 21 skip | host guard |
| `reconciled-financials.test.ts` | 3 pass, 13 skip | host guard |
| `vcheck-triple.test.ts` | 9 skip | host guard |
| `deal-model-ebitda.test.ts` | 12 pass, 3 skip | |
| `im-detector.test.ts` | 12 pass, 2 skip | |
| `stable-year-container.test.ts` | 6 skip | |
| `financial-contributions.test.ts` (server/scripts) | 6 skip | |
| `document-delete-fk.test.ts` | 6 skip | |
| `document-delete-cascade.test.ts` | 5 skip | |
| `projection-reselect.test.ts` | 5 skip | |
| `ghost-period-prune.test.ts` | 4 skip | |
| `company-delete-evidence.test.ts` | 0 collected | |
| `offer-guard-call-sites.test.ts` | 0 collected | host guard |
| `offer-screen-parity.test.ts` | 0 collected | host guard |

The 19-test gap between 540 counted and 559 baseline is the three files that collect zero
tests without a DB. These tests INSERT and DELETE rows, so they must only ever run against
the throwaway Neon branch (plan 1.3), never prod.

### Finding C: the test host guards will not recognise the new prod

Five files (`forward-path-gate`, `offer-guard-call-sites`, `offer-screen-parity`,
`reconciled-financials`, `vcheck-triple`) refuse to run if the DB host contains
`ep-old-recipe` or `.prod.`. That protects only the OLD prod. After cutover the new Neon
host has a different endpoint ID, so those guards pass silently against new prod. The
other 11 DB-dependent files have no guard at all. Proposed for phase 7: one shared
allowlist guard (run only if host matches the `dev` branch endpoint). Not actioned now.

### Finding D: build succeeds with no Clerk publishable key

`npm run build` exits 0 with `VITE_CLERK_PUBLISHABLE_KEY` unset. A Docker build without
the build arg would produce a client with no Clerk key and no build error. Phase 2.8 needs
the key passed as a build arg, and ideally a build-time assertion.

### Gate 1 status

1.5 clean. 1.7 clean. 1.6 NOT clean: blocked on a throwaway Neon branch (Phase 0 not yet
answered). 1.3 and 1.8 blocked on the same thing.

## 10. GATE 1 CLOSED (tests at baseline)

**Run:** 2026-10-22, 18:13 UTC (19:13 UK), against Neon branch `throwaway`
(endpoint `ep-square-pine-zaoqy54e`, eu-west-2, project `billowing-block-98253807`).
**Result:** 34 files, **559 passed**, 0 failed, 0 skipped. Exit 0. Matches baseline.

How the throwaway was prepared (all writes to the throwaway branch only, each authorised
by Adam in his own message, no prod contact):

1. Schema: `npx drizzle-kit export --sql` from `shared/schema.ts`, applied in one
   transaction after guards (host must be the throwaway endpoint, `public` must be empty).
   Result: 93 tables, 185 FK constraints, 5 enums.
2. Fixtures: `user_companies` id 71 ("Throwaway test co") and one `users` row on it
   (id 11). Seven test files look up `userCompanyId = 71` and throw "seed the DB first".
3. Index: `current_offers_target_company_unique` on `(target_company_id)`. Prod has it
   (drift register item 5, no schema declaration); the code upserts with
   `ON CONFLICT (target_company_id)`. Column inferred from the name and the code, since the
   register does not print the DDL.

Command that reproduces the baseline (do NOT `source .env` in bash: Neon URLs contain an
unquoted `&` that backgrounds the assignment and leaves `DATABASE_URL` unset):

```
GOOGLE_GEMINI_API_KEY=placeholder-not-a-real-key node --env-file=.env node_modules/vitest/vitest.mjs run
```

The placeholder passes the `gemini-client.ts` guard (rejects empty or `_DUMMY_API_KEY_`,
the Replit integration value). No test calls Gemini. The real key is never used in tests
and never goes in `.env` for this purpose.

### Finding E: the repo cannot rebuild prod from scratch

Prod objects with no declaration in `shared/schema.ts` (drift register, 2026-07-31): the
`session` table, views `activity_summary`, `deal_progression`, `pipeline_summary`,
`stage_1_progress`, 13 unmanaged indexes (including the `current_offers` unique index that
cost three tests here), and FKs named `_fkey` instead of Drizzle's `_fk`. A database built
from the schema is a test fixture, never prod-identical. This confirms dump and restore
(phase 4) as the only safe route for the real database. Corollary for #574: the constraint
names in section 5 are the prod `_fkey` names, so the ALTERs must use those, not Drizzle's.

### Gate 1 status: PASSED for 1.5, 1.6, 1.7

1.3 done (throwaway branch). 1.8 (`npm run dev`) not run: the server starts the in-process
crons (billing, chase-up) and would need Clerk keys to show anything past sign-in. Awaiting
Adam's call on whether to run it with the crons neutralised.

Open items carried forward: Finding C (host guards) for phase 7, Finding D (Clerk build
key) for 2.8. Phase 0 answers still outstanding except: Neon project created
(`billowing-block-98253807`, org `org-holy-base-64540790`), region eu-west-2 London.

## 11. VALUES THAT LIVE ONLY IN `.replit` (found at plan 2.10)

`.replit` `[userenv.shared]` sets environment variables for the Repl, and they are not in
the secrets panes, so the section 3 checklist would miss them. Recorded here before
`.replit` is deleted (it stays in git history at `de39a9f`, tag `replit-final`).

| Variable | Value in `.replit` | Read by code? | Action on DO |
|---|---|---|---|
| `NYLAS_CONNECT_GMAIL_VISIBLE` | `true` | Yes, `server/routes/public.routes.ts:19` (`=== 'true'`) | **Set to `true`.** If unset the Gmail connect option silently disappears |
| `NYLAS_CONNECT_OUTLOOK_VISIBLE` | `false` | Yes, `public.routes.ts:20` | Set to `false` (unset behaves the same) |
| `PORT` | `5000` | Yes | DO sets it; Dockerfile uses 8080 |
| `BETA_MODE` | `true` | No (zero references) | Drop |
| `VITE_BETA_MODE` | `true` | No (zero references in client) | Drop |
| `BETA_FEEDBACK_BUCKET_ID` | a `replit-objstore-...` id | No | Drop |
| `[objectStorage] defaultBucketID` | a `replit-objstore-...` id | No (`@replit/object-storage` had zero imports) | Drop |

Also check the Replit panes for the same names: a pane value would override `.replit`.

## 12. PHASE 2 RESULTS (de-Replit the code)

**Run:** 2026-10-22, 17:25 to 18:30 UTC. One commit per item. Nothing pushed. Prod not
contacted. Gate evidence at 18:30 UTC: `npm run check` exit 0, `npm run build` exit 0,
`npx vitest run` 34 files / 559 passed (Neon `throwaway`), and the plan's gate grep
`grep -rcE "REPL_|REPLIT_|@replit" server shared client vite.config.ts package.json`
matches only the two tolerated fallbacks: `server/config.ts` (4 lines, `getBaseUrl`) and
`server/middleware/csrf.ts` (1 line, the `REPLIT_DOMAINS` read).

| Item | Commit | Proof |
|---|---|---|
| 2.1 Vite plugins | `1d2191c` | `grep -c "@replit" vite.config.ts` = 0; both packages gone from package.json and lock; build clean |
| 2.2 object-storage | `fffe88c` | zero imports before; 0 hits in package.json and lock |
| 2.3 `config.replit` | `ee3cacd` | consumer grep outside config.ts was empty; `tsc` clean |
| 2.4 csrf text | `6edd88f` | see deviation 1 |
| 2.5 `/api/health` | `4fa070c` | in Docker: `{"ok":true,"commit":"521e82f","node":"v22.23.4","uptime":15}`, HTTP 200 |
| 2.6 backup cron | `521e82f` | prune selection proven on 10 keys + 3 non-matching; R2 round trip NOT yet proven |
| 2.7 gemini warning | `9dccf12` | same sequence: 4 warnings before, 1 after |
| 2.8 Dockerfile | `cdc878a` | see deviations 2 to 4 |
| 2.9 Docker proof | no commit | build clean; app boots; real PDF 15,062 bytes `%PDF-1.4`; all crons register |
| 2.10 delete files | `87d872b`, `58fd987` | none of `.replit`, `replit.md`, `nohup.out`, `.config` remain |

### Deviations from the plan, each with evidence

1. **No new `index.ts` APP_URL assertion.** Production already refuses to boot without
   `APP_URL`: `csrf.ts` throws at import. Run with `NODE_ENV=production` and an empty
   `APP_URL`: `Error: [Security] APP_URL is unset in production. Refusing to boot...`. The
   plan's assertion would run after that and never fire, so only the message text changed.
2. **No `npm prune --omit=dev` in the Dockerfile.** `server/vite.ts:4` imports `vite`
   (a devDependency) at top level and the bundle uses `--packages=external`. Verbatim from
   the pruned image: `Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'vite' imported
   from /app/dist/index.js`. Cost: image is 2.39 GB. A later refactor to import `vite`
   dynamically in `setupVite` would allow pruning.
3. **`postgresql-client-18` from PGDG, not bookworm's `postgresql-client`.** Bookworm ships
   15. Verbatim against the Neon 18.6 branch: `pg_dump: error: aborting because of server
   version mismatch ... server version: 18.6 ...; pg_dump version: 15.19`. With the pgdg
   client the same dump completed (93 tables). This also governs the console dumps at 4.3
   and 6.6 if run from a container: the client must be >= the server (18).
4. **`npm ci --include=dev`** because the image sets `NODE_ENV=production`, which would
   otherwise skip the build tools.
5. **Build-time Clerk assertion (Finding D closed).** Without the arg the build fails:
   `VITE_CLERK_PUBLISHABLE_KEY build arg is required`. DO must set it as a BUILD_TIME
   variable. `GIT_SHA` is passed the same way; DO does not supply one, so on DO
   `/api/health` will show `unknown` until a build arg is configured (decide at 5.4).

### Other findings

- **`.replit` env values (assessment section 11).** `NYLAS_CONNECT_GMAIL_VISIBLE=true` and
  `NYLAS_CONNECT_OUTLOOK_VISIBLE=false` lived only in `.replit`. Unset, the Gmail connect
  option would silently vanish. Added to the removals.md secrets checklist.
- **Backup cron strips `-pooler`** from the host before `pg_dump`, because dumping through
  the pooler is unsupported. Prod `DATABASE_URL` on DO should therefore be a Neon pooled
  URL whose direct form is the same host minus `-pooler`.
- **Production boot needs more than `APP_URL`:** `SESSION_SECRET` (throws if unset) and a
  non-dummy `GOOGLE_GEMINI_API_KEY` (the Gemini client is a module-level singleton that
  throws at import). Both are in the DO env list already.
- **Windows:** `server.listen({ reusePort: true })` fails with `ENOTSUP` on Windows, so
  `npm run dev` and `node dist/index.js` cannot serve locally. It works on Linux. Not
  changed, since it is not a migration issue. Local serving goes through Docker. This is
  also why 1.8 was skipped; port 8080 on this machine is held by an unrelated service, so
  the container was published on 18080.
- **`scripts/post-merge.sh`** is a Replit post-merge hook (runs `npm install`). Left in
  place; harmless off Replit. Candidate for removal in cleanup.
- `tests/.auth/user.json` is gitignored, untracked, cookies expired Jan and Feb 2026. Not
  a leak.
- 2.11 (`uploads/` 19 MB, `attached_assets/` 5 MB checked in) left as the plan says. Both
  are excluded from the Docker context; `attached_assets` is still aliased as `@assets` in
  `vite.config.ts` with zero imports under `client/src`.

## 13. PHASE 3 RESULTS (GitHub)

Date: 2026-10-23. Repo: https://github.com/adam654321/valoxi-app (private, empty at creation).

| Step | Result |
|---|---|
| `.env` tracked | No. `git check-ignore -v .env` gives `.gitignore:17:.env`. Only `.env.example` is tracked. |
| `.env` ever committed | 0 commits (`git log --all -- .env`), across 5,655 commits |
| Plan 3.2 secret scan (AIza, sk_live_, whsec_, re_ keys) | 8 hits, all FALSE POSITIVES: bare prefixes in prose (the scan command quoted in `plan.md`; "starts with whsec_" in pasted assets; one `whsec_1` one-character prefix check). No key material. Adam informed and said go. |
| Postgres URLs with embedded credentials | 0 |
| Wider scan (sk_test_, rk_live_, pk_live_/pk_test_, Nylas nyk_, private key blocks, AWS AKIA, GitHub ghp_, Neon npg_, Slack xox) | 0 hits |
| Replit remotes | `gitsafe-backup` and 7 `subrepl-*` removed. Only `origin` remains. |
| First push attempt | 403: machine credentials were GitHub user AdamValoxi; repo owner is adam654321. Fixed by Adam inviting AdamValoxi as collaborator. |
| Push `main` | Run by Adam. Remote `main` = local `main` = `295d493` (`git ls-remote`). |
| Push tag `replit-final` | Run by Adam. `git ls-remote --tags origin` = `de39a9f`, equals local tag. |

Notes:
- The plan's scan can never read zero once `plan.md` is committed, because the file quotes the pattern. Treat the criterion as "no real secret".
- `attached_assets/` (Replit pasted prompts) is in history. Scanned clean. It is excluded from the Docker image by `.dockerignore`.
- Repo owner is a personal account. DO links to the owner, so a later transfer to an organisation means relinking.
- Branch protection on `main` (plan 3.4) is Adam's to set in GitHub: NOT YET.

## 14. PHASE 4 RESULTS (rehearsal restore)

Date: 2026-10-23. Full record: `docs/do-migration/rehearsal-2026-10-23.txt`.

| Item | Result |
|---|---|
| Source | Old Replit-owned Neon `ep-old-recipe-an7e4afw`, PostgreSQL 16.15. Read only, run by Adam. |
| Target | New Neon branch `rehearsal`, `ep-lingering-mode-zalkfz3h`, PostgreSQL 18.6. `production` and `throwaway` untouched. |
| Dump | 10,021,863 bytes, `pg_dump` 18.6 `-Fc --no-owner --no-privileges`. Archive valid. |
| Table count | **94**, not the plan's 92. Same table set as a `schema.ts` build. |
| Drift during dump | None. Counts before and after the dump identical (COUNT 94, SEQ 92, SPOT 4, 0 mismatches), including `session`. |
| Restore | `pg_restore --clean --if-exists --exit-on-error`, exit 0, no output. |
| Counts after restore | COUNT 94, SEQ 92, SPOT 4: 0 mismatches. |
| Structure | 94 tables, 4 views, 182 FKs, 94 PKs, 32 uniques, 3 checks, 153 indexes, 5 enums. FK-name and index-name md5 identical on both sides (STRUCT 10, 0 mismatches). |

Findings:
- FK constraints on prod are 182. A `schema.ts` build gives 185. Prod is authoritative (drift register); #574's ALTERs must use prod's `_fkey` names, which are now proven to restore unchanged.
- Plan 4.7 says branch `dev` "from main". `production` is empty, so create `dev` from `rehearsal`.
- Tests assume `userCompanyId = 71`. Prod has 88 users and 87 user_companies, so company 71 exists with real data. Check before running vitest on a branch holding real data.
- Tooling added: `structure-checks.sql`; `compare-counts.mjs` now also compares STRUCT lines.

GATE 4: passed 2026-10-23, pending Adam seeing the record file.

### 14.1 Plan 4.7: Neon `dev` branch (2026-10-23)

- A branch with an expiry cannot have children, so `dev` could not be made from `rehearsal`. `dev` was created from `production` (empty, no expiry) and the same dump was restored into it: `ep-frosty-mode-zapfrf2v`, eu-west-2, PostgreSQL 18.6. `pg_restore --exit-on-error`, exit 0. `production` untouched.
- `dev` vs source: COUNT 94, SEQ 92, SPOT 4, STRUCT 10, 0 mismatches.
- Vitest against `dev` (DATABASE_URL overridden for the run, `.env` not edited, placeholder Gemini key): **34 files, 559 tests passed**, 24s. Baseline held.
- After the tests: every table count and every spot check identical to the post-restore state; only 23 sequence counters advanced. The tests (which use `userCompanyId = 71` as owner) create their own rows and delete them by id, and removed all of them.
- `dev` holds a copy of real customer data (88 users). Keep it off shared machines; wipe by re-running the restore.
- Not done: pointing the local `.env` `DATABASE_URL` at `dev` (still the `throwaway` branch). Adam to decide.
