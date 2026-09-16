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

# READ-ONLY VERIFICATION AGAINST REAL PROD

## 0. PROVE WHICH DATABASE YOU ARE ON

Every production query in this section was run directly with `psql "$PROD_DATABASE_URL"`. The managed production query connection was not used.

```text
HOST_PREFIX: ep-old-recipe-an7e4a
 current_database 
------------------
 neondb
(1 row)

 count 
-------
   700
(1 row)
```

This is not DEV: the explicit connection host starts with `ep-old-recipe`, and `balance_sheets` contains 700 rows rather than 216.

## 1. #533 VERIFICATION, THE DEPLOY GATE

```text
            column_name            |          data_type          | is_nullable | column_default 
-----------------------------------+-----------------------------+-------------+----------------
 unsupported_price_acknowledged_at | timestamp without time zone | YES         | 
 unsupported_price_acknowledged_by | integer                     | YES         | 
(2 rows)
```

```text
                    constraint_name                    |                              definition                              
-------------------------------------------------------+----------------------------------------------------------------------
 deal_documents_unsupported_price_acknowledged_by_fkey | FOREIGN KEY (unsupported_price_acknowledged_by) REFERENCES users(id)
(1 row)
```

```text
 count 
-------
    40
(1 row)
```

#533's claim holds on this database: both nullable columns exist, the FK is named `deal_documents_unsupported_price_acknowledged_by_fkey`, and `deal_documents` contains 40 rows.

## 2. #534 RE-MEASURE ON THIS DATABASE

Found in `shared/schema/deal-models.ts`:

```text
18-  averagingYears: integer("averaging_years").default(3),
19-  ebitdaMultiple: decimal("ebitda_multiple").default('3.0'),
20-  offerDriver: varchar("offer_driver", { length: 20 }).default('ebitda'),
21:  targetOfferPrice: decimal("target_offer_price"),
22-  multipleLow: decimal("multiple_low"),
23-  multipleHigh: decimal("multiple_high"),
24-  propertyValue: decimal("property_value").default('0'),
--
26-  otherAssets: decimal("other_assets").default('0'),
27-  calculatedEbitda: decimal("calculated_ebitda"),
28-  adjustedEbitda: decimal("adjusted_ebitda"),
29:  enterpriseValue: decimal("enterprise_value"),
30-  plusExcessCash: decimal("plus_excess_cash"),
31-  minusPrimaryDebt: decimal("minus_primary_debt"),
32-  minusOtherDebt: decimal("minus_other_debt"),
```

The table is `deal_models`; computed offer price is stored in `target_offer_price`, and enterprise value is stored in `enterprise_value`.

```text
 total_models | stored_price_at_or_below_zero | distinct_companies 
--------------+-------------------------------+--------------------
          124 |                             1 |                  1
(1 row)
```

```text
 sent_or_accepted_documents 
----------------------------
                          0
(1 row)
```

These results differ materially from #534's earlier measurement of roughly 28 nonpositive models across 25 companies. On real production there is 1 such model across 1 company. The earlier measurement was on the wrong database. The total model count, 124, and sent-or-accepted count, 0, match the expected shape.

## 3. PROD FLAG STATE

```text
              key              | value 
-------------------------------+-------
 evidence_shadow_write_enabled | true
(1 row)
```

There is no `canonical_shadow_write_enabled` row. No flag was changed.

## 4. EVENT CAMPAIGN ON REAL PROD

Found in `shared/schema/billing.ts`. The real table name is `promo_code_campaigns`, with this full schema column list:

```text
export const promoCodeCampaigns = pgTable("promo_code_campaigns", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  slug: varchar("slug", { length: 50 }).notNull().unique(),
  stripeCouponId: varchar("stripe_coupon_id", { length: 50 }).notNull(),
  referralSource: varchar("referral_source", { length: 50 }).notNull(),
  freeMonthsTotal: integer("free_months_total").notNull().default(0),
  maxTotalClaims: integer("max_total_claims"),
  isActive: boolean("is_active").notNull().default(true),
  expiresAt: timestamp("expires_at"),
  postFreePeriodCouponId: varchar("post_free_period_coupon_id", { length: 50 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  createdByUserId: integer("created_by_user_id").references(() => users.id),
});
```

PROD:

```text
 count 
-------
     0
(1 row)
```

PROD:

```text
 id |          name           |     slug     | referral_source 
----+-------------------------+--------------+-----------------
  9 | Standard 5D community   | 5d-community | 5d_community
 10 | Early Bird              | early-bird   | early_bird
 11 | 5D New Member           | 5d           | 5d_community
 12 | Welcome Discount        | welcome      | welcome
 13 | 5D New Member (1 month) | 5d1m         | 5d_community
(5 rows)
```

DEV:

```text
 id |                     name                      | stripe_coupon_id  |   referral_source   | free_months_total |     expires_at      |         created_at         | created_by_user_id | post_free_period_coupon_id |   slug   | max_total_claims | is_active 
----+-----------------------------------------------+-------------------+---------------------+-------------------+---------------------+----------------------------+--------------------+----------------------------+----------+------------------+-----------
 16 | The Business Buying Experience Live 2026 (5D) | UNUSED_TRIAL_ONLY | event_bbe_live_2026 |                 1 | 2026-10-03 23:00:00 | 2026-09-14 10:24:29.450438 |                    |                            | bbe-live |              400 | t
(1 row)
```

Real production has zero rows with slug `bbe-live`.

## 5. IDENTIFY THE WRONG CONNECTION

The visible `.replit` database-related configuration is:

```text
[env]
PORT = "5000"

[agent]
integrations = ["javascript_log_in_with_replit:1.0.0", "javascript_object_storage:1.0.0", "javascript_database:1.0.0", "javascript_gemini_ai_integrations:2.0.0"]
```

The managed production query connection is supplied by the Replit `javascript_database` integration. No managed production connection string, secret name, or host is present in `.replit` or the application config. The only host observable for that connection is the masked, credential-free host from its earlier error:

```text
HOST: ep-wandering-sunset-anbtkuyn.c-6.us-east-1.aws.neon.tech
CREDENTIALS: [REDACTED]
```

No hardcoded connection string matching `ep-wandering-sunset` was found. Repository host-match count:

```text
6
```

Up to 20 matching lines:

```text
./docs/release-2026-09/assess.md:98:psql: error: connection to server at "ep-wandering-sunset-anbtkuyn.c-6.us-east-1.aws.neon.tech" (35.173.20.131), port 5432 failed: ERROR:  password authentication failed for user 'neondb_owner'
./docs/release-2026-09/assess.md:103:psql: error: connection to server at "ep-wandering-sunset-anbtkuyn.c-6.us-east-1.aws.neon.tech" (3.227.221.118), port 5432 failed: ERROR:  password authentication failed for user 'neondb_owner'
./docs/release-2026-09/assess.md:108:psql: error: connection to server at "ep-wandering-sunset-anbtkuyn.c-6.us-east-1.aws.neon.tech" (100.51.95.243), port 5432 failed: ERROR:  password authentication failed for user 'neondb_owner'
./docs/release-2026-09/assess.md:164:psql: error: connection to server at "ep-wandering-sunset-anbtkuyn.c-6.us-east-1.aws.neon.tech" (35.173.20.131), port 5432 failed: ERROR:  password authentication failed for user 'neondb_owner'
./docs/release-2026-09/assess.md:169:The failure host `ep-wandering-sunset-anbtkuyn.c-6.us-east-1.aws.neon.tech` is not the host currently encoded in `PROD_DATABASE_URL`, which is `ep-old-recipe-an7e4afw.c-6.us-east-1.aws.neon.tech`.
./docs/event-promo-release/ASSESS-A-release-safety.md:348:Encountered an error executing SQL command: exitCode=2 exitReason=exit stderr=psql: error: connection to server at "ep-wandering-sunset-anbtkuyn.c-6.us-east-1.aws.neon.tech" (100.51.95.243), port 5432 failed: ERROR:  password authentication failed for user 'neondb_owner'
```

All six matches are documentation records of the earlier failed connection, not application code, configuration, or a hardcoded connection string. No connection to that host was attempted during this verification.

## 6. THE OUTSTANDING TWO FROM LAST TIME

```text
$ git diff -- .replit
```

The command produced no output.

Verbatim earlier error text, with no credential value present:

```text
psql: error: connection to server at "ep-wandering-sunset-anbtkuyn.c-6.us-east-1.aws.neon.tech" (35.173.20.131), port 5432 failed: ERROR:  password authentication failed for user 'neondb_owner'
```

ERROR CLASS: authentication failed.

# READ-ONLY STORED-VS-COMPUTED OFFER VERIFICATION

Every production query in this section ran through an inline TypeScript script invoked with:

```text
DATABASE_URL="$PROD_DATABASE_URL" npx tsx -e '<script>'
```

The managed production query connection and agent database integration were not used.

## 1. WHAT DOES THE SHIPPED CODE ACTUALLY TEST?

### a. Amber warning on the deal model screen

`client/src/components/deal-modeller/ValuationSection.tsx:280-291`

```text
  const ev = localCalcs?.enterpriseValue ?? 0;
  const offerPrice = localCalcs?.offerPrice ?? 0;
  const avgEbitda = localCalcs?.averageAdjustedEbitda ?? 0;
  const receivablesInterestAnnual = localCalcs?.receivablesInterestAnnual ?? 0;
  const valuationEbitda = localCalcs?.valuationEbitda ?? avgEbitda;

  // Commercial guards #296 and #324, surfaced to the user rather than enforced here.
  // The figures shown are always the real computed ones: these flags only explain them.
  // Sending an offer with an unsupportable price is gated server-side and requires an
  // explicit confirmation, because that document goes to the seller.
  const hasEligibleYear = Object.keys(reportedEbitdaByYear).length > 0;
  const offerIsUnsupported = !Number.isFinite(offerPrice) || offerPrice <= 0;
```

The amber warning tests a RECOMPUTED value: `localCalcs.offerPrice`.

### b. Send dialog with “No supportable offer” and “Send anyway”

`client/src/components/target-company/DealModeller.tsx:543-549`

```text
  const hasFullDealModeller = useHasFeature("fullDealModeller");

  // Commercial guard #324, surfaced at the send boundary. The figure itself is shown as
  // computed wherever it appears: this only decides whether the send dialog asks for an
  // explicit confirmation first, because the offer letter goes to the seller.
  const offerIsUnsupported = !!calculations
    && (!Number.isFinite(calculations.offerPrice) || calculations.offerPrice <= 0);
```

The send dialog tests a RECOMPUTED value: `calculations.offerPrice`, produced by the shared `calculateFullDealModel` path in the component.

### c. Server-side check on the send route

`server/services/deal-document.service.ts:107-120`

```text
    // The gate exists because this document goes to the SELLER. An offer letter arriving
    // at a business owner reading "-£4,411" is not a negotiating position. Whether to send
    // it is still the acquirer's decision: it just has to be a deliberate one, and it is
    // recorded on the row so it survives a log rotation.
    if (doc.documentType === 'offer_letter') {
      const storedOfferPrice = (doc.documentData as any)?._raw?.offerPrice;
      if (!isOfferPriceSupportable(storedOfferPrice)) {
        if (!doc.unsupportedPriceAcknowledgedAt) {
          console.warn(
            `[DEAL_DOCS] Send blocked for document ${documentId}: stored offer price ${String(storedOfferPrice)} is not supportable and has not been acknowledged`,
          );
          throw new BadRequestError(
            'No offer supportable. This offer letter has no verifiable price above zero. Confirm explicitly that you want to send it, or regenerate it from the deal model.',
```

The server-side send check tests a STORED value: the offer price frozen in `deal_documents.document_data._raw.offerPrice`. It does not recompute the model when sending.

#541 RULE: surfaces (a) and (b) test live recomputed prices, while surface (c) tests the stored document-payload price. They test different values whenever the live model calculation has changed since the document payload was generated.

## 2. RUN BOTH PREDICATES ON REAL PROD, SIDE BY SIDE

Schema correction: the stored computed offer-price column is `deal_models.total_purchase_price`, found at `shared/schema/deal-models.ts:37`:

```text
  totalPurchasePrice: decimal("total_purchase_price"),
```

`deal_models.target_offer_price` is an input used when `offer_driver = 'target_price'`; it is not the general stored computed offer price. The earlier real-production verification section that treated `target_offer_price` as the stored computed price used the wrong column.

Predicate A is `deal_models.total_purchase_price <= 0`.

Predicate B calls the shipped `dealModelService.calculateOnly` method for each model. That method calls `fetchReportedEbitdaByYear`, `buildCalcInputs`, and the shared `calculateFullDealModel` path used by the screen; Predicate B is `CalculationResult.offerPrice <= 0`.

Verbatim result:

```text
{
  "measuredAt": "2026-09-15T16:15:04.751Z",
  "totalModels": 124,
  "predicateA": {
    "models": 28,
    "distinctCompanies": 25
  },
  "predicateB": {
    "models": 25,
    "distinctCompanies": 22
  },
  "disagreements": 11,
  "disagreementRows": [
    {
      "id": 61,
      "targetCompanyId": 89,
      "stored": -771213.5,
      "computed": 419332,
      "predicateA": true,
      "predicateB": false
    },
    {
      "id": 54,
      "targetCompanyId": 71,
      "stored": -365082.1666666665,
      "computed": 9139249.5,
      "predicateA": true,
      "predicateB": false
    },
    {
      "id": 138,
      "targetCompanyId": 89,
      "stored": -1762,
      "computed": 294702,
      "predicateA": true,
      "predicateB": false
    },
    {
      "id": 74,
      "targetCompanyId": 94,
      "stored": 52901.5,
      "computed": -360113.5,
      "predicateA": false,
      "predicateB": true
    },
    {
      "id": 73,
      "targetCompanyId": 128,
      "stored": 6833,
      "computed": -1709467,
      "predicateA": false,
      "predicateB": true
    },
    {
      "id": 117,
      "targetCompanyId": 103,
      "stored": 695250,
      "computed": -1508993,
      "predicateA": false,
      "predicateB": true
    },
    {
      "id": 75,
      "targetCompanyId": 133,
      "stored": -62188,
      "computed": 28981.333333333343,
      "predicateA": true,
      "predicateB": false
    },
    {
      "id": 80,
      "targetCompanyId": 88,
      "stored": -83039.39200000004,
      "computed": 532552.5219999999,
      "predicateA": true,
      "predicateB": false
    },
    {
      "id": 99,
      "targetCompanyId": 162,
      "stored": -6986.880000000005,
      "computed": 254268,
      "predicateA": true,
      "predicateB": false
    },
    {
      "id": 58,
      "targetCompanyId": 103,
      "stored": 695250,
      "computed": -1508993,
      "predicateA": false,
      "predicateB": true
    },
    {
      "id": 87,
      "targetCompanyId": 150,
      "stored": -98197.26249999998,
      "computed": 70857.75,
      "predicateA": true,
      "predicateB": false
    }
  ]
}
```

At `2026-09-15T16:15:04.751Z`, production contained 124 models.

- Predicate A, stored: 28 models across 25 distinct companies.
- Predicate B, computed through the shipped calculation path: 25 models across 22 distinct companies.
- A and B disagree on 11 models.

## 3. RECONCILE TO #534

Predicate A reproduces #534's recorded 28 models at or below zero across 25 companies exactly.

Predicate B does not reproduce #534: it returns 25 models across 22 companies.

This comparison does not assert which database #534 used.

## 4. THE WRONG HOST, RECORDED NOT CHASED

YES — `.replit` declares `javascript_database:1.0.0` in the agent integrations list, so the configuration says a managed database integration is available to this workspace. This statement confirms only what the config declares; no connection was made and credential validity or actual reachability was not tested.

# POST-DEPLOY V-CHECK

## 1. THE DEPLOY ITSELF

Deployment metadata:

```text
success: true
isDeployed: true
primaryUrl: https://app.valoxi.ai
deploymentType: autoscale
hasSuccessfulBuild: true
visibility: public
```

Serving check:

```text
HTTP/2 200
content-type: text/html; charset=UTF-8
server: Google Frontend
x-powered-by: Express
```

Startup log:

```text
[2026-09-16T10:59:23.295Z INFO] forwarding local port 5000 to external port 80 (mapped as 1104)
[2026-09-16T10:59:23.295Z INFO] starting up user application
[2026-09-16T10:59:23.295Z INFO] no runnable or static artifact routes available; falling back to the deployment run command in .replit
[2026-09-16T10:59:25.113Z INFO] > NODE_ENV=production node dist/index.js
[2026-09-16T10:59:25.113Z INFO] > rest-express@1.0.0 start
[2026-09-16T10:59:29.884Z INFO] 10:59:29 AM [express] serving on port 5000
```

The deployment is serving.

RUNNING COMMIT: NOT CONFIRMABLE. The deployment metadata does not expose a commit SHA, and the deployed app and startup log contain no commit marker. No commit was guessed from workspace HEAD.

DEPLOYED NODE VERSION: NOT CONFIRMABLE. The deployed process logs `node dist/index.js` but does not print `process.version`, and the deployed app exposes no runtime/version endpoint. Therefore this check cannot confirm 22.x or exclude 20.x.

## 2. NODE 22 SMOKE ON THE DEPLOYMENT

The real PDF and Word routes are mounted behind authenticated middleware:

```text
app.use('/api/v2/deal-documents', isAuthenticated, validateCsrfToken, requireActiveSubscription, dealDocumentRoutes);
```

The unauthenticated public PDF route was not used because it calls `markViewed(documentId)`, which would write production data and violate this task's read-only constraint.

The first generation smoke used an existing production document ID obtained read-only through explicit `PROD_DATABASE_URL`, then requested the authenticated real PDF route without a session.

Verbatim failure with cookie credentials masked:

```text
DOCUMENT_ID: 5
HTTP/2 401
content-length: 26
content-type: application/json; charset=utf-8
server: Google Frontend
set-cookie: __Host-sid=[REDACTED]
set-cookie: GAESA=[REDACTED]
x-clerk-auth-reason: session-token-and-uat-missing
x-clerk-auth-status: signed-out
x-powered-by: Express

{"message":"Unauthorized"}
```

PDF SMOKE: FAILED BEFORE GENERATION — HTTP 401 Unauthorized. No `%PDF-` header or byte count was produced.

STOP — per the instruction to stop if any generation smoke fails, the Word and spreadsheet smoke tests were not attempted, and sections 3–5 were not run.

One startup-log observation is recorded despite the stop because it was encountered while checking the deployed runtime: `gemini-client` printed an API-key prefix twice. The value is redacted here:

```text
[2026-09-16T10:59:35.741Z INFO] [GEMINI_CLIENT] API call — key: [REDACTED] host: generativelanguage.googleapis.com service: document_classification model: gemini-3-flash-preview
[2026-09-16T10:59:35.746Z INFO] [GEMINI_CLIENT] API call — key: [REDACTED] host: generativelanguage.googleapis.com service: document_classification model: gemini-3-flash-preview
```

#539 CONFIRMATION: `gemini-client` did print an API-key prefix in production logs.

# POST-DEPLOY V-CHECK — RESUMED SECTIONS 3 TO 6

No generation smoke test was retried. Every production database query below ran with explicit `PROD_DATABASE_URL`, never the managed production connection.

## 3. THE GUARD IS LIVE AND OVERWROTE NOTHING

```text
          measured_at          | total_models | nonpositive_models | distinct_companies 
-------------------------------+--------------+--------------------+--------------------
 2026-09-16 11:09:25.840511+00 |          125 |                 28 |                 25
(1 row)
```

The stored predicate is unchanged at 28 models across 25 distinct companies. #531's expected non-overwrite state holds. Total model count increased from 124 to 125, which meets the expectation of 124 or higher.

```text
SELECT count(*) FROM deal_documents WHERE unsupported_price_acknowledged_at IS NOT NULL;

 count 
-------
     0
(1 row)
```

```text
SELECT count(*) FROM deal_documents;

 count 
-------
    40
(1 row)
```

No unsupported-price acknowledgement has been written, and the deal-document count remains 40.

## 4. SHADOW STATE UNCHANGED BY THE RELEASE

```text
SELECT key, value FROM system_config WHERE key LIKE '%shadow%' OR key LIKE '%canonical%' ORDER BY key;

              key              | value 
-------------------------------+-------
 evidence_shadow_write_enabled | true
(1 row)
```

The release did not change the expected state: `evidence_shadow_write_enabled` remains `true`, and there is still no canonical row.

## 5. ERROR SWEEP SINCE THE DEPLOY

Sweep start:

```text
2026-09-16T10:59:23.295Z
```

Total deployment-log entries matching `error` since deploy:

```text
14
```

The 14 entries reduce to these two distinct error shapes. Representative lines are printed verbatim:

```text
[2026-09-16T10:59:23.298Z ERROR] healthcheck failed error=healthcheck /: Get "http://127.0.0.1:1104/": dial tcp 127.0.0.1:1104: connect: connection refused
[2026-09-16T10:59:23.301Z ERROR] healthcheck failed error=healthcheck / returned status 500
```

All 14 errors occurred during startup before this serving line:

```text
[2026-09-16T10:59:29.884Z INFO] 10:59:29 AM [express] serving on port 5000
```

No later error entry was returned by the sweep.

Number of times `gemini-client` printed the API key or its prefix since deploy:

```text
2
```

Verbatim log-line shape, secret masked:

```text
[2026-09-16T10:59:35.741Z INFO] [GEMINI_CLIENT] API call — key: [REDACTED] host: generativelanguage.googleapis.com service: document_classification model: gemini-3-flash-preview
[2026-09-16T10:59:35.746Z INFO] [GEMINI_CLIENT] API call — key: [REDACTED] host: generativelanguage.googleapis.com service: document_classification model: gemini-3-flash-preview
```

#539 is confirmed in production: the deployed `gemini-client` logged an API-key prefix twice.

## 6. WHAT IS ACTUALLY RUNNING

The running commit and deployed Node version remain unconfirmable because deployment metadata, deployment logs, and the application expose neither value.

No explicit health or version route exists in the server code. Common-path probes all returned the Valoxi SPA HTML fallback rather than health or version data:

```text
=== /health ===
HTTP 200
CONTENT_TYPE text/html; charset=UTF-8
<title>Valoxi</title>

=== /api/health ===
HTTP 200
CONTENT_TYPE text/html; charset=UTF-8
<title>Valoxi</title>

=== /api/v2/health ===
HTTP 200
CONTENT_TYPE text/html; charset=UTF-8
<title>Valoxi</title>

=== /version ===
HTTP 200
CONTENT_TYPE text/html; charset=UTF-8
<title>Valoxi</title>

=== /api/version ===
HTTP 200
CONTENT_TYPE text/html; charset=UTF-8
<title>Valoxi</title>

=== /api/v2/version ===
HTTP 200
CONTENT_TYPE text/html; charset=UTF-8
<title>Valoxi</title>
```

The app exposes no actual health or version endpoint.