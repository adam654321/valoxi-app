# SMOKE-A runtime paths

## STEP 1 — RUNTIME VERSIONS

```text
$ node --version
v22.22.0

$ which chromium || which chromium-browser || echo "NO SYSTEM CHROMIUM ON PATH"
/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium

$ chromium --version 2>&1 || chromium-browser --version 2>&1 || echo "NO VERSION"
Chromium 125.0.6422.141 

$ node -e "console.log('xlsx resolved to:', require('./package-lock.json').packages['node_modules/xlsx']?.version, require('./package-lock.json').packages['node_modules/xlsx']?.resolved)"
xlsx resolved to: 0.20.3 http://package-firewall.replit.internal/npm/@e965/xlsx/-/xlsx-0.20.3.tgz
```

## STEP 2 — PDF GENERATION, THE HIGHEST RISK PATH

```text
$ npx tsx -e "import('./server/utils/pdf-generator.ts').then(async m => { const buf = await m.generatePdfFromHtml('<h1>Smoke test</h1><p>Offer price: £250,000</p><table><tr><td>Row</td><td>Value</td></tr></table>'); console.log('PDF BYTES:', buf.length); console.log('HEADER:', buf.subarray(0,5).toString()); }).catch(e => { console.error('PDF FAILED:', e); process.exit(1); })"
PDF BYTES: 15627
HEADER: %PDF-
npm notice
npm notice New major version of npm available! 10.9.4 -> 12.0.2
npm notice Changelog: https://github.com/npm/cli/releases/tag/v12.0.2
npm notice To update run: npm install -g npm@12.0.2
npm notice
```

## STEP 3 — WORD GENERATION, THE DOWNGRADED LIBRARY

```text
$ npx tsx -e "import('html-to-docx').then(async m => { const H = m.default; const out = await H('<h1>Smoke test</h1><table><tr><td>Row</td><td>Value</td></tr></table>', null, { table: { row: { cantSplit: true } }, footer: false, pageNumber: false }); const buf = Buffer.isBuffer(out) ? out : Buffer.from(await out.arrayBuffer()); console.log('RETURN TYPE:', Buffer.isBuffer(out) ? 'Buffer' : out?.constructor?.name); console.log('DOCX BYTES:', buf.length); console.log('HEADER:', buf.subarray(0,2).toString()); }).catch(e => { console.error('DOCX FAILED:', e); process.exit(1); })"
false
RETURN TYPE: Blob
DOCX BYTES: 9354
HEADER: PK
```

The Blob branch of the shim fired.

## STEP 4 — SPREADSHEET PARSING

```text
$ ls -la test_staff_matrix.csv
-rw-r--r-- 1 runner runner 390 Aug 17  2025 test_staff_matrix.csv

$ npx tsx -e "import('./server/utils/spreadsheet-to-text.ts').then(m => { console.log('EXPORTS:', Object.keys(m)); }).catch(e => { console.error('IMPORT FAILED:', e); process.exit(1); })"
EXPORTS: [ 'convertSpreadsheetToText', 'isSpreadsheetMimeType' ]

$ npx tsx -e "import('xlsx').then(X => { const wb = X.readFile('test_staff_matrix.csv'); console.log('SHEETS:', wb.SheetNames); console.log('FIRST ROWS:', JSON.stringify(X.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]).slice(0,3))); }).catch(e => { console.error('XLSX FAILED:', e); process.exit(1); })"
XLSX FAILED: Error: Cannot access file test_staff_matrix.csv
    at read_binary (file:///home/runner/workspace/node_modules/xlsx/xlsx.mjs:3362:8)
    at readSync (file:///home/runner/workspace/node_modules/xlsx/xlsx.mjs:27231:69)
    at Module.readFileSync (file:///home/runner/workspace/node_modules/xlsx/xlsx.mjs:27276:9)
    at [eval]:24:16
```

## STEP 5 — CLERK AND THE APP ITSELF

```text
$ restart dev workflow "Start application"
Restarted workflow `Start application`.

$ head -30 /tmp/logs/Start_application_20260911_223310_497_8e9d6460.log
workflow: Start application
status: RUNNING
run_id: ipCHjH8OCpm3I1Nc79b3I
timestamp: 2026-09-11T22:33:10.497Z


> rest-express@1.0.0 dev
> NODE_ENV=development tsx server/index.ts

[GEMINI_CLIENT] WARNING: AI_INTEGRATIONS_GEMINI_BASE_URL is set (http://localhost:1106/modelfarm/gemini). Ignoring — all calls use raw fetch directly to https://generativelanguage.googleapis.com
Resend email service initialised
[resend-marketing] marketing Resend client initialised
[marketing-contacts] all 6 segment IDs configured
10:32:57 PM [express] serving on port 5000
10:32:57 PM [express] [NYLAS] configured — OAuth and email send enabled
[CRON] Chase-up daily job scheduled for 9:00 AM UK time
[billing-cron] Daily dunning checks scheduled at 04:00 London
[billing-cron] Trial expiry job scheduled for 9:05 AM UK time daily
[billing-cron] Free months warning/transition job scheduled for 9:15 AM UK time daily
[billing-cron] Stripe webhook failure alert scheduled for 08:00 London
[billing-cron] 5D partner invoice scheduled daily at 04:00 London, fires on the configured send-day
[billing-cron] Trial extension + warning job scheduled hourly
[backup-cron] Daily database backup scheduled for 02:00 UK time
[ANALYSIS_QUEUE] Startup recovery: Found 6 stuck event(s), checking for existing results...
[ANALYSIS_QUEUE] Enqueued event 675 for company 1884 (retrigger) (company queue: 1, active companies: 0)
[ANALYSIS_QUEUE] Processing event 675 for company 1884 (remaining for company: 0)
[FILE_ANALYSIS] Starting Gemini analysis for event 675, file: Doc7_Deal_Documents.pdf
[FILE_ANALYSIS] Using file path: companies/218/doc-1782905193639-297224374.pdf (URL: companies/218/doc-1782905193639-297224374.pdf)
[FILE_ANALYSIS] File extension: pdf, MIME type: application/pdf
[ANALYSIS_QUEUE] Enqueued event 644 for company 1880 (retrigger) (company queue: 1, active companies: 1)

$ rg -ni "clerk|auth|multer|rate.?limit|node version|warning|error" /tmp/logs/Start_application_20260911_223310_497_8e9d6460.log
10:[GEMINI_CLIENT] WARNING: AI_INTEGRATIONS_GEMINI_BASE_URL is set (http://localhost:1106/modelfarm/gemini). Ignoring — all calls use raw fetch directly to https://generativelanguage.googleapis.com
15:10:32:57 PM [express] [NYLAS] configured — OAuth and email send enabled
19:[billing-cron] Free months warning/transition job scheduled for 9:15 AM UK time daily
22:[billing-cron] Trial extension + warning job scheduled hourly
82:Attention: Clerk collects telemetry data from its SDKs when connected to development instances.
83:The data collected is used to inform Clerk's product roadmap.
84:To learn more, including how to opt-out from the telemetry program, visit: https://clerk.com/docs/telemetry.
86:10:33:04 PM [express] GET /api/v2/auth/me 401 in 20ms :: {"message":"Unauthorized"}
87:10:33:04 PM [express] GET /api/v2/public/config 304 in 26ms :: {"success":true,"data":{"clerkEnabled"…
```

The startup log contains a Gemini base-URL warning and Clerk development-instance telemetry notice. The unauthenticated `/api/v2/auth/me` request returned 401. No Multer, rate-limit, or Node-version error or warning appears.

## STEP 6 — OUTPUT

```text
$ git status --porcelain
?? docs/event-promo-release/SMOKE-A-runtime-paths.md
```

V-CHECK — git status: PASS (only the new runtime-smoke report is untracked).