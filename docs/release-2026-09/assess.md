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

# READ-ONLY P1 ASSESSMENT — THOR-CON DOCUMENT 68

Assessment performed on 17 September 2026. Production reads used explicit `DATABASE_URL="$PROD_DATABASE_URL"` only. No document was regenerated or sent, and no data or code was changed.

## Finding

The screen and offer-letter paths call the same `calculateFullDealModel` arithmetic, but they do **not** supply the same reported EBITDA input.

- The screen prefers `analysis_data.yearly_metrics` from a successful financial expert result.
- The offer-letter builder calls `fetchReportedEbitdaByYear()`, which reads reconciled income rows and excludes `information_memorandum` periods.
- Thor-CON's populated full-year income rows are all `information_memorandum`. Its statutory contribution records do not have corresponding populated statutory income-statement rows.
- The document calculator therefore received an empty `reportedEbitdaByYear`, produced average adjusted EBITDA `0`, then deducted £3,000 annual invoice-finance interest to produce valuation EBITDA `-£3,000`.

This is an input-path defect, not an arithmetic defect. The two paths share the final calculator but reach it through different source-selection code.

## 1. THE TWO PATHS, SIDE BY SIDE

### Deal model screen

Verbatim, `client/src/components/target-company/DealModeller.tsx`:

```ts
  const reportedEbitdaByYear = useMemo<Record<string, number>>(() => {
    if (financialExpertMetrics) {
      const expertPeriods = financialsFromExpert?.periods ?? [];
      const result: Record<string, number> = {};
      for (const [year, m] of Object.entries(financialExpertMetrics)) {
        const period = expertPeriods.find((p: any) => String(p.fiscalYear) === year);
        if (period && isPartYearPeriod(period)) continue;
        const ebitda = (m as any).ebitda;
        if (ebitda != null) result[year] = Number(ebitda);
      }
      return result;
    }
    if (!financialsRaw?.periods || !financialsRaw?.incomeStatements) return {};
    const result: Record<string, number> = {};
    const candidatePeriods = financialsRaw.periods
      .filter((period: any) => period.periodType === 'statutory' && period.fiscalYear && !isPartYearPeriod(period))
      .sort((a: any, b: any) => {
        const aInc = financialsRaw.incomeStatements.find((i: any) => i.financialPeriodId === a.id);
        const bInc = financialsRaw.incomeStatements.find((i: any) => i.financialPeriodId === b.id);
        const aOp = aInc?.operatingProfit != null ? 1 : 0;
        const bOp = bInc?.operatingProfit != null ? 1 : 0;
        if (bOp !== aOp) return bOp - aOp;
        return new Date(b.periodEnd).getTime() - new Date(a.periodEnd).getTime();
      });
    for (const period of candidatePeriods) {
      const year = String(period.fiscalYear);
      if (year in result) continue;
      const income = financialsRaw.incomeStatements.find((i: any) => i.financialPeriodId === period.id);
      if (!income) continue;
      const op = toNum(income.operatingProfit);
      const da = toNum(income.depreciationAmortisation);
      result[year] = op + da;
    }
    return result;
  }, [financialsRaw, financialExpertMetrics, financialsFromExpert]);

  const calculations = useMemo<CalculationResult | null>(() => {
    if (!modelDetails) return null;

    const adjustments: AdjustmentInput[] = (modelDetails.adjustments || []).map(a => ({
      adjustmentType: a.adjustmentType as 'add_back' | 'deduction',
      amount: a.amount,
      amountsByYear: a.amountsByYear as Record<string, number> | null,
      status: a.status || 'suggested',
      userOverrideAmount: null,
    }));

    const fundingLines: FundingLineInput[] = (modelDetails.fundingLines || [])
      .filter(f => f.fundingType !== 'seller_financing' && f.fundingType !== 'earnout')
      .map(f => ({
      fundingType: f.fundingType,
      assetBaseValue: f.assetBaseValue,
      ltvPercent: f.ltvPercent,
      amountUsed: f.amountUsed,
      interestRate: f.interestRate,
      termMonths: f.termMonths,
      arrangementFeePercent: null,
      isDebt: f.isDebt ?? false,
      isActive: f.isActive ?? false,
    }));

    return calculateFullDealModel(reportedEbitdaByYear, adjustments, fundingLines, modelInput, modelDetails.sellerPayments || [], modelDetails.contingentConsideration || []);
  }, [modelDetails, reportedEbitdaByYear]);
```

The rendered valuation EBITDA is selected verbatim in `client/src/components/deal-modeller/ValuationSection.tsx`:

```ts
  const ev = localCalcs?.enterpriseValue ?? 0;
  const offerPrice = localCalcs?.offerPrice ?? 0;
  const avgEbitda = localCalcs?.averageAdjustedEbitda ?? 0;
  const receivablesInterestAnnual = localCalcs?.receivablesInterestAnnual ?? 0;
  const valuationEbitda = localCalcs?.valuationEbitda ?? avgEbitda;
```

### Offer-letter document

Verbatim, `server/services/deal-document.service.ts`:

```ts
    // Use the same full-year-only helper the screen uses — no more dual implementations.
    const [reportedEbitdaByYear, contributionTiers] = await Promise.all([
      fetchReportedEbitdaByYear(targetCompanyId),
      db.select({ sourceTier: financialContributions.sourceTier })
        .from(financialContributions)
        .where(eq(financialContributions.targetCompanyId, targetCompanyId)),
    ]);
    const provisionalFinancials = isProvisionalFinancials(contributionTiers);

    const { calculateFullDealModel, assessOfferSupportability } = await import('@shared/calculators/deal-model.calc');

    const modelInput = {
      averagingYears: model.averagingYears || 3,
      ebitdaMultiple: model.ebitdaMultiple || '3.0',
      plusExcessCash: model.plusExcessCash || '0',
      minusPrimaryDebt: model.minusPrimaryDebt || '0',
      minusOtherDebt: model.minusOtherDebt || '0',
      minusCorpTaxDue: model.minusCorpTaxDue || '0',
      minusWorkingCapitalAdj: model.minusWorkingCapitalAdj || '0',
      plusPropertyValue: model.propertyValue || '0',
      feeLegalDdAmount: model.feeLegalDdAmount ?? '0',
      feeAccountingDdAmount: model.feeAccountingDdAmount ?? '0',
      feeLoanArrangementAmount: model.feeLoanArrangementAmount ?? '0',
      feeDealMakerAmount: model.feeDealMakerAmount ?? '0',
      customFees: (model.customFees as Array<{ label: string; amount: string | number }>) ?? [],
      offerDriver: model.offerDriver ?? 'ebitda',
      targetOfferPrice: model.targetOfferPrice ?? null,
    };

    let calculations: any = {};
    try {
      calculations = calculateFullDealModel(
        reportedEbitdaByYear,
        adjustmentInputs,
        fundingLineInputs,
        modelInput,
        sellerPaymentInputs,
        contingentConsiderationInputs
      );
    } catch (err) {
      console.error('[DEAL_DOCS] Calculator error:', err);
    }
```

The document path does call `calculateFullDealModel`. It does not call `dealModelService.calculateOnly`. Despite the comment saying it uses the same helper as the screen, the client screen does not use `fetchReportedEbitdaByYear`; it first uses expert-result JSON.

## 2. WHERE THE VALUE IS LOST

### Screen input hop

Verbatim:

```ts
  const financialExpertMetrics = useMemo<Record<string, any> | null>(() => {
    if (!expertResults) return null;
    const financialExpert = expertResults.find((r: any) => r.expertType === 'financial' && r.status === 'success');
    if (!financialExpert?.analysisData) return null;
    const data = typeof financialExpert.analysisData === 'string'
      ? JSON.parse(financialExpert.analysisData)
      : financialExpert.analysisData;
    return data?.yearly_metrics || null;
  }, [expertResults]);
```

Then:

```ts
        const ebitda = (m as any).ebitda;
        if (ebitda != null) result[year] = Number(ebitda);
```

Then:

```ts
    return calculateFullDealModel(reportedEbitdaByYear, adjustments, fundingLines, modelInput, modelDetails.sellerPayments || [], modelDetails.contingentConsideration || []);
```

Then the shared calculator:

```ts
  const { adjustedEbitdaByYear, averageAdjustedEbitda } = calculateAdjustedEbitda(
    reportedEbitdaByYear,
    adjustments,
    model.averagingYears
  );

  const receivablesInterestAnnual = fundingLines
    .filter((l) => l.isActive && l.fundingType === 'receivables_finance')
    .reduce((sum, l) => sum + toNum(l.amountUsed) * toNum(l.interestRate) / 100, 0);
  const valuationEbitda = averageAdjustedEbitda - receivablesInterestAnnual;
```

### Document input hop

Verbatim:

```ts
export async function fetchReportedEbitdaByYear(targetCompanyId: number): Promise<Record<string, number>> {
  const reconciled = await getReconciledFinancials(targetCompanyId);
  const result: Record<string, number> = {};
  for (const [year, row] of Object.entries(reconciled.incomeByYear)) {
    result[year] = row.ebitda;
  }
  return result;
}
```

The reconciliation query is verbatim:

```ts
    .where(
      and(
        eq(incomeStatements.targetCompanyId, companyId),
        eq(incomeStatements.isFullYear, true),
        or(
          isNull(financialPeriods.sourceTier),
          ne(financialPeriods.sourceTier, 'information_memorandum'),
        ),
        lte(financialPeriods.periodEnd, today),
        lte(financialPeriods.fiscalYear, currentYear),
      ),
    )
```

Thor-CON production evidence:

```text
fiscal_year | period_type | period_end | period_is_full_year | source_tier             | income_is_full_year | operating_profit | depreciation_amortisation | raw_ebitda
2021        | management  | 2021-03-31 | t                   | information_memorandum  | t                   | -2200            | 25307                     | 23107
2022        | management  | 2022-03-31 | t                   | information_memorandum  | t                   | 126779           | 10960                     | 137739
2023        | management  | 2023-03-31 | t                   | information_memorandum  | t                   | 172769           | 10824                     | 183593
2024        | management  | 2024-03-31 | t                   | information_memorandum  | t                   | 77287            | 51911                     | 129198
2025        | statutory   | 2025-03-31 | t                   | statutory               | NULL                | NULL              | NULL                      | 0
2026        | management  | 2026-07-16 | f                   | management              | f                   | 183004.63         | NULL                      | 183004.63
```

Every populated full-year row is excluded because its period source tier is `information_memorandum`. The statutory 2025 period has no income statement. The 2026 income row is not full-year. The document's `reportedEbitdaByYear` is therefore empty.

The successful expert result does contain EBITDA:

```text
expert_result_id | fiscal_year | ebitda
2738             | 2021        | 23107
2738             | 2022        | 137741
2738             | 2023        | 183593
2738             | 2024        | 129198
2738             | 2025        | 278404
```

The shared calculator turns empty years into zero verbatim:

```ts
  const sortedYearsDesc = Object.keys(adjustedEbitdaByYear).sort().reverse();
  const clampedN = Math.max(1, Math.min(averagingYears, sortedYearsDesc.length));
  const recentYears = sortedYearsDesc.slice(0, clampedN);

  const sum = recentYears.reduce((acc, y) => acc + adjustedEbitdaByYear[y], 0);
  const averageAdjustedEbitda = recentYears.length > 0 ? sum / recentYears.length : 0;
```

The document then applies these fallbacks verbatim:

```ts
    const offerPrice = calculations.offerPrice || 0;
    const enterpriseValue = calculations.enterpriseValue || 0;
```

```ts
    const ifCostForValuation = calculations.receivablesInterestAnnual || 0;
    const valuationEbitdaForDoc = calculations.valuationEbitda || calculations.averageAdjustedEbitda || 0;
```

```ts
        averageEbitda: calculations.averageAdjustedEbitda || 0,
        ebitdaMultiple: Number(model.ebitdaMultiple) || 0,
```

The £104,172 is lost before rendering, when the document path substitutes the empty reconciled-income result for the expert EBITDA source used on screen.

### Swallowed calculator failure

The #516 try/catch is verbatim:

```ts
    let calculations: any = {};
    try {
      calculations = calculateFullDealModel(
        reportedEbitdaByYear,
        adjustmentInputs,
        fundingLineInputs,
        modelInput,
        sellerPaymentInputs,
        contingentConsiderationInputs
      );
    } catch (err) {
      console.error('[DEAL_DOCS] Calculator error:', err);
    }
```

If the calculator throws, the document receives `{}` and the `|| 0` fallbacks turn missing EBITDA, enterprise value, and offer price into zero-derived figures. The exception is logged server-side but is not surfaced to the user. The supportability code after the catch warns but does not refuse document generation.

For document 68, the evidence indicates an empty input rather than a thrown exception: its output is internally consistent with average EBITDA `0`, invoice-finance interest `£3,000`, and valuation EBITDA `-£3,000`.

## 3. THE STORED RECORD FOR DOCUMENT 68

Requested production fields, verbatim:

```text
id                          | 68
target_company_id           | 228
deal_model_id               | 147
document_type               | offer_letter
status                      | draft
created_at                  | 2026-09-17 11:31:19.676026
sent_at                     |
generated_file_url          | generated-documents/doc-1789644680650-387717326.docx
requested_financial_payload | {
                            |     "_raw": {
                            |         "otherDebt": 0,
                            |         "corpTaxDue": 0,
                            |         "excessCash": 150000,
                            |         "offerPrice": 21062,
                            |         "primaryDebt": 15000,
                            |         "averageEbitda": 0,
                            |         "dayOnePayment": -45931,
                            |         "deferredTerms": "Payable over 36 months post-completion",
                            |         "earnoutMetric": "",
                            |         "propertyValue": 0,
                            |         "deferredAmount": 36993,
                            |         "earnoutMaximum": 30000,
                            |         "ebitdaMultiple": 2.3,
                            |         "enterpriseValue": -6899.999999999999,
                            |         "transactionType": "share_sale",
                            |         "earnoutTermMonths": 24,
                            |         "workingCapitalAdj": 107038,
                            |         "deferredInstalment": "£1,028 per month over 36 months",
                            |         "deferredTermMonths": 36,
                            |         "transactionTypeLabel": "Share Sale"
                            |     },
                            |     "otherDebt": 0,
                            |     "corpTaxDue": 0,
                            |     "excessCash": "£150,000",
                            |     "offerPrice": "£21,062",
                            |     "primaryDebt": 15000,
                            |     "breakdownText": "Valuation EBITDA: -£3,000\nEnterprise Value (Valuation EBITDA × 2.30 multiple): -£6,900\nPlus Excess Cash: £150,000\nLess Primary Debt: (£15,000)\nLess Working Capital Adjustment: (£107,038)\n\nTotal Offer Price: £21,062",
                            |     "dayOnePayment": "-£45,931",
                            |     "deferredTotal": "£36,993",
                            |     "averagingYears": 3,
                            |     "ebitdaMultiple": 2.3,
                            |     "enterpriseValue": "-£6,900",
                            |     "workingCapitalAdj": 107038
                            | }
```

The stored payload does **not** contain `104172`. The loss happened at build time, not render time.

The expected stored-model comparison in the brief is contradicted by current production:

```text
model_id | calculated_ebitda | adjusted_ebitda | enterprise_value   | total_purchase_price
147      | 0                 | 0               | -6899.999999999999 | 21062
150      | 0                 | 0               | -6899.999999999999 | 21062
181      | 0                 | 0               | -6899.999999999999 | 21062
```

Document 68's linked model 147 does not currently store £260,658; it stores £21,062, matching the document. All three Thor-CON model versions currently store the same wrong zero-EBITDA result. Their `updated_at` values are between `2026-09-17 11:31:07.979` and `11:31:13.764`, immediately before document 68 was created at `11:31:19.676026`.

The £260,658 screen figure was a live client recomputation from expert metrics, not the model's current stored `total_purchase_price`.

## 4. BLAST RADIUS

Disagreement count first:

```text
0 sent/accepted generated documents with comparable stored offer prices disagree with their linked model's current total_purchase_price.
```

Timestamped counts:

```text
measured_at                    | all_docs_since_aug5 | generated_since_aug5 | offer_letters_generated_since_aug5
2026-09-17 11:41:40.399185+00 | 4                   | 4                    | 2
```

```text
measured_at                    | all_docs_since_deploy | generated_since_deploy | offer_letters_generated_since_deploy
2026-09-17 11:41:40.880051+00 | 4                     | 4                      | 2
```

Deploy threshold used:

```text
2026-09-16 10:59:23.295
```

All four generated documents since 5 August were also generated after the 16 September deploy.

Three are currently `sent` or `accepted`; one is an offer letter:

```text
id | document_type  | status   | company | created_at                 | sent_at                    | deal_model_id | document_offer_price | model_total_purchase_price | comparison
65 | nda            | accepted | TestCo1 | 2026-09-16 12:37:17.845711 | 2026-09-16 12:37:19.071 | NULL          | NULL                 | NULL                       | no price
66 | offer_letter   | accepted | TestCo1 | 2026-09-16 12:37:50.267193 | 2026-09-16 12:37:51.676 | 180           | 2157527.8499999996   | 2157527.8499999996         | MATCH
67 | heads_of_terms | accepted | TestCo1 | 2026-09-16 12:45:51.886859 | 2026-09-16 12:45:53.362 | 180           | 2157527.8499999996   | 2157527.8499999996         | MATCH
```

Commercial answer: the known wrong Thor-CON offer letter, document 68, is `draft`, has no `sent_at`, and has not reached a seller through the platform. The only sent/accepted offer letter in the requested period is document 66, whose stored offer price matches its linked model. This comparison checks price agreement only; it does not independently prove document 66's EBITDA input was correct.

## 5. IS THIS NEW?

Relevant commits after `a7a3726`:

```text
905ccb7 2026-09-15T11:51:49Z Update deal modeller component logic
6ec3e82 2026-09-15T11:13:31Z Update deal document route handlers
c9a7079 2026-09-15T10:26:00Z Add input fields to valuation section
7660fde 2026-09-14T20:36:54Z Add offer guard test cases and update deal document service logic
6226023 2026-09-14T20:30:52Z Refactor deal document service and update related test coverage
5fdd5f2 2026-09-14T14:08:49Z Update offer guard call sites and deal model service logic
4f6299b 2026-09-11T16:01:13Z Fix all reported dependency vulnerabilities
3816d6f 2026-09-10T01:34:43Z Implement deal model service updates
4d165c6 2026-09-10T00:21:57Z Implement document processing logic in routes and service
5d08a53 2026-09-09T09:36:19Z Implement deal model logic and add offer guard tests
```

The relevant diff from `a7a3726..HEAD` is 250 insertions and 4 deletions across five files. The first 150 lines requested by the assessment are principally the new unsupported-price warning and send guard; the material verbatim document-builder diff is:

```diff
diff --git a/server/services/deal-document.service.ts b/server/services/deal-document.service.ts
index 631a554..b81057a 100644
--- a/server/services/deal-document.service.ts
+++ b/server/services/deal-document.service.ts
@@ -7,6 +7,7 @@ import { financialPeriods, incomeStatements, financialContributions } from '@sha
 import { isProvisionalFinancials } from '../../shared/utils/provisional-financials';
 import { eq, and, desc, not, inArray, sql } from 'drizzle-orm';
 import { fetchReportedEbitdaByYear } from './deal-model.service';
+import { isOfferPriceSupportable } from '@shared/calculators/deal-model.calc';
 import { dealDocumentTemplateService, DocumentDataContext } from './deal-document-template.service';
 import { extendPortalTokenForCompany } from './portal-token.service';
 import { buildNdaHtml } from '../utils/document-html-builders'
@@ -801,7 +830,7 @@ export class DealDocumentService {
     ]);
     const provisionalFinancials = isProvisionalFinancials(contributionTiers);
 
-    const { calculateFullDealModel } = await import('@shared/calculators/deal-model.calc');
+    const { calculateFullDealModel, assessOfferSupportability } = await import('@shared/calculators/deal-model.calc');
 
     const modelInput = {
       averagingYears: model.averagingYears || 3,
@@ -868,6 +897,25 @@ export class DealDocumentService {
       console.error('[DEAL_DOCS] Calculator error:', err);
     }
 
+    // Commercial guards #296 and #324, at the compute boundary.
+    // Deliberately OUTSIDE the try/catch above: that catch swallows calculator errors and
+    // leaves calculations empty, so a guard placed inside it would fail OPEN. An absent
+    // offerPrice, which is exactly the swallowed-error case, is not supportable and is
+    // blocked here as well.
+    const supportability = assessOfferSupportability(
+      reportedEbitdaByYear,
+      calculations.offerPrice,
+    );
+    if (!supportability.supportable) {
+      // Warn, do not refuse. Building the document is the acquirer's decision and the
+      // figures shown are the real computed ones. The gate is at the send boundary,
+      // where the document would leave for the seller, and it is derived there from the
+      // stored _raw.offerPrice rather than from a flag written here.
+      console.warn(
+        `[DEAL_DOCS] Unsupported offer for company ${targetCompanyId}, deal model ${dealModelId}: ${supportability.reason}. Document built as computed.`,
+      );
+    }
+
     const fmt = (val: any) => {
       const num = Number(val) || 0;
       return new Intl.NumberFormat('en-GB', {
```

The `fetchReportedEbitdaByYear(targetCompanyId)` document path predates `a7a3726`. Git history identifies its introduction:

```text
314c438 2026-07-17T02:52:41Z Improve EBITDA calculation accuracy and consistency across the platform
```

`a7a3726` itself is:

```text
a7a3726ee41de06da144126ceae0cbf66e4c2bb3
2026-08-05T09:34:38Z
Published your App
```

Its document builder already called `fetchReportedEbitdaByYear`, called `calculateFullDealModel`, swallowed calculator exceptions, and applied `|| 0` fallbacks.

Direct answer: it cannot be established that a letter generated on 5 August would have carried the correct EBITDA. The defect-enabling split already existed by that date: document generation used reconciled income rows, while client display could use expert-result JSON. Correctness depended on the company's underlying row eligibility and the deployed commit at the exact generation time. The code cannot support a stronger claim.

# READ-ONLY EXPOSURE ASSESSMENT — EXPERT JSON VERSUS DOCUMENT ELIGIBILITY

Assessment performed on 17 September 2026. Production reads used explicit `DATABASE_URL="$PROD_DATABASE_URL"` only. The shared TypeScript `calculateFullDealModel` implementation was used for the screen-price comparison. No data, documents, or code were changed.

## 1. HOW MANY COMPANIES ARE IN THOR-CON'S POSITION

Counts first:

```text
measured_at                    | companies_with_models | zero_eligible_companies | zero_eligible_with_populated_excluded_rows
2026-09-17 11:48:38.722694+00 | 97                    | 6                       | 4
```

The eligibility predicate was copied from the document path's `getReconciledFinancials` query:

```sql
i.is_full_year = true
AND (fp.source_tier IS NULL OR fp.source_tier <> 'information_memorandum')
AND fp.period_end <= CURRENT_DATE
AND fp.fiscal_year <= EXTRACT(YEAR FROM CURRENT_DATE)
```

Company IDs with a deal model and zero valuation-eligible income years:

```text
97
103
106
128
225
228
```

Of those six companies, four have populated full-year income rows that are excluded:

```text
company_id | excluded_tag            | populated_full_year_rows
97         | information_memorandum  | 4
128        | information_memorandum  | 6
225        | information_memorandum  | 4
228        | information_memorandum  | 4
```

Tag distribution:

```text
excluded_tag            | populated_full_year_rows | companies
information_memorandum  | 18                       | 4
```

Thor-CON, company 228, is one of four companies with populated full-year income data excluded solely under the `information_memorandum` tag rule.

## 2. STORED VERSUS EXPERT-JSON PRICE, ACROSS ALL MODELS

Timestamp and counts:

```text
measured_at: 2026-09-17T11:48:42.066Z
total deal models: 127
agree: 51
disagree: 76
stored price NULL: 0
models using latest successful financial-expert JSON: 127
models using raw-data fallback: 0
```

Agreement was tested to half-penny tolerance: `abs(screen_price - stored_price) < 0.005`.

The screen reproduction followed the shipped path:

1. Newest successful financial expert result per company, matching `getExpertResults()` ordering by `created_at DESC` and the client's first matching financial result.
2. `analysis_data.yearly_metrics[year].ebitda`, excluding part-year periods using the client helper.
3. Each model's actual adjustments, active funding lines, seller payments, contingent consideration, bridge inputs, fees, offer driver, and target price.
4. The shared `calculateFullDealModel`.

Top 30 disagreements by absolute difference:

```text
model | company | stored price          | screen price          | screen - stored
54    | 71      | -365082.1666666665    | 11827045.333333332    | 12192127.499999998
130   | 218     | 21662159.333333336    | 10309448.833333334    | -11352710.500000002
134   | 218     | 21662159.333333336    | 10309448.833333334    | -11352710.500000002
55    | 71      | 762720.5              | 12042879.833333332    | 11280159.333333332
42    | 70      | 5471544.266666666     | 1874819.5999999999    | -3596724.666666666
97    | 76      | 6795340.199999999     | 9891485.2             | 3096145
131   | 218     | 11677366.583333332    | 10052695              | -1624671.583333332
49    | 77      | -185146.09999999963   | 1149996.4000000004    | 1335142.5
50    | 77      | -185146.09999999963   | 1149996.4000000004    | 1335142.5
61    | 89      | -771213.5             | 419332                | 1190545.5
58    | 103     | 695250                | 1795967               | 1100717
117   | 103     | 695250                | 1795967               | 1100717
75    | 133     | -62188                | 765916                | 828104
140   | 220     | 10316251.566666666    | 11110014.9            | 793763.333333334
139   | 197     | -166308.3             | 510568                | 676876.3
51    | 78      | 410595.5999999996     | 1050690.6             | 640095.0000000005
38    | 67      | -1032787.456          | -403752.80000000005   | 629034.656
88    | 151     | 89435.66666666667     | 632759                | 543323.3333333334
105   | 190     | 458926.66666666674    | 975571.6666666667     | 516645
151   | 230     | 473409.9153750001     | 977619.1203749999     | 504209.20499999984
84    | 137     | 151518.15000000002    | 563513.6125           | 411995.4625
80    | 88      | -83039.39200000004    | 293998.3319999999     | 377037.72399999993
104   | 172     | 518483.93333333335    | 860899.3333333333     | 342415.3999999999
120   | 172     | 523239.7666666666     | 860899.3333333333     | 337659.56666666665
138   | 89      | -1762                 | 294702                | 296464
164   | 242     | 856767.3333333334     | 1151410.1666666667    | 294642.8333333334
56    | 100     | -300905.7             | -30549                | 270356.7
128   | 216     | 140552.8333333333     | 409132                | 268579.1666666667
99    | 162     | -6986.880000000005    | 254268                | 261254.88
107   | 190     | 836258                | 1080245               | 243987
```

This is materially larger than the prior same-source comparison: 76 of 127 models disagree when stored prices are compared with the current expert-JSON screen path.

## 3. THE ACCEPTED LETTER

The “one accepted offer letter” in the post-deploy exposure window is document 66:

```text
document id: 66
company id: 271
linked model id: 180
document stored offer price: 2157527.8499999996
linked model total_purchase_price: 2157527.8499999996
current expert-JSON screen price: 2157527.8499999996
screen - stored difference: 0
document-eligible income years: 5
eligible fiscal years: 2020, 2021, 2022, 2023, 2024
eligibility measured_at: 2026-09-17 11:48:54.058299+00
```

The number sent to the seller was built for a company that has valuation-eligible income years under the document predicate. Its document price, linked-model price, and current expert-JSON screen price all agree.

This answer is scoped to the one accepted offer letter in the previously established post-deploy window. Production contains older accepted offer letters outside that window.

## 4. WHERE #296 SHOULD HAVE FIRED

### #296 guard as shipped in v82

The hard #296 guard was shipped in `DealModelService.createModel`. Verbatim:

```ts
  async createModel(
    targetCompanyId: number,
    createdBy: number,
    userCompanyId: number,
    modelName?: string
  ): Promise<DealModelWithDetails & { calculations: CalculationResult }> {
    await verifyOwnership(targetCompanyId, userCompanyId);

    // Commercial guard #296. No deal model without at least one valuation-eligible year.
    // Checked before createDealModelFromExperts, which otherwise inserts a model row,
    // seeds adjustments and creates funding lines for a company that cannot be valued.
    const eligibilityCheck = await fetchReportedEbitdaByYear(targetCompanyId);
    if (!hasValuationEligibleYear(eligibilityCheck)) {
      console.warn(
        `[DEAL_MODEL] Creation blocked for company ${targetCompanyId}: no valuation-eligible year`,
      );
      throw new BadRequestError(
        'No valuation-eligible year. At least one completed full year of non-IM financial data is required before a deal model can be created.',
      );
    }

    const model = await dealModelMappingService.createDealModelFromExperts(
      targetCompanyId,
      createdBy,
      userCompanyId,
      modelName
    );
```

The predicate it calls is verbatim:

```ts
export function hasValuationEligibleYear(
  reportedEbitdaByYear: Record<string, number> | null | undefined,
): boolean {
  if (!reportedEbitdaByYear) return false;
  return Object.keys(reportedEbitdaByYear).length > 0;
}
```

### Document-generation call path

Verbatim, capped below 60 lines:

```ts
  async createOfflineOfferFromDealModel(params: {
    targetCompanyId: number;
    userCompanyId: number;
    dealModelId: number;
    createdBy: number;
  }) {
    const doc = await this.createDocument({
      targetCompanyId: params.targetCompanyId,
      userCompanyId: params.userCompanyId,
      documentType: 'offer_letter',
      createdBy: params.createdBy,
      dealModelId: params.dealModelId,
    });

    const offerData = await this.buildOfferDataContext(
      params.dealModelId,
      params.targetCompanyId,
      params.userCompanyId,
      params.createdBy
    );

    await this.generateDocumentFile(doc.id, offerData);

    return doc;
  }

  private async buildOfferDataContext(
    dealModelId: number,
    targetCompanyId: number,
    userCompanyId: number,
    createdBy: number
  ): Promise<Record<string, any>> {
    const baseContext = await dealDocumentTemplateService.buildDataContext(
      targetCompanyId, userCompanyId, createdBy, dealModelId
    );

    const [reportedEbitdaByYear, contributionTiers] = await Promise.all([
      fetchReportedEbitdaByYear(targetCompanyId),
      db.select({ sourceTier: financialContributions.sourceTier })
        .from(financialContributions)
        .where(eq(financialContributions.targetCompanyId, targetCompanyId)),
    ]);

    const { calculateFullDealModel, assessOfferSupportability } = await import('@shared/calculators/deal-model.calc');

    let calculations: any = {};
    try {
      calculations = calculateFullDealModel(
        reportedEbitdaByYear,
        adjustmentInputs,
        fundingLineInputs,
        modelInput,
        sellerPaymentInputs,
        contingentConsiderationInputs
      );
    } catch (err) {
      console.error('[DEAL_DOCS] Calculator error:', err);
    }
```

Direct answer: **no**, the shipped hard #296 guard in `DealModelService.createModel` is not on the document-generation path. Document generation does not call `createModel`.

Current `buildOfferDataContext` calls `assessOfferSupportability` after calculation, but its failure branch only logs a warning and continues building the document. It is not a guard.

To catch this case for both portal and offline offer generation, the hard eligibility check would have to be enforced in `buildOfferDataContext` immediately after `fetchReportedEbitdaByYear` and before `calculateFullDealModel`. If the requirement is also to avoid creating an orphan draft document row, the same validation must occur before `createDocument` in both `createOfferFromDealModel` and `createOfflineOfferFromDealModel`.