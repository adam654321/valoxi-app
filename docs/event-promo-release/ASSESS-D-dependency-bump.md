# ASSESS-D dependency bump

## STEP 1 — WHAT LANDED

```text
$ git log --oneline -12
0fdfe14 (HEAD -> main, gitsafe-backup/main) Add event promo assessment documentation
ab178ee Update package lock file
4f6299b Fix all reported dependency vulnerabilities
8bd6268 Add release safety assessment documentation
afa3786 Add unit tests for offer guard call sites
3816d6f Implement deal model service updates
4d165c6 Implement document processing logic in routes and service
5d08a53 Implement deal model logic and add offer guard tests
5dde23b Update agent metadata and add pipeline fidelity identity documentation
b434879 Document tier precedence sizing logic for pipeline fidelity fix
5476ec1 Add documentation on D3 exposure sizing for pipeline fidelity fix
bdc184d Add pipeline fidelity assessment documentation part two

$ git log -6 --stat -- package.json package-lock.json
commit ab178eea2c62f2993d6da68cf0384f5c69aa4719
Author: Replit Agent <agent@replit.com>
Date:   Fri Sep 11 16:01:35 2026 +0000

    Update package lock file
    
    Replit-Commit-Author: Agent

 package-lock.json | 2 +-
 1 file changed, 1 insertion(+), 1 deletion(-)

commit 4f6299bfddbc6e7e87f6b78bd855fa9e76ccdad2
Author: adam1329 <46372644-adam1329@users.noreply.replit.com>
Date:   Fri Sep 11 16:01:13 2026 +0000

    Fix all reported dependency vulnerabilities
    
    Replit-Task-Id: d20c63d5-6403-4141-bf0f-e4062e08552e
    Replit-Merge-Attempt: MergeTask:d20c63d5-6403-4141-bf0f-e4062e08552e:1:e89649d2

 package-lock.json | 5126 +++++++++++++++++++++--------------------------------
 package.json      |   79 +-
 2 files changed, 2063 insertions(+), 3142 deletions(-)

commit bf534e8bbaedf489bbc7be87d1161f0fd02da043
Author: Replit Agent <agent@replit.com>
Date:   Wed Jul 1 08:20:47 2026 +0000

    Add ability to process spreadsheet documents within the AI analysis
    
    Introduce XLSX package and a new utility to convert spreadsheet data into a text format, enabling AI analysis of files like Excel documents.
    
    Replit-Commit-Author: Agent
    Replit-Commit-Session-Id: 702fb17a-c1cf-4cdf-a0a8-c9882e9e0a8c
    Replit-Commit-Checkpoint-Type: full_checkpoint
    Replit-Commit-Event-Id: 7e13dd3f-58f1-445f-87a3-73d3a054db93
    Replit-Commit-Screenshot-Url: https://storage.googleapis.com/screenshot-production-us-central1/85fb53ef-8f2a-4b29-b64b-c651f49dfeb5/702fb17a-c1cf-4cdf-a0a8-c9882e9e0a8c/Cjb5GBQ
    Replit-Helium-Checkpoint-Created: true

 package-lock.json | 104 ++++++++++++++++++++++++++++++++++++++++++++++++++++++
 package.json      |   1 +
 2 files changed, 105 insertions(+)

commit 752e74712b1996a6d49c1d006c56951f1fb7e7b7
Author: Replit Agent <agent@replit.com>
Date:   Fri Jun 5 09:12:41 2026 +0000

    Update AWS SDK dependency to ensure package version compatibility
    
    Pin the @aws-sdk/s3-request-presigner package to version 3.1011.0 to resolve a type mismatch error with @aws-sdk/client-s3.
    
    Replit-Commit-Author: Agent
    Replit-Commit-Session-Id: c8844d9e-0cd1-48cf-b0e6-4c8175185c2a
    Replit-Commit-Checkpoint-Type: full_checkpoint
    Replit-Commit-Event-Id: 317dcad2-f14c-407c-a19c-dcfe075bedaa
    Replit-Commit-Screenshot-Url: https://storage.googleapis.com/screenshot-production-us-central1/85fb53ef-8f2a-4b29-b64b-c651f49dfeb5/c8844d9e-0cd1-48cf-b0e6-4c8175185c2a/7G9XSGn
    Replit-Helium-Checkpoint-Created: true

 package-lock.json | 33 ++++++++++++++++++++++++---------
 package.json      |  2 +-
 2 files changed, 25 insertions(+), 10 deletions(-)

commit 8af33f9a5b5319386798b40e5e5a8deac0dbaf3e
Author: Replit Agent <agent@replit.com>
Date:   Fri Jun 5 08:55:55 2026 +0000

    Add tool for generating pre-signed URLs for AWS S3 uploads
    
    Add the `@aws-sdk/s3-request-presigner` package to the project dependencies.
    
    Replit-Commit-Author: Agent
    Replit-Commit-Session-Id: c8844d9e-0cd1-48cf-b0e6-4c8175185c2a
    Replit-Commit-Checkpoint-Type: full_checkpoint
    Replit-Commit-Event-Id: 3a698d3d-0a6e-45c7-960d-1d6834749939
    Replit-Commit-Screenshot-Url: https://storage.googleapis.com/screenshot-production-us-central1/85fb53ef-8f2a-4b29-b64b-c651f49dfeb5/c8844d9e-0cd1-48cf-b0e6-4c8175185c2a/7G9XSGn
    Replit-Helium-Checkpoint-Created: true

 package-lock.json | 173 +++++++++++++++++++++++++++++++-----------------------
 package.json      |   1 +
 2 files changed, 102 insertions(+), 72 deletions(-)

commit 7e7433eb6bacb955419c059e9a960d3145a293f3
Author: adam1329 <46372644-adam1329@users.noreply.replit.com>
Date:   Sat May 16 02:07:08 2026 +0000

    Saved progress at the end of the loop
    
    Replit-Commit-Author: Agent
    Replit-Commit-Session-Id: 4be39413-902e-43a3-9424-91cbeb87e163
    Replit-Commit-Checkpoint-Type: full_checkpoint
    Replit-Commit-Event-Id: 40996446-413c-4d26-957b-aa924594f7cb
    Replit-Commit-Screenshot-Url: https://storage.googleapis.com/screenshot-production-us-central1/85fb53ef-8f2a-4b29-b64b-c651f49dfeb5/4be39413-902e-43a3-9424-91cbeb87e163/0VqqtBM
    Replit-Helium-Checkpoint-Created: true

 package-lock.json | 68 ++-----------------------------------------------------
 1 file changed, 2 insertions(+), 66 deletions(-)

$ git status --porcelain

$ git show 4f6299bfddbc6e7e87f6b78bd855fa9e76ccdad2 --stat
commit 4f6299bfddbc6e7e87f6b78bd855fa9e76ccdad2
Author: adam1329 <46372644-adam1329@users.noreply.replit.com>
Date:   Fri Sep 11 16:01:13 2026 +0000

    Fix all reported dependency vulnerabilities
    
    Replit-Task-Id: d20c63d5-6403-4141-bf0f-e4062e08552e
    Replit-Merge-Attempt: MergeTask:d20c63d5-6403-4141-bf0f-e4062e08552e:1:e89649d2

 .replit                               |    2 +-
 package-lock.json                     | 5126 +++++++++++++--------------------
 package.json                          |   79 +-
 server/routes/deal-document.routes.ts |    5 +-
 server/services/portal.service.ts     |    8 +-
 server/utils/pdf-generator.ts         |    3 +-
 6 files changed, 2077 insertions(+), 3146 deletions(-)

$ git show 4f6299bfddbc6e7e87f6b78bd855fa9e76ccdad2 -- package.json
commit 4f6299bfddbc6e7e87f6b78bd855fa9e76ccdad2
Author: adam1329 <46372644-adam1329@users.noreply.replit.com>
Date:   Fri Sep 11 16:01:13 2026 +0000

    Fix all reported dependency vulnerabilities
    
    Replit-Task-Id: d20c63d5-6403-4141-bf0f-e4062e08552e
    Replit-Merge-Attempt: MergeTask:d20c63d5-6403-4141-bf0f-e4062e08552e:1:e89649d2

diff --git a/package.json b/package.json
index aa8a10c..50267b2 100644
--- a/package.json
+++ b/package.json
@@ -14,9 +14,9 @@
   "dependencies": {
     "@aws-sdk/client-s3": "^3.1011.0",
     "@aws-sdk/s3-request-presigner": "^3.1011.0",
-    "@clerk/express": "^2.1.5",
-    "@clerk/react": "^6.4.2",
-    "@google-cloud/storage": "^7.16.0",
+    "@clerk/express": "^2.1.67",
+    "@clerk/react": "^6.15.2",
+    "@google-cloud/storage": "^7.22.0",
     "@hello-pangea/dnd": "^18.0.1",
     "@hookform/resolvers": "^3.10.0",
     "@jridgewell/trace-mapping": "^0.3.25",
@@ -68,15 +68,15 @@
     "cross-env": "^10.1.0",
     "date-fns": "^3.6.0",
     "docx-templates": "^4.15.0",
-    "drizzle-orm": "^0.39.1",
-    "drizzle-zod": "^0.7.1",
+    "drizzle-orm": "^0.45.2",
+    "drizzle-zod": "0.7.1",
     "embla-carousel-react": "^8.6.0",
-    "express": "^4.21.2",
-    "express-rate-limit": "^8.2.1",
-    "express-session": "^1.18.1",
+    "express": "^4.22.1",
+    "express-rate-limit": "^8.7.0",
+    "express-session": "^1.19.0",
     "framer-motion": "^11.13.1",
     "google-auth-library": "^10.2.1",
-    "html-to-docx": "^1.8.0",
+    "html-to-docx": "1.1.2",
     "input-otp": "^1.4.2",
     "jsonwebtoken": "^9.0.3",
     "lucide-react": "^0.453.0",
@@ -84,14 +84,14 @@
     "marked": "^18.0.3",
     "memoizee": "^0.4.17",
     "memorystore": "^1.6.7",
-    "multer": "^2.0.2",
+    "multer": "^2.3.0",
     "next-themes": "^0.4.6",
     "node-cron": "^4.2.1",
-    "nylas": "^8.1.0",
+    "nylas": "^8.4.0",
     "openid-client": "^6.6.4",
     "p-limit": "^7.2.0",
     "p-retry": "^7.1.1",
-    "puppeteer": "^24.37.2",
+    "puppeteer": "^25.10.0",
     "react": "^18.3.1",
     "react-chartjs-2": "^5.3.0",
     "react-day-picker": "^8.10.1",
@@ -102,16 +102,16 @@
     "react-resizable-panels": "^2.1.7",
     "recharts": "^2.15.2",
     "remark-gfm": "^4.0.1",
-    "resend": "^6.10.0",
+    "resend": "^6.27.0",
     "stripe": "^20.4.0",
-    "svix": "^1.90.0",
+    "svix": "^1.99.1",
     "tailwind-merge": "^2.6.0",
     "tailwindcss-animate": "^1.0.7",
     "tw-animate-css": "^1.2.5",
     "vaul": "^1.1.2",
     "wouter": "^3.3.5",
-    "ws": "^8.18.0",
-    "xlsx": "^0.18.5",
+    "ws": "^8.21.3",
+    "xlsx": "npm:@e965/xlsx@^0.20.3",
     "zod": "^3.25.76",
     "zod-validation-error": "^3.5.4"
   },
@@ -119,30 +119,59 @@
     "@replit/vite-plugin-cartographer": "^0.5.1",
     "@replit/vite-plugin-runtime-error-modal": "^0.0.3",
     "@tailwindcss/typography": "^0.5.15",
-    "@tailwindcss/vite": "^4.1.3",
+    "@tailwindcss/vite": "^4.1.18",
     "@types/connect-pg-simple": "^7.0.3",
     "@types/express": "4.17.21",
     "@types/express-session": "^1.18.0",
     "@types/memoizee": "^0.4.12",
     "@types/multer": "^2.0.0",
-    "@types/node": "20.16.11",
+    "@types/node": "^20.19.14",
     "@types/node-cron": "^3.0.11",
     "@types/react": "^18.3.11",
     "@types/react-dom": "^18.3.1",
     "@types/supertest": "^6.0.3",
     "@types/ws": "^8.5.13",
-    "@vitejs/plugin-react": "^4.3.2",
-    "autoprefixer": "^10.4.20",
-    "drizzle-kit": "^0.30.4",
+    "@vitejs/plugin-react": "^5.2.0",
+    "autoprefixer": "^10.4.21",
+    "drizzle-kit": "^0.31.10",
     "esbuild": "^0.25.0",
-    "postcss": "^8.4.47",
+    "postcss": "^8.5.28",
     "tailwindcss": "^3.4.17",
-    "tsx": "^4.19.1",
+    "tsx": "^4.23.13",
     "typescript": "5.6.3",
-    "vite": "^5.4.21",
-    "vitest": "^4.0.18"
+    "vite": "^7.3.6",
+    "vitest": "^4.1.11"
   },
   "optionalDependencies": {
     "bufferutil": "^4.0.8"
+  },
+  "overrides": {
+    "@esbuild-kit/core-utils": {
+      "esbuild": "0.28.2"
+    },
+    "@tootallnate/once": "3.0.1",
+    "@types/request": {
+      "form-data": "2.5.6"
+    },
+    "@xmldom/xmldom": "0.9.12",
+    "body-parser": "1.20.8",
+    "brace-expansion": "2.1.4",
+    "form-data": "4.0.6",
+    "gaxios": "7.1.3",
+    "glob": "10.5.0",
+    "lodash": "4.18.1",
+    "mdast-util-to-hast": "13.2.1",
+    "minimatch": "9.0.9",
+    "nanoid@^5": "5.1.16",
+    "path-to-regexp": "0.1.13",
+    "picomatch@^2": "2.3.2",
+    "picomatch@^4": "4.0.7",
+    "postcss-selector-parser": "6.1.4",
+    "preact": "10.29.8",
+    "qs": "6.16.0",
+    "rollup": "4.63.1",
+    "underscore": "1.13.8",
+    "uuid": "11.1.1",
+    "yaml": "2.9.0"
   }
 }
```

Commit `4f6299bfddbc6e7e87f6b78bd855fa9e76ccdad2` changed `package.json`. Commit `ab178eea2c62f2993d6da68cf0384f5c69aa4719` changed only `package-lock.json`.

## STEP 2 — THE FOUR THAT MATTER

```text
$ git show 4f6299bfddbc6e7e87f6b78bd855fa9e76ccdad2^:package.json | rg -n "drizzle-orm|@clerk|multer|express-rate-limit|vite|vitest|esbuild"
8:    "build": "vite build && esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist",
17:    "@clerk/express": "^2.1.5",
18:    "@clerk/react": "^6.4.2",
71:    "drizzle-orm": "^0.39.1",
75:    "express-rate-limit": "^8.2.1",
87:    "multer": "^2.0.2",
119:    "@replit/vite-plugin-cartographer": "^0.5.1",
120:    "@replit/vite-plugin-runtime-error-modal": "^0.0.3",
122:    "@tailwindcss/vite": "^4.1.3",
127:    "@types/multer": "^2.0.0",
134:    "@vitejs/plugin-react": "^4.3.2",
137:    "esbuild": "^0.25.0",
142:    "vite": "^5.4.21",
143:    "vitest": "^4.0.18"

$ rg -n "drizzle-orm|@clerk|multer|express-rate-limit|vite|vitest|esbuild" package.json
8:    "build": "vite build && esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist",
17:    "@clerk/express": "^2.1.67",
18:    "@clerk/react": "^6.15.2",
71:    "drizzle-orm": "^0.45.2",
75:    "express-rate-limit": "^8.7.0",
87:    "multer": "^2.3.0",
119:    "@replit/vite-plugin-cartographer": "^0.5.1",
120:    "@replit/vite-plugin-runtime-error-modal": "^0.0.3",
122:    "@tailwindcss/vite": "^4.1.18",
127:    "@types/multer": "^2.0.0",
134:    "@vitejs/plugin-react": "^5.2.0",
137:    "esbuild": "^0.25.0",
142:    "vite": "^7.3.6",
143:    "vitest": "^4.1.11"
149:    "@esbuild-kit/core-utils": {
150:      "esbuild": "0.28.2"

$ git show 4f6299bfddbc6e7e87f6b78bd855fa9e76ccdad2^:package-lock.json | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).packages['node_modules/@clerk/backend']?.version ?? 'not present'))"
3.2.13

$ node -e "console.log(require('./package-lock.json').packages['node_modules/@clerk/backend']?.version ?? 'not present')"
3.17.2
```

drizzle-orm: minor version change, `0.39.1` to `0.45.2`.

@clerk/backend: minor version change, `3.2.13` to `3.17.2`.

multer: minor version change, `2.0.2` to `2.3.0`.

express-rate-limit: minor version change, `8.2.1` to `8.7.0`.

## STEP 3 — DOES IT STILL WORK

```text
$ npm run check 2>&1 | tail -30

> rest-express@1.0.0 check
> tsc

$ npm run build 2>&1 | tail -40
../dist/public/assets/broadcasts-BJK67yKM.js                   6.86 kB │ gzip:   2.48 kB
../dist/public/assets/settings-C8Uq2oXR.js                     7.08 kB │ gzip:   2.01 kB
../dist/public/assets/reports-Dzhb7QRQ.js                      9.55 kB │ gzip:   2.76 kB
../dist/public/assets/file-upload-test-BxFwE88p.js             9.55 kB │ gzip:   2.93 kB
../dist/public/assets/onboarding-BByUPRS3.js                   9.58 kB │ gzip:   3.17 kB
../dist/public/assets/subscriptions-CVek8Aam.js               10.14 kB │ gzip:   2.97 kB
../dist/public/assets/feedback-Dew-9byr.js                    12.68 kB │ gzip:   3.60 kB
../dist/public/assets/company-form-dialog-6OAeFrvW.js         12.95 kB │ gzip:   4.70 kB
../dist/public/assets/referral-invoice-DdS7OY8z.js            13.65 kB │ gzip:   3.89 kB
../dist/public/assets/contacts-o-ZH-xMB.js                    17.23 kB │ gzip:   3.56 kB
../dist/public/assets/team-management-DPO0lvAz.js             18.34 kB │ gzip:   5.20 kB
../dist/public/assets/waitlist-Cv037Tzu.js                    18.59 kB │ gzip:   5.31 kB
../dist/public/assets/PortalManagement-UgZ6A-Q4.js            19.43 kB │ gzip:   5.17 kB
../dist/public/assets/format-DTcrAbFC.js                      19.55 kB │ gzip:   5.52 kB
../dist/public/assets/account-CTEt9x_o.js                     20.17 kB │ gzip:   6.33 kB
../dist/public/assets/helpContent-B3RZy-zv.js                 22.57 kB │ gzip:   7.39 kB
../dist/public/assets/BarChart-CoUXQNb3.js                    24.56 kB │ gzip:   6.36 kB
../dist/public/assets/PieChart-NHQqFX77.js                    26.04 kB │ gzip:   7.07 kB
../dist/public/assets/billing-BGi1pv2T.js                     27.30 kB │ gzip:   7.35 kB
../dist/public/assets/dashboard-DS_670-H.js                   28.54 kB │ gzip:   6.06 kB
../dist/public/assets/enhanced-target-companies-rREXcBNZ.js   35.02 kB │ gzip:   9.92 kB
../dist/public/assets/PortalPage-2iKni9O_.js                  70.76 kB │ gzip:  15.70 kB
../dist/public/assets/types-DnMxdR39.js                       87.25 kB │ gzip:  24.19 kB
../dist/public/assets/pipeline-DxJjIS6U.js                   106.85 kB │ gzip:  33.41 kB
../dist/public/assets/company-accounts-E4lnuUsP.js           116.68 kB │ gzip:  26.64 kB
../dist/public/assets/index-BQ0HEhxx.js                      117.76 kB │ gzip:  36.15 kB
../dist/public/assets/generateCategoricalChart-CJgLogZe.js   358.82 kB │ gzip: 100.23 kB
../dist/public/assets/index-4aoowoAe.js                      532.01 kB │ gzip: 160.07 kB
../dist/public/assets/collapsible-GIZxkxSi.js                617.66 kB │ gzip: 160.16 kB
../dist/public/assets/target-company-detail-BypGTOtq.js      671.64 kB │ gzip: 140.24 kB

(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rollupOptions.output.manualChunks to improve chunking: https://rollupjs.org/configuration-options/#output.manualchunks
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
✓ built in 14.07s

  dist/index.js  1.4mb ⚠️

⚡ Done in 1777ms

$ npx vitest run server/services/__tests__/ 2>&1 | tail -40

 RUN  v4.1.11 /home/runner/workspace


 Test Files  15 passed (15)
      Tests  183 passed (183)
   Start at  16:10:47
   Duration  9.31s (transform 4.06s, setup 0ms, import 20.63s, tests 26.35s, environment 1ms)
```

Totals: TypeScript check passed with 0 errors; build passed with 0 errors and one chunk-size warning; 15 test files passed and 183 tests passed.

## STEP 4 — THE VANISHED TYPE ERROR, RUNTIME CHECK

```text
$ sed -n '70,95p' server/services/portal.service.ts
        });
      } catch (err: any) {
        console.error('[PORTAL] Failed to auto-create NDA:', err.message);
      }
    }
    
    // Send portal access email synchronously to capture sentVia for banner UI
    let sendResult: { success: boolean; sentVia: 'nylas' | 'resend'; fromEmail: string; replyToEmail: string | null } | null = null;
    if (baseUrl) {
      try {
        const result = await emailApiService.sendPortalAccessLink(token.id, baseUrl, data.createdBy, data.customMessage);
        sendResult = { success: result.success, sentVia: result.sentVia, fromEmail: result.fromEmail, replyToEmail: result.replyToEmail };
      } catch (err: any) {
        console.error(`[PORTAL] Failed to send portal access email for token ${token.id}:`, err.message);
      }
    }
    
    return { token, sendResult };
  }

  async getTokensForCompany(userCompanyId: number) {
    return await portalRepository.getTokensForCompany(userCompanyId);
  }

  async deactivateToken(tokenId: number, userCompanyId: number): Promise<boolean> {
    const token = await portalRepository.getTokenById(tokenId);

$ rg -n "portalAccessTokens" shared/schema --glob "*.ts" | head -10
shared/schema/portal.ts:9:export const portalAccessTokens = pgTable("portal_access_tokens", {
shared/schema/portal.ts:40:  portalTokenId: integer("portal_token_id").references(() => portalAccessTokens.id).notNull(),
shared/schema/portal.ts:68:  portalTokenId: integer("portal_token_id").references(() => portalAccessTokens.id).notNull(),
shared/schema/portal.ts:91:  portalTokenId: integer("portal_token_id").references(() => portalAccessTokens.id).notNull(),
shared/schema/portal.ts:108:  portalTokenId: integer("portal_token_id").references(() => portalAccessTokens.id).notNull(),
shared/schema/portal.ts:128:  portalTokenId: integer("portal_token_id").references(() => portalAccessTokens.id).notNull(),
shared/schema/portal.ts:163:  portalTokenId: integer("portal_token_id").references(() => portalAccessTokens.id).notNull(),
shared/schema/portal.ts:215:  portalTokenId: integer("portal_token_id").references(() => portalAccessTokens.id),
shared/schema/portal.ts:292:export const insertPortalAccessTokenSchema = createInsertSchema(portalAccessTokens).omit({
shared/schema/portal.ts:379:export type PortalAccessToken = typeof portalAccessTokens.$inferSelect;

$ sed -n '9,39p' shared/schema/portal.ts
export const portalAccessTokens = pgTable("portal_access_tokens", {
  id: serial("id").primaryKey(),
  targetCompanyId: integer("target_company_id").references(() => targetCompanies.id).notNull(),
  targetContactId: integer("target_contact_id").references(() => targetContacts.id).notNull(),
  userCompanyId: integer("user_company_id").references(() => userCompanies.id).notNull(),
  accessToken: varchar("access_token", { length: 255 }).unique().notNull(),
  tokenPurpose: varchar("token_purpose", { length: 50 }).default("document_submission"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  expiresAt: timestamp("expires_at").default(sql`(NOW() + INTERVAL '30 days')`),
  lastAccessed: timestamp("last_accessed"),
  accessCount: integer("access_count").default(0),
  createdBy: integer("created_by").references(() => users.id).notNull(),
  ipAddressesUsed: text("ip_addresses_used").array(),
  userAgentStrings: text("user_agent_strings").array(),
  allowedActions: text("allowed_actions").default('{"upload": true, "download": true, "message": true}'),
  customMessage: text("custom_message"),
  portalBranding: text("portal_branding"),
  agreedSubmissionTimeframe: integer("agreed_submission_timeframe").default(14),
  submissionDeadline: date("submission_deadline"),
  chaseUpStatus: varchar("chase_up_status", { length: 50 }).default("not_started"),
  lastChaseEmailSent: timestamp("last_chase_email_sent"),
  chaseEmailCount: integer("chase_email_count").default(0),
  manualDeadlineSet: timestamp("manual_deadline_set"),
  finalDeadlineDate: date("final_deadline_date"),
  escalationLevel: varchar("escalation_level", { length: 50 }).default("none"),
});

// External document submissions table
export const externalDocumentSubmissions = pgTable("external_document_submissions", {
  id: serial("id").primaryKey(),

$ psql "$DATABASE_URL" -c "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name='portal_access_tokens' ORDER BY ordinal_position;"
         column_name         |          data_type          | is_nullable 
-----------------------------+-----------------------------+-------------
 id                          | integer                     | NO
 target_company_id           | integer                     | NO
 target_contact_id           | integer                     | NO
 user_company_id             | integer                     | NO
 access_token                | character varying           | NO
 token_purpose               | character varying           | YES
 expires_at                  | timestamp without time zone | NO
 created_by                  | integer                     | NO
 created_at                  | timestamp without time zone | YES
 is_active                   | boolean                     | YES
 last_accessed               | timestamp without time zone | YES
 access_count                | integer                     | YES
 allowed_actions             | text                        | YES
 custom_message              | text                        | YES
 portal_branding             | text                        | YES
 ip_addresses_used           | ARRAY                       | YES
 user_agent_strings          | ARRAY                       | YES
 agreed_submission_timeframe | integer                     | YES
 submission_deadline         | date                        | YES
 chase_up_status             | character varying           | YES
 last_chase_email_sent       | timestamp without time zone | YES
 chase_email_count           | integer                     | YES
 manual_deadline_set         | timestamp without time zone | YES
 final_deadline_date         | date                        | YES
 escalation_level            | character varying           | YES
(25 rows)
```

No column named `token` exists in the database table, and the schema definition does not declare one. Both use `access_token`/`accessToken`, so the old error exposed a real property-name bug rather than a false positive.

## STEP 5 — OUTPUT

```text
$ wc -l docs/event-promo-release/ASSESS-D-dependency-bump.md
520 docs/event-promo-release/ASSESS-D-dependency-bump.md

$ git status --porcelain
?? docs/event-promo-release/ASSESS-D-dependency-bump.md

$ git diff --stat
```

V-CHECK — git status: PASS (only the new assessment file is untracked).

V-CHECK — git diff --stat: PASS (no tracked source-file changes).