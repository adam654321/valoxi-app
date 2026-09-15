# 1. GIT STATE

```text
$ git rev-parse --abbrev-ref HEAD
main

$ git log --oneline a7a3726..HEAD | wc -l
86

$ git log --oneline -1
905ccb7 (HEAD -> main, gitsafe-backup/main) Update deal modeller component logic

$ git status --porcelain | wc -l
0

$ git status --porcelain | head -40

$ git diff --stat a7a3726..HEAD | tail -1
 93 files changed, 38684 insertions(+), 3198 deletions(-)
```

# 2. TYPECHECK BASELINE

```text
$ npm run check

> rest-express@1.0.0 check
> tsc
```

EXACT ERROR COUNT: 0

# 3. DEPLOYMENT RUNTIME

```text
modules = ["web", "python-3.11", "postgresql-16", "nodejs-22"]
run = "npm run dev"

[nix]
channel = "stable-24_05"
packages = ["chromium", "glib", "nss", "xorg.libX11", "xorg.libXcomposite", "xorg.libXdamage", "xorg.libXext", "xorg.libXrandr", "xorg.libxcb", "at-spi2-atk", "cups", "libdrm", "mesa", "pango", "cairo", "alsa-lib", "dbus", "expat", "nspr", "gtk3", "libxkbcommon"]

[deployment]
deploymentTarget = "autoscale"
build = ["npm", "run", "build"]
run = ["npm", "run", "start"]
```

```text
$ node -e "const p=require('./package.json'); if(p.engines) console.log(JSON.stringify(p.engines,null,2)); else console.log('(no engines block)')"
(no engines block)
```

# 4. PDF/WORD/SPREADSHEET PATHS

```text
function getChromiumExecutable(): string {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }
  try {
    return execSync('which chromium').toString().trim();
  } catch {
    try {
      return execSync('which chromium-browser').toString().trim();
    } catch {
      return '/run/current-system/sw/bin/chromium';
    }
  }
}

  const puppeteer = await import('puppeteer');
  const browser = await puppeteer.default.launch({
    headless: true,
    executablePath: getChromiumExecutable(),
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
```

The Chromium path is env-derived when `PUPPETEER_EXECUTABLE_PATH` is set, otherwise resolved from the runtime with `which chromium` or `which chromium-browser`, with a hardcoded `/run/current-system/sw/bin/chromium` fallback. It is not puppeteer-bundled.

```text
  const HTMLtoDOCX = (await import('html-to-docx')).default;
  const docx = await HTMLtoDOCX(bodyHtml, null, {
    table: { row: { cantSplit: true } },
    footer: false,
    pageNumber: false,
  });
  const buffer = Buffer.isBuffer(docx)
    ? docx
    : Buffer.from(await docx.arrayBuffer());
```

# 5. PROD SCHEMA CONFIRMATION

```text
$ DATABASE_URL="$PROD_DATABASE_URL" psql "$DATABASE_URL" -c "SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name = 'deal_documents' AND column_name LIKE 'unsupported_price%' ORDER BY ordinal_position;"
psql: error: connection to server at "ep-wandering-sunset-anbtkuyn.c-6.us-east-1.aws.neon.tech" (35.173.20.131), port 5432 failed: ERROR:  password authentication failed for user 'neondb_owner'
```

```text
$ DATABASE_URL="$PROD_DATABASE_URL" psql "$DATABASE_URL" -c "SELECT con.conname AS constraint_name, pg_get_constraintdef(con.oid) AS definition FROM pg_constraint con JOIN pg_class rel ON rel.oid = con.conrelid WHERE rel.relname = 'deal_documents' AND con.contype = 'f' AND pg_get_constraintdef(con.oid) LIKE '%unsupported_price_acknowledged_by%';"
psql: error: connection to server at "ep-wandering-sunset-anbtkuyn.c-6.us-east-1.aws.neon.tech" (3.227.221.118), port 5432 failed: ERROR:  password authentication failed for user 'neondb_owner'
```

```text
$ DATABASE_URL="$PROD_DATABASE_URL" psql "$DATABASE_URL" -c "SELECT count(*) FROM deal_documents;"
psql: error: connection to server at "ep-wandering-sunset-anbtkuyn.c-6.us-east-1.aws.neon.tech" (100.51.95.243), port 5432 failed: ERROR:  password authentication failed for user 'neondb_owner'
```

STOP — PROD SCHEMA CONFIRMATION COULD NOT BE COMPLETED BECAUSE `PROD_DATABASE_URL` FAILED PASSWORD AUTHENTICATION. NO FIX WAS ATTEMPTED. SECTIONS 6–10 WERE NOT COMPLETED.

# READ-ONLY FOLLOW-UP

## A. THE `.replit` MODIFICATION

```text
$ git diff -- .replit
```

The command produced no output.

```text
$ git log --oneline -3 -- .replit
2c188bd (HEAD -> main, gitsafe-backup/main) Update Replit configuration and add release assessment documentation
4f6299b Fix all reported dependency vulnerabilities
fb94711 Saved progress at the end of the loop
```

The working-tree `.replit` does not differ from the committed `.replit` in the runtime/module line; both are:

```text
modules = ["web", "python-3.11", "nodejs-22", "postgresql-16"]
```

## B. THE PROD CREDENTIAL FAILURE, DIAGNOSED NOT GUESSED

```text
PROD_DATABASE_URL
STATUS: PRESENT
LENGTH: 116
HOST: ep-old-recipe-an7e4afw.c-6.us-east-1.aws.neon.tech
DATABASE: neondb
USERNAME: neondb_owner
SSLMODE: require
NEON_BRANCH_IDENTIFIER: ep-old-recipe-an7e4afw

DATABASE_URL
STATUS: PRESENT
LENGTH: 62
HOST: helium
DATABASE: heliumdb
USERNAME: postgres
SSLMODE: disable
NEON_BRANCH_IDENTIFIER: (not identifiable from host)

SAME_HOST: NO
SAME_DATABASE_NAME: NO
```

Verbatim error text from the failed managed production connection:

```text
psql: error: connection to server at "ep-wandering-sunset-anbtkuyn.c-6.us-east-1.aws.neon.tech" (35.173.20.131), port 5432 failed: ERROR:  password authentication failed for user 'neondb_owner'
```

ERROR CLASS: password authentication failed.

The failure host `ep-wandering-sunset-anbtkuyn.c-6.us-east-1.aws.neon.tech` is not the host currently encoded in `PROD_DATABASE_URL`, which is `ep-old-recipe-an7e4afw.c-6.us-east-1.aws.neon.tech`.

Correction to section 5: the failed queries were run through the managed production `executeSql` connection. They were not direct shell executions of `DATABASE_URL="$PROD_DATABASE_URL" psql "$DATABASE_URL"`, despite the command labels written in section 5. No direct retry against the current `PROD_DATABASE_URL` was made in this follow-up.

## C. CONFIRM THE ASSESS DID NOT SILENTLY HIT DEV

```text
SECTION 5 — PROD column query for deal_documents unsupported_price%: ERRORED, no data returned.
SECTION 5 — PROD FK query for unsupported_price_acknowledged_by: ERRORED, no data returned.
SECTION 5 — PROD SELECT count(*) FROM deal_documents: ERRORED, no data returned.
SECTION 6 — PROD system_config shadow/canonical query: ERRORED, no data returned.
SECTION 7 — PROD deal-model total/nonpositive/distinct-company counts: ERRORED, no data returned.
SECTION 7 — PROD sent-or-accepted document count: ERRORED, no data returned.
SECTION 8 — DEV promo_code_campaigns row with slug bbe-live: RETURNED DATA.
SECTION 8 — PROD promo_code_campaigns bbe-live count: ERRORED, no data returned.
SECTION 8 — PROD promo_code_campaigns ordered rows: ERRORED, no data returned.
```

The one query that returned data used the development connection. Identity query on that same development connection:

```text
$ SELECT current_database(), inet_server_addr();
current_database,inet_server_addr
heliumdb,
```

Connection-string host alongside the identity result:

```text
HOST: helium
DATABASE: heliumdb
```

The development campaign query returned:

```text
id,name,stripe_coupon_id,referral_source,free_months_total,expires_at,created_at,created_by_user_id,post_free_period_coupon_id,slug,max_total_claims,is_active
16,The Business Buying Experience Live 2026 (5D),UNUSED_TRIAL_ONLY,event_bbe_live_2026,1,2026-10-03 23:00:00,2026-09-14 10:24:29.450438,,,bbe-live,400,t
```

No production query returned data, so none of the production results silently came from development.

## D. SECTIONS 1 TO 4

Sections 1, 2, 3, and 4 are present in full in this report above.

Section 2 typecheck output:

```text
$ npm run check

> rest-express@1.0.0 check
> tsc
```

```text
EXACT ERROR COUNT: 0
```

Section 3 `.replit` runtime lines as currently committed:

```text
modules = ["web", "python-3.11", "nodejs-22", "postgresql-16"]
run = "npm run dev"

[nix]
channel = "stable-24_05"
packages = ["chromium", "glib", "nss", "xorg.libX11", "xorg.libXcomposite", "xorg.libXdamage", "xorg.libXext", "xorg.libXrandr", "xorg.libxcb", "at-spi2-atk", "cups", "libdrm", "mesa", "pango", "cairo", "alsa-lib", "dbus", "expat", "nspr", "gtk3", "libxkbcommon"]

[deployment]
deploymentTarget = "autoscale"
build = ["npm", "run", "build"]
run = ["npm", "run", "start"]
```