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