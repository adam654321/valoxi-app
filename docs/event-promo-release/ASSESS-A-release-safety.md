# ASSESS-A release safety

## STEP 1 — BASELINE

```text
$ git status --porcelain

$ git log --oneline -5
afa3786 (HEAD -> main, gitsafe-backup/main) Add unit tests for offer guard call sites
3816d6f Implement deal model service updates
4d165c6 Implement document processing logic in routes and service
5d08a53 Implement deal model logic and add offer guard tests
5dde23b Update agent metadata and add pipeline fidelity identity documentation

$ npm run check 2>&1 | tail -30

> rest-express@1.0.0 check
> tsc

server/services/portal.service.ts(81,14): error TS2353: Object literal may only specify known properties, and 'token' does not exist in type '{ id: number; createdAt: Date | null; userCompanyId: number; isActive: boolean | null; expiresAt: Date | null; createdBy: number; targetCompanyId: number; lastAccessed: Date | null; ... 16 more ...; escalationLevel: string | null; }'.
```

## STEP 2 — THE RELEASE PAYLOAD

```text
$ git log --oneline --since="45 days ago" | wc -l
112

$ git log --pretty=format:"%h %ad %s" --date=short --since="45 days ago"
afa3786 2026-09-10 Add unit tests for offer guard call sites
3816d6f 2026-09-10 Implement deal model service updates
4d165c6 2026-09-10 Implement document processing logic in routes and service
5d08a53 2026-09-09 Implement deal model logic and add offer guard tests
5dde23b 2026-09-08 Update agent metadata and add pipeline fidelity identity documentation
b434879 2026-09-08 Document tier precedence sizing logic for pipeline fidelity fix
5476ec1 2026-09-08 Add documentation on D3 exposure sizing for pipeline fidelity fix
bdc184d 2026-09-08 Add pipeline fidelity assessment documentation part two
a7d9f5e 2026-08-26 Add D3 readonly assessment script
e606955 2026-08-26 Update audit conflict report script and documentation
e27faab 2026-08-26 Update backfill application documentation for pipeline fidelity fix
6e6ee14 2026-08-26 Add documentation for c1 backfill apply and rollback procedures
0ee592d 2026-08-25 Add documentation and script for C1 paper read CVC pipeline fidelity fix
803b853 2026-08-25 Add preapply documentation for pipeline fidelity fix
1b0d159 2026-08-25 Add pre-apply check script
53484b5 2026-08-25 Update agent metadata and add pipeline fidelity backfill logs
2907f30 2026-08-25 Update agent metadata and add pipeline fidelity research notes
68ec4e7 2026-08-24 Update agent metadata and add pipeline fidelity assessment documentation
aa33ede 2026-08-24 Refactor financial data service logic
9fcfce1 2026-08-24 Update replit documentation
057602f 2026-08-21 Implement evidence mapper casting logic and add tests
8e588bd 2026-08-20 Implement new financial data processing logic
419a0c6 2026-08-20 Update audit conflict report documentation and script
51c9ad7 2026-08-20 Update audit conflict report documentation and script
e8f6ede 2026-08-19 Update audit report for pipeline fidelity conflict
38bffba 2026-08-19 Add audit conflict report documentation for pipeline fidelity fix
d3bd1b1 2026-08-16 Remove obsolete audit comparison file
f21edde 2026-08-16 Add lookup table audit script
0d75824 2026-08-16 AUDIT-1: Phase 2 prioritised worklist
3e39b60 2026-08-15 AUDIT-1: Phase 1 cross-document GROUP A comparison
22d3395 2026-08-15 Add audit comparison report for pipeline fidelity fix
2debcf6 2026-08-15 AUDIT-1: fresh in-memory extraction capture, 24 documents, companies 1877/1880/1881
06867b2 2026-08-15 Add audit script for R2 check
755dafa 2026-08-10 Add script for primary versus comparative analysis
3d79f73 2026-08-09 Add bleed calibration script
83239ae 2026-08-09 Add utility scripts for verification and comparison tasks
8918cfa 2026-08-09 1c-RESTORE-C: restore prompts to tested VARIANT C configuration
b6aaf8f 2026-08-09 Update pipeline documentation and refine step 2 prompts
35f5d38 2026-08-09 ANCHOR-TEST: isolate cause of FY2023 depreciation regression
5417ebe 2026-08-08 STABILITY-1: extraction stability measurement
6de644a 2026-08-08 Append tier 2 rerun log to pipeline fidelity documentation
79c14f0 2026-08-08 1c.4: tier 2 re-run and evidence diff
19696ab 2026-08-08 1c.3: tier 1 classification stability run
d7444d2 2026-08-08 1c.2b-B: step 2 prompt extension, PROMPT_VERSION 1c
ad97228 2026-08-08 Update profit and loss prompt configuration
f749081 2026-08-07 Update evidence mapper logic and add corresponding tests
13296a3 2026-08-07 Update evidence mapper logic and expand test coverage
5924543 2026-08-07 Implement evidence anchor mapping logic and add supporting tests
0924725 2026-08-07 Add 1c.2b assessment report
90c5186 2026-08-07 Refactor evidence mapping logic and add test coverage
771f32e 2026-08-06 Update evidence baseline and expand diff analysis script
a637384 2026-08-06 Add evidence file and script for pipeline fidelity testing.
df4e3db 2026-08-06 Implement evidence version diff calculator logic and tests
e269d66 2026-08-06 Update canonical repository implementation
b73d0bd 2026-08-05 Add pipeline fidelity fix diff report
3e044b8 2026-08-05 Update canonical diff script and add fidelity report
4c17be9 2026-08-05 Update canonical vs live diff script logic
a7a3726 2026-08-05 Published your App
78f1fe9 2026-08-05 Add pipeline fidelity diff report
e94fdb5 2026-08-04 Update diff-canonical-vs-live script logic
a0076d1 2026-08-04 Add logic to diff canonical versus live script
eb942c2 2026-08-04 Expand diff-canonical-vs-live script functionality
5f8c3be 2026-08-04 Update diff-canonical-vs-live script logic
2dd07a5 2026-08-04 Refactor diff-canonical-vs-live script logic
1552e1b 2026-08-04 Update diff-canonical-vs-live script logic
21058fc 2026-08-04 Add script to diff canonical versus live data
45ce98f 2026-08-04 Implement canonical live map calculator and tests
8083e1f 2026-08-03 Implement canonical repository updates and add backfill development script
60eedf0 2026-08-03 Implement canonical repository and update file analysis service
c837f9e 2026-08-03 Implement canonical input calculator logic and tests
5530f5d 2026-08-03 Published your App
926fbee 2026-08-03 Add tests for canonical resolver
5d96d49 2026-08-03 Refactor canonical resolver logic
8166710 2026-08-03 Implement canonical resolver calculator utility
afd0f1b 2026-08-03 Add new database migration and update schema definitions
3a5c54b 2026-08-03 Slice 3a.2: canonical schema redo with explicit short foreign key names
923caea 2026-08-03 Slice 3a.1: canonical schema, four tables, no reads no writes
bdee4c0 2026-08-03 Add initial migration snapshot and journal entry
91e7260 2026-08-03 Published your App
6e9e272 2026-08-03 Update evidence mapper implementation and tests
ed9e429 2026-08-03 Expand evidence mapper functionality and add cast utility tests
59e862e 2026-08-02 Update evidence schema and mapper to support new field
76a74ee 2026-08-02 Published your App
59c0d8a 2026-08-02 Correct #339 premise: remove company_accounts from backfill scope, rewrite spec 2.7
fddab7b 2026-08-01 Update dev evidence backfill script
b68510d 2026-08-01 Update evidence mapper logic and add corresponding tests
f5d7f94 2026-08-01 Update evidence mapper logic and add corresponding tests
ce8e520 2026-08-01 Published your App
414d998 2026-08-01 Update pipeline fidelity plan and specification documents
edc2eb0 2026-08-01 Implement company deletion evidence logic and add unit tests
6999380 2026-08-01 Update backfill evidence script for development
74cc3ca 2026-07-31 Add script for dev environment evidence backfill
05d8ceb 2026-07-31 Update pipeline fidelity removal documentation
203c08a 2026-07-31 Update documentation for pipeline fidelity fix
fb5db30 2026-07-31 Remove obsolete baseline migration file
11b8cb2 2026-07-31 Consolidate migration archives and add baseline migration file
42260b7 2026-07-31 Published your App
ab57a38 2026-07-30 Remove automatic db:push from post-merge hook (SS3-H1)
e23e52c 2026-07-30 Add cascading delete migration and tests for evidence schema
2b06b38 2026-07-30 Implement evidence storage repository and validation utilities
3254d5d 2026-07-30 Track migration SQL in git (was collateral of the *.sql ignore rule)
7d30e97 2026-07-30 Add evidence schema definition and export it
a10ff32 2026-07-30 Add documentation for pipeline fidelity fix
fefc19c 2026-07-30 Published your App
bc518b5 2026-07-30 Update document management component logic
0aceb7f 2026-07-30 Add audit test harness
d9e5e42 2026-07-29 Published your App
f6ca8c9 2026-07-28 Update checkout route and promo code service logic
3872778 2026-07-28 Published your App
02be8f3 2026-07-28 Refine the stage two valuation expert prompt
05f69e7 2026-07-28 Published your App
61b45a9 2026-07-28 Update deal modeller logic and document generation services

$ cat .replit
modules = ["nodejs-20", "web", "python-3.11", "postgresql-16"]
run = "npm run dev"
hidden = [".config", ".git", "generated-icon.png", "node_modules", "dist"]

[nix]
channel = "stable-24_05"
packages = ["chromium", "glib", "nss", "xorg.libX11", "xorg.libXcomposite", "xorg.libXdamage", "xorg.libXext", "xorg.libXrandr", "xorg.libxcb", "at-spi2-atk", "cups", "libdrm", "mesa", "pango", "cairo", "alsa-lib", "dbus", "expat", "nspr", "gtk3", "libxkbcommon"]

[deployment]
deploymentTarget = "autoscale"
build = ["npm", "run", "build"]
run = ["npm", "run", "start"]

[[ports]]
localPort = 5000
externalPort = 80

[[ports]]
localPort = 5555
externalPort = 3000

[[ports]]
localPort = 5556
externalPort = 3001

[[ports]]
localPort = 5557
externalPort = 3002

[[ports]]
localPort = 5558
externalPort = 4200

[[ports]]
localPort = 5559
externalPort = 3003

[[ports]]
localPort = 5560
externalPort = 5000

[[ports]]
localPort = 5561
externalPort = 5173

[[ports]]
localPort = 5904
externalPort = 6000

[env]
PORT = "5000"

[workflows]
runButton = "Project"

[[workflows.workflow]]
name = "Project"
mode = "parallel"
author = "agent"

[[workflows.workflow.tasks]]
task = "workflow.run"
args = "Start application"

[[workflows.workflow]]
name = "Start application"
author = "agent"

[workflows.workflow.metadata]
outputType = "webview"

[[workflows.workflow.tasks]]
task = "shell.exec"
args = "trap '' HUP && npm run dev"
waitForPort = 5000

[agent]
integrations = ["javascript_log_in_with_replit:1.0.0", "javascript_object_storage:1.0.0", "javascript_database:1.0.0", "javascript_gemini_ai_integrations:2.0.0"]

[userenv]

[userenv.shared]
BETA_MODE = "true"
VITE_BETA_MODE = "true"
BETA_FEEDBACK_BUCKET_ID = "replit-objstore-c09af028-225c-4fd7-b187-f15a3b723b24"
NYLAS_CONNECT_GMAIL_VISIBLE = "true"
NYLAS_CONNECT_OUTLOOK_VISIBLE = "false"

[userenv.development]

[objectStorage]
defaultBucketID = "replit-objstore-8c9b222f-19d6-4a20-806e-46d09c1d9424"

[postMerge]
path = "scripts/post-merge.sh"
timeoutMs = 120000
```

The repository records several `Published your App` commits; the latest is `a7a3726` on 2026-08-05, but the commit message does not identify the deployment target.

## STEP 3 — SCHEMA DRIFT, DEV VERSUS PROD

```text
$ psql "$DATABASE_URL" -At -c "SELECT table_name || ' ' || md5(string_agg(column_name || ':' || data_type, ',' ORDER BY ordinal_position)) FROM information_schema.columns WHERE table_schema='public' GROUP BY table_name ORDER BY table_name;"
activities ead4e92677f1f594483ef142c1ca5c16
activity_summary 6be01c633a8afc48b7bbb80a3065a8ff
activity_types 1649f59949a964cf548103367a04c2a0
addon_purchases ad5fea384ba7fa28bab3c95323e6b3b7
aged_debtors 9975784a717d9cab91d10f326c2c76cf
balance_sheets 04db41decc1320030724c0d5ac1b78b8
beta_feedback 6204ecab1dceed0b47216341a9d67a89
broadcasts_sent 289a2e8ba2b8ee33a112bab1c867bb6f
canonical_figure ddc7b9eee93799940efc339f78ad9c43
canonical_gap 06e58355cc814e439c6e06ddce4b534b
canonical_period 2bfc5c27cd0e1b134dfb4b49a262a4bb
canonical_run b2f128d3994d64deb13fc29a81873db7
chase_up_emails 59b19b43e10d6f0c14b9919ef99408c7
chase_up_schedules 160f4292cc59f60d40eb68bd45f09cf4
company_document_requirements 79af8c50390ca7f62acbf7d2efbb497d
current_offers 84e2a33b9d29c10226442886e95bd6c6
dashboard_alerts aee0ca717158b368ca2d78cbdaeff509
dashboard_preferences 9b1ac243165b5bea5993335c6c6ec770
dd_categories b1f33dd3038dc06acaeddd77f6013591
dd_requirement_documents c73f2505e0a0a307fd98b59e12c0b045
dd_requirement_status 87c35e7681caff991bca3fee3a9c0292
dd_requirements efda40aa2278399c1a49c966f7526b8e
deal_document_responses ce873b9ef5a20fe3445db34d70f10f6b
deal_document_templates 0426aea7b7aeda0114c1f074f2f362d6
deal_documents 67da37abd183c5e6445daf4725f8e00c
deal_metrics_snapshots bbb282a7726c8bbabc6bee1dfa465bf0
deal_model_adjustments b61d54befd1c6ff271ed89ae796d51c2
deal_model_contingent_consideration 27e81cd8c5d5387fe5285a37442dba05
deal_model_funding_lines 1ad192f82b7dfaa9ba8e25fc3acae1cb
deal_model_seller_payments 69dfd241c4e9676098e8590cb199c381
deal_models 00a872a4b820058b2d9b4db9f1aa4f0a
deal_notes c6c7cfee95c01cadaa9da788738d8c52
deal_progression 9868418c4f2f8f55b290e973770e782c
document_access_log 1588aeb27a95f9781b48ebed44b1b203
document_analysis_results 9e3d7cf8ee08927d6333ddf1c1e2fa93
document_categories 4c16a8bc9738c0c6ad64a37f34f5afa9
document_evidence 17e06137ed5769b2232a14f7898eb3d9
document_evidence_figure d5d5850025a35c7356ac388f3b3a8977
document_evidence_period 21a144fde93da022914d2499d28d787b
document_stage_progression 1a5f9407d2ccd809191130c046c4df69
documents 12fcfe554b983addcb140fb31e0e82e9
ebitda_adjustments 977e9c6b473a9ac05723f9bb9a23d5e4
expert_analysis_results a2a145853b25dcbedd93cee65036ef47
external_document_submissions c1f9c36cc03781fb21004a2e3b7c21cf
file_upload_events c7010b397a4d304e3a402a10d19ad1e3
financial_contributions 3f546aa031d8a1c9133cd1b6f19581b7
financial_periods 83da3c41ffe0649d2b7be054835610ca
fixed_assets_register 68956df20d7fc8b543a4a5f730bdeb28
funnel_events c304c1d9b467fc2dff83dce106566757
income_statements 40142b64ecf36df28f182efe272592bf
issue_reports aec2d6bd8724dc2df87d9b6dfe53acc0
loan_facilities af93d49341cc5504d992f0723d3c936e
magic_links dbe3c2b4fdbe3716923058cfb9dc8556
marketing_consent_tokens 6bf0a384f2d930048b9952a89069fa3f
marketing_unsubscribes c2de0152aa43488821650a73a56e67ee
nylas_grants 59c9ec436082efd389b0c1d6e4882bdb
password_reset_tokens c044393370e387301b84d8576f1efc1e
pipeline_stages 526f479c1b772216ea64382cf5d075f6
pipeline_summary 496373a1fb47366c786cde9ecc348955
platform_costs 6df4f0a601c51156e3551ceff78c5f64
portal_access_tokens bbf2e5dfaac773841f62d2b8ecf8bb86
portal_activity_log 630f9c0dfa8e3e89a8935d5c2d2cb763
portal_analytics 521a8cf197186f7ab57e07b462db6b8d
portal_communications_log 43276dcf56fc33cab39147977ff8c025
portal_document_requirements 1ccfafbf774f2d4955a34118d1714bc5
portal_email_templates aed266f698b4925aa7c91e4e6adab68f
portal_link_campaigns 39b2a3752c1aa6fbe8a411dcfc70e5c8
portal_link_shares 50dcf1b7b75335f309f7bb9925b82951
promo_code_campaigns 23181b3ecdd0dcdb1e41655f894cf6c4
referral_invoice_records f35a5b754e0d1daaa88e96cea6faee8e
resend_rate_limits 90b8a6fd7b398a4461857a06ff548d81
session f5fbbdad74f3a44fd60889802b64caa8
staff_data 38d4731e2a0bfe6b7cdab96c6de87ca4
stage1_analysis_events 1cc9b70c7fbe540b8e89577a4728cc02
stage_1_progress 381a057a7930ff1f611b66e98725f267
stage_history 0e549dacc379b6f9cc52cc2a9d4275fa
subscription_events 58ba9b4014cc3b795552a272bcdc3ca6
subscriptions d7321af7b179f599dfba5e2e866cbf7b
system_config 34f03dfdd57892af0fe914e4520b4602
target_companies 1cfbf24036c29bf4745dc308270ff7cb
target_contacts 49bf414d4a182c721467c2ac4174575c
team_notifications 54ed8946fa50833cf775e2bff695e882
token_usage ae4c6dbab17696006c01c429fd0475b7
user_acceptances 467dc54d957430732940aad16309971a
user_companies 42c39845926e7f6dc8f5f4be1f331918
user_company_memberships aba4fbce439722c4d6b7b097091317e5
user_deal_assignments 23a65099c5505efbdb9599754d83d741
user_invitations 9613484ffd2e6f866b4419f3f74434a8
user_roles 3e942f39f9351be38f3f1b7f0fc98e7e
user_sessions ad519a7c2dc1ca5b4637f2e8def165aa
users a21ae7b2cc80ef005da034faa0d2fcdd
valuations cc0599785daf2ecaf5954df0619546a9
value_creation_assumptions df3df840cb17007fdbb2c40512626f7c
value_creation_exit_assumptions cdf6789196e2086fbd65160757fa3832
value_creation_scenarios f29e1c374543cac687a392c349dd5ef2
value_creation_synergies fc37545889ffb90a6a7192db54a28c12
waitlist bebc13e0613174ee0b2871c177ad4722
webhook_events ac1ab996627774806da0bff16f25afa4

$ production inspection-only schema query
Encountered an error executing SQL command: exitCode=2 exitReason=exit stderr=psql: error: connection to server at "ep-wandering-sunset-anbtkuyn.c-6.us-east-1.aws.neon.tech" (100.51.95.243), port 5432 failed: ERROR:  password authentication failed for user 'neondb_owner'

$ wc -l /home/runner/dev-schema.txt /home/runner/prod-schema.txt
NOT RUN: the requested fingerprint files were not created because the production inspection query returned no result.

$ diff /home/runner/dev-schema.txt /home/runner/prod-schema.txt || true
NOT RUN: production fingerprint unavailable.
```

Production schema inspection failed before returning data. Schema drift and the requested per-table column comparisons cannot be established from this assessment; no per-table queries were run.

## STEP 4 — NULL PRICE CONSUMERS IN THE CLIENT

```text
$ rg -l "totalPurchasePrice|enterpriseValue" client/src --glob "*.ts*" | sort
client/src/components/deal-modeller/ValuationSection.tsx
client/src/components/target-company/ValueCreationModeller.tsx

$ rg -c "totalPurchasePrice|enterpriseValue" client/src --glob "*.ts*" | sort -t: -k2 -nr
client/src/components/target-company/ValueCreationModeller.tsx:2
client/src/components/deal-modeller/ValuationSection.tsx:1

$ rg -n -C4 "totalPurchasePrice|enterpriseValue" client/src/components/deal-modeller/ValuationSection.tsx | head -40
276-  const multipleLow = toNum(model.multipleLow) || getExpertValue(snapshot, 'multipleLow') || null;
277-  const multipleHigh = toNum(model.multipleHigh) || getExpertValue(snapshot, 'multipleHigh') || null;
278-  const hasRange = multipleLow !== null && multipleHigh !== null && multipleLow < multipleHigh;
279-
280:  const ev = localCalcs?.enterpriseValue ?? 0;
281-  const offerPrice = localCalcs?.offerPrice ?? 0;
282-  const avgEbitda = localCalcs?.averageAdjustedEbitda ?? 0;
283-  const receivablesInterestAnnual = localCalcs?.receivablesInterestAnnual ?? 0;
284-  const valuationEbitda = localCalcs?.valuationEbitda ?? avgEbitda;

$ rg -n -C4 "totalPurchasePrice|enterpriseValue" client/src/components/target-company/ValueCreationModeller.tsx | head -40
321-    }
322-  }, [selectedModelId]);
323-
324-  const entryMultiple = toNum(modelDetails?.ebitdaMultiple);
325:  const entryEV = toNum(modelDetails?.enterpriseValue);
326-  const totalDebt = fundingLineInputs
327-    .filter(f => f.isDebt && f.isActive)
328-    .reduce((sum, f) => sum + f.amountUsed, 0);
329-
--
334-  }, [fundingLineInputs]);
335-
336-  const totalFees = useMemo(() => {
337-    if (!modelDetails) return 0;
338:    const offerPrice = toNum(modelDetails.totalPurchasePrice) || toNum(modelDetails.enterpriseValue);
339-    if (offerPrice <= 0) return 0;
340-    return toNum(modelDetails.feeLegalDdAmount)
341-         + toNum(modelDetails.feeAccountingDdAmount)
342-         + toNum(modelDetails.feeLoanArrangementAmount)
```

- `client/src/components/deal-modeller/ValuationSection.tsx`: `enterpriseValue` has an optional-chain and `?? 0` fallback before use; no listed coercion, formatting call, or arithmetic on the unguarded value appears in the matched code.
- `client/src/components/target-company/ValueCreationModeller.tsx`: both fields are passed to `toNum`; no direct listed coercion, formatting call, or arithmetic on either unguarded field appears in the matched code.

## STEP 5 — PHASE C-NEW APPLIED STATE

```text
$ ls client/src/pages/welcome.tsx
ls: cannot access 'client/src/pages/welcome.tsx': No such file or directory

$ rg -n "welcome" client/src/App.tsx | head -20

$ rg -n "'/signup'|\"/signup\"" server/routes/public-signup.routes.ts
rg: server/routes/public-signup.routes.ts: IO error for operation on server/routes/public-signup.routes.ts: No such file or directory (os error 2)

$ rg -n "promo/:slug|resolveCampaignBySlug" server --glob "*.ts" | head -20
server/services/promo-code.service.ts:39:  async resolveCampaignBySlug(slug: string): Promise<PromoCodeCampaign | null> {
server/routes/public-checkout.routes.ts:60:  // Resolve the promo campaign, if one was supplied. resolveCampaignBySlug
server/routes/public-checkout.routes.ts:64:    campaign = await promoCodeService.resolveCampaignBySlug(promoSlug);
server/routes/billing.routes.ts:212:              const campaign = await promoCodeService.resolveCampaignBySlug(promoSlug);

$ rg -n "createFiveDNewMemberTrial|createTrialSubscription" server client/src --glob "*.ts*"
server/services/billing.service.ts
86:  async createTrialSubscription(
117:  async createFiveDNewMemberTrial(userCompanyId: number): Promise<Subscription> {

$ rg -n "verify-session" server/routes/billing.routes.ts | head -20
815:router.post('/verify-session', isAuthenticated, validateCsrfToken, requirePermission('canManageCompany'), async (req: Request, res: Response) => {

$ rg -n "activateSubscription" server --glob "*.ts" | head -20
server/routes/billing.routes.ts:117:          await billingService.activateSubscription(userCompanyId, {
server/routes/billing.routes.ts:202:              await billingService.activateSubscription(existingUser.userCompanyId, activationData);
server/routes/billing.routes.ts:278:            await billingService.activateSubscription(newUserCompanyId, activationData);
server/routes/billing.routes.ts:285:            // created, and activateSubscription's idempotency guard no-ops a
server/routes/billing.routes.ts:856:        await billingService.activateSubscription(userCompanyId, {
server/routes/billing.routes.ts:890:      await billingService.activateSubscription(userCompanyId, {
server/routes/billing.routes.ts:1042:      // so activateSubscription has the customerId available via the subscription row.
server/services/billing.service.ts:149:  async activateSubscription(

$ rg -n "openAccessEnabled" server client/src --glob "*.ts*" | head -20
client/src/pages/admin/settings.tsx:27:  const openAccessEnabled = configs.find((c) => c.key === "open_access_enabled")?.value === "true";
client/src/pages/admin/settings.tsx:206:            <Card className={`transition-all ${openAccessEnabled ? "border-amber-400/40" : ""}`}>
client/src/pages/admin/settings.tsx:210:                    <div className={`p-2 rounded-lg ${openAccessEnabled ? "bg-amber-500/10" : "bg-muted"}`}>
client/src/pages/admin/settings.tsx:211:                      <Unlock className={`h-5 w-5 ${openAccessEnabled ? "text-amber-500" : "text-muted-foreground"}`} />
client/src/pages/admin/settings.tsx:216:                        {openAccessEnabled && (
client/src/pages/admin/settings.tsx:226:                    checked={openAccessEnabled}
client/src/hooks/useServerConfig.ts:8:  openAccessEnabled: boolean;
client/src/hooks/useServerConfig.ts:25:    openAccessEnabled: data?.openAccessEnabled ?? false,
server/routes/public.routes.ts:21:      openAccessEnabled: openAccess,
```

Still present: `resolveCampaignBySlug`, `createTrialSubscription`, `createFiveDNewMemberTrial`, `/verify-session`, `activateSubscription`, and `openAccessEnabled`. Not present at the requested paths: `welcome.tsx`, a `welcome` match in `App.tsx`, and `public-signup.routes.ts`.

## STEP 6 — WRITE THE OUTPUT TO THE REPO

```text
$ wc -l docs/event-promo-release/ASSESS-A-release-safety.md
451 docs/event-promo-release/ASSESS-A-release-safety.md

$ git status --porcelain
?? docs/event-promo-release/

$ git diff --stat

$ npm run check 2>&1 | tail -20

> rest-express@1.0.0 check
> tsc

server/services/portal.service.ts(81,14): error TS2353: Object literal may only specify known properties, and 'token' does not exist in type '{ id: number; createdAt: Date | null; userCompanyId: number; isActive: boolean | null; expiresAt: Date | null; createdBy: number; targetCompanyId: number; lastAccessed: Date | null; ... 16 more ...; escalationLevel: string | null; }'.
```

V-CHECK — git status: PASS (only the new report directory is untracked).

V-CHECK — git diff --stat: PASS (no tracked source-file changes).

V-CHECK — npm run check: PASS (exactly one TypeScript error, at `server/services/portal.service.ts:81`).