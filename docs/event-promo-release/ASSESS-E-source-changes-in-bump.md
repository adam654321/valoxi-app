# ASSESS-E source changes in dependency bump

## STEP 1 — THE FOUR SOURCE DIFFS, VERBATIM

```text
$ git show 4f6299b -- .replit
commit 4f6299bfddbc6e7e87f6b78bd855fa9e76ccdad2
Author: adam1329 <46372644-adam1329@users.noreply.replit.com>
Date:   Fri Sep 11 16:01:13 2026 +0000

    Fix all reported dependency vulnerabilities
    
    Replit-Task-Id: d20c63d5-6403-4141-bf0f-e4062e08552e
    Replit-Merge-Attempt: MergeTask:d20c63d5-6403-4141-bf0f-e4062e08552e:1:e89649d2

diff --git a/.replit b/.replit
index 4f906c6..f932c41 100644
--- a/.replit
+++ b/.replit
@@ -1,4 +1,4 @@
-modules = ["nodejs-20", "web", "python-3.11", "postgresql-16"]
+modules = ["web", "python-3.11", "postgresql-16", "nodejs-22"]
 run = "npm run dev"
 hidden = [".config", ".git", "generated-icon.png", "node_modules", "dist"]
 

$ git show 4f6299b -- server/services/portal.service.ts
commit 4f6299bfddbc6e7e87f6b78bd855fa9e76ccdad2
Author: adam1329 <46372644-adam1329@users.noreply.replit.com>
Date:   Fri Sep 11 16:01:13 2026 +0000

    Fix all reported dependency vulnerabilities
    
    Replit-Task-Id: d20c63d5-6403-4141-bf0f-e4062e08552e
    Replit-Merge-Attempt: MergeTask:d20c63d5-6403-4141-bf0f-e4062e08552e:1:e89649d2

diff --git a/server/services/portal.service.ts b/server/services/portal.service.ts
index 652f1b9..92d96b3 100644
--- a/server/services/portal.service.ts
+++ b/server/services/portal.service.ts
@@ -29,7 +29,13 @@ export class PortalService {
     };
   }
 
-  async createToken(data: { userCompanyId: number; targetCompanyId: number; targetContactId: number; createdBy: number; expiresInDays?: number; allowedActions?: any; customMessage?: string; timeframeDays?: number; includeNda?: boolean; }, baseUrl?: string): Promise<PortalAccessToken> {
+  async createToken(
+    data: { userCompanyId: number; targetCompanyId: number; targetContactId: number; createdBy: number; expiresInDays?: number; allowedActions?: any; customMessage?: string; timeframeDays?: number; includeNda?: boolean; },
+    baseUrl?: string,
+  ): Promise<{
+    token: PortalAccessToken;
+    sendResult: { success: boolean; sentVia: 'nylas' | 'resend'; fromEmail: string; replyToEmail: string | null } | null;
+  }> {
     // Deactivate any existing active tokens for this company to allow new token creation
     await portalRepository.deactivateTokensForCompany(data.targetCompanyId);
     

$ git show 4f6299b -- server/routes/deal-document.routes.ts
commit 4f6299bfddbc6e7e87f6b78bd855fa9e76ccdad2
Author: adam1329 <46372644-adam1329@users.noreply.replit.com>
Date:   Fri Sep 11 16:01:13 2026 +0000

    Fix all reported dependency vulnerabilities
    
    Replit-Task-Id: d20c63d5-6403-4141-bf0f-e4062e08552e
    Replit-Merge-Attempt: MergeTask:d20c63d5-6403-4141-bf0f-e4062e08552e:1:e89649d2

diff --git a/server/routes/deal-document.routes.ts b/server/routes/deal-document.routes.ts
index 851dd92..d786d4d 100644
--- a/server/routes/deal-document.routes.ts
+++ b/server/routes/deal-document.routes.ts
@@ -300,11 +300,14 @@ router.get('/:id/download-word', asyncHandler(async (req, res) => {
   bodyHtml += buildPhysicalSignatureBlock(doc.documentType, data, doc.id);
 
   const HTMLtoDOCX = (await import('html-to-docx')).default;
-  const buffer = await HTMLtoDOCX(bodyHtml, null, {
+  const docx = await HTMLtoDOCX(bodyHtml, null, {
     table: { row: { cantSplit: true } },
     footer: false,
     pageNumber: false,
   });
+  const buffer = Buffer.isBuffer(docx)
+    ? docx
+    : Buffer.from(await docx.arrayBuffer());
 
   const docTypeNames: Record<string, string> = {
     nda: 'NDA',

$ git show 4f6299b -- server/utils/pdf-generator.ts
commit 4f6299bfddbc6e7e87f6b78bd855fa9e76ccdad2
Author: adam1329 <46372644-adam1329@users.noreply.replit.com>
Date:   Fri Sep 11 16:01:13 2026 +0000

    Fix all reported dependency vulnerabilities
    
    Replit-Task-Id: d20c63d5-6403-4141-bf0f-e4062e08552e
    Replit-Merge-Attempt: MergeTask:d20c63d5-6403-4141-bf0f-e4062e08552e:1:e89649d2

diff --git a/server/utils/pdf-generator.ts b/server/utils/pdf-generator.ts
index 6f9fae4..0b6fc9e 100644
--- a/server/utils/pdf-generator.ts
+++ b/server/utils/pdf-generator.ts
@@ -44,7 +44,8 @@ export async function generatePdfFromHtml(html: string): Promise<Buffer> {
 
   try {
     const page = await browser.newPage();
-    await page.setContent(fullHtml, { waitUntil: 'networkidle0' });
+    await page.setContent(fullHtml, { waitUntil: 'domcontentloaded' });
+    await page.waitForNetworkIdle({ concurrency: 0, idleTime: 500 });
     const pdfBuffer = Buffer.from(await page.pdf({
       format: 'A4',
       margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' },
```

## STEP 2 — ARE THE GUARDS INTACT

```text
$ rg -cF "isOfferPriceSupportable" server/routes/deal-document.routes.ts
2

$ rg -cF "isOfferPriceSupportable" server/services/deal-document.service.ts
3

$ rg -cF "assessOfferSupportability" server/services/deal-document.service.ts
2

$ rg -cF "hasValuationEligibleYear" server/services/deal-model.service.ts
3

$ rg -cF "No offer supportable. This offer letter has no verifiable price" server/routes/deal-document.routes.ts
1

$ rg -n "No offer supportable" server/routes/deal-document.routes.ts server/services/deal-document.service.ts
server/routes/deal-document.routes.ts
351:        message: 'No offer supportable. This offer letter has no verifiable price above zero, so its status cannot be advanced.',

server/services/deal-document.service.ts
111:          'No offer supportable. This offer letter has no verifiable price above zero and cannot be sent. Regenerate it from the deal model.',

$ npx vitest run server/services/__tests__/offer-guard-call-sites.test.ts 2>&1 | tail -20

 RUN  v4.1.11 /home/runner/workspace


 Test Files  1 passed (1)
      Tests  11 passed (11)
   Start at  16:15:12
   Duration  2.20s (transform 427ms, setup 0ms, import 1.37s, tests 657ms, environment 0ms)
```

## STEP 3 — DOCUMENT GENERATION, THE UNTESTED PATH

```text
$ rg -n "html-to-docx|HTMLtoDOCX" server --glob "*.ts"
server/types.d.ts
1:declare module 'html-to-docx';

server/routes/deal-document.routes.ts
302:  const HTMLtoDOCX = (await import('html-to-docx')).default;
303:  const docx = await HTMLtoDOCX(bodyHtml, null, {

$ rg -n "puppeteer" server --glob "*.ts"
server/utils/pdf-generator.ts
38:  const puppeteer = await import('puppeteer');
39:  const browser = await puppeteer.default.launch({

server/services/deal-document.service.ts
496:    } catch (puppeteerErr) {
497:      console.error('[DEAL_DOCS] Puppeteer PDF generation failed:', puppeteerErr);

$ sed -n '1,80p' server/utils/pdf-generator.ts
import { execSync } from 'child_process';

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

export async function generatePdfFromHtml(html: string): Promise<Buffer> {
  const alreadyWrapped = html.trimStart().startsWith('<!DOCTYPE') || html.trimStart().startsWith('<html');

  const fullHtml = alreadyWrapped ? html : `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px; color: #333; line-height: 1.6; font-size: 13px; }
  h1 { font-size: 18px; }
  h2 { font-size: 15px; }
  h3 { font-size: 13px; }
  p { margin: 6px 0; }
  table { border-collapse: collapse; width: 100%; }
  td, th { padding: 4px 8px; }
</style>
</head>
<body>${html}</body>
</html>`;

  const puppeteer = await import('puppeteer');
  const browser = await puppeteer.default.launch({
    headless: true,
    executablePath: getChromiumExecutable(),
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(fullHtml, { waitUntil: 'domcontentloaded' });
    await page.waitForNetworkIdle({ concurrency: 0, idleTime: 500 });
    const pdfBuffer = Buffer.from(await page.pdf({
      format: 'A4',
      margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' },
    }));
    return pdfBuffer;
  } finally {
    await browser.close();
  }
}

$ node -e "console.log('html-to-docx', require('./package-lock.json').packages['node_modules/html-to-docx']?.version); console.log('puppeteer', require('./package-lock.json').packages['node_modules/puppeteer']?.version);"
html-to-docx 1.1.2
puppeteer 25.10.0
```

## STEP 4 — SPREADSHEET PARSING

```text
$ rg -n "from 'xlsx'|require\('xlsx'\)|from \"xlsx\"" server client/src --glob "*.ts*"
server/utils/spreadsheet-to-text.ts
1:import * as XLSX from 'xlsx';

$ node -e "console.log(Object.keys(require('./package-lock.json').packages).filter(k=>k.includes('xlsx')).join('\n'))"
node_modules/xlsx
```

## STEP 5 — OUTPUT

```text
$ wc -l docs/event-promo-release/ASSESS-E-source-changes-in-bump.md
242 docs/event-promo-release/ASSESS-E-source-changes-in-bump.md

$ git status --porcelain
?? docs/event-promo-release/ASSESS-E-source-changes-in-bump.md

$ git diff --stat
```

V-CHECK — git status: PASS (only the new assessment file is untracked).

V-CHECK — git diff --stat: PASS (no tracked source-file changes).