# ASSESS H — Release readiness

```text
rg -l "canonical" client/src --glob "*.ts*" | sort

rg -n "canonicalFigure|canonical_figure|canonicalRun|canonical_run" client/src --glob "*.ts*" | head -30

rg -l "document_evidence|documentEvidence" client/src --glob "*.ts*" | sort

rg -n "shadow|SHADOW_WRITE|shadowWrite|CANONICAL_ENABLED|canonicalEnabled" server client/src --glob "*.ts*" | head -40
client/src/pages/billing.tsx:650:                    className={`relative flex flex-col ${plan.popular ? "border-primary shadow-md" : ""} ${isCurrent ? "bg-muted/30" : ""}`}
client/src/pages/reports.tsx:63:    <div className="bg-card text-card-foreground border border-border rounded-lg shadow-md px-3 py-2 text-sm">
client/src/pages/company-accounts.tsx:282:                <Card key={company.id} className="hover:shadow-md transition-shadow">
client/src/pages/help/HelpHome.tsx:77:          <div className="absolute top-full left-0 right-0 mt-2 bg-popover border border-border rounded-xl shadow-2xl overflow-hidden z-50">
client/src/pages/contacts.tsx:395:                      <Card key={contact.id} className="hover:shadow-md transition-shadow">
client/src/pages/contacts.tsx:496:                      <Card key={contact.id} className="hover:shadow-md transition-shadow">
client/src/pages/contacts.tsx:594:                      <Card key={contact.id} className="hover:shadow-md transition-shadow">
client/src/pages/dashboard.tsx:113:            <Card className="cursor-pointer hover:shadow-md transition-shadow">
client/src/pages/dashboard.tsx:132:            <Card className="cursor-pointer hover:shadow-md transition-shadow">
client/src/pages/dashboard.tsx:151:            <Card className="cursor-pointer hover:shadow-md transition-shadow">
client/src/pages/dashboard.tsx:170:            <Card className="cursor-pointer hover:shadow-md transition-shadow">
client/src/pages/target-company-detail.tsx:1017:                            <Card key={contact.id} className="hover:shadow-sm transition-shadow">
client/src/pages/target-companies.tsx:223:      <nav className="bg-card shadow-sm border-b border-border">
client/src/pages/target-companies.tsx:319:                className="hover:shadow-lg transition-shadow cursor-pointer" 
server/repositories/evidence.repository.ts:11:const FLAG_KEY = 'evidence_shadow_write_enabled';
server/services/file-analysis.service.ts:331:              console.error('[FILE_ANALYSIS] evidence shadow write failed (non-fatal):', evidenceErr);
server/services/file-analysis.service.ts:340:                  `[FILE_ANALYSIS] canonical shadow write: run ${canonicalResult.runId}, ` +
server/services/file-analysis.service.ts:346:              console.error('[FILE_ANALYSIS] canonical shadow write failed (non-fatal):', canonicalErr);
server/repositories/canonical.repository.ts:25:const FLAG_KEY = 'canonical_shadow_write_enabled';
server/repositories/canonical.repository.ts:26:const EVIDENCE_FLAG_KEY = 'evidence_shadow_write_enabled';
server/repositories/canonical.repository.ts:155:   * Resolves one company's evidence into a canonical run. Slice 3c, shadow mode.
client/src/components/document-management.tsx:1180:                      <Card key={document.id} className="hover:shadow-sm transition-shadow">
client/src/components/portal/HoTReview.tsx:201:            <div className="border rounded-lg p-6 bg-white text-gray-900 shadow-sm">
client/src/components/portal/OfferReview.tsx:193:            <div className="border rounded-lg p-6 bg-white text-gray-900 shadow-sm">
client/src/components/analysis/ExpertAnalysisDashboard.tsx:159:            ? "cursor-pointer hover:shadow-md hover:border-primary/50"
client/src/components/analysis/ExpertAnalysisDashboard.tsx:161:              ? "border-blue-400 shadow-sm"
client/src/components/analysis/ExpertAnalysisDashboard.tsx:425:            className={`transition-all ${dataQuality?.status === "success" && dataQuality?.analysisData ? "cursor-pointer hover:shadow-md hover:border-primary/50" : ""}`}
client/src/components/analysis/ExpertAnalysisDashboard.tsx:466:            className={`transition-all ${screening?.status === "success" && screening?.analysisData ? "cursor-pointer hover:shadow-md hover:border-primary/50" : ""}`}
client/src/components/billing/UpgradePrompt.tsx:40:        <Card className="w-full max-w-md border border-border shadow-2xl dark:shadow-black/60 bg-background backdrop-blur-sm">
client/src/components/target-companies/company-card.tsx:40:      className="hover:shadow-lg transition-shadow cursor-pointer"
client/src/components/portal/NdaAgreement.tsx:236:                className="max-h-[60vh] overflow-y-auto bg-white rounded-lg shadow-sm"
client/src/components/analysis/ExpertReportViews.tsx:2855:            <button className="inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground px-8 py-3 text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm">
client/src/components/error-boundary.tsx:31:          <div className="bg-card rounded-lg shadow-lg max-w-md w-full p-8 text-center">
client/src/components/error-boundary.tsx:49:                className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors"
client/src/components/error-boundary.tsx:55:                className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground transition-colors"
client/src/components/deal-modeller/ViabilitySection.tsx:385:                      className="absolute top-[-2px] bottom-[-2px] w-1 bg-slate-900 dark:bg-white rounded-full shadow-sm"
client/src/components/deal-modeller/ViabilitySection.tsx:517:                    className="absolute top-[-2px] bottom-[-2px] w-1 bg-slate-900 dark:bg-white rounded-full shadow-sm"
client/src/components/target-company/DueDiligenceTab.tsx:243:              className={`flex-1 text-xs py-1.5 rounded transition-colors ${mode === 'upload' ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground'}`}
client/src/components/target-company/DueDiligenceTab.tsx:249:              className={`flex-1 text-xs py-1.5 rounded transition-colors ${mode === 'link' ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground'}`}
client/src/components/BetaFeedbackWidget.tsx:137:            className="fixed bottom-6 right-6 z-50 flex h-10 w-10 items-center justify-center rounded-full bg-orange-500 text-white shadow-lg transition-colors hover:bg-orange-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:bg-orange-600 dark:hover:bg-orange-700"

rg -n "FLAG_KEY|EVIDENCE_FLAG_KEY|isEnabled|enabled" server/repositories/evidence.repository.ts server/repositories/canonical.repository.ts | head -40
server/repositories/evidence.repository.ts:11:const FLAG_KEY = 'evidence_shadow_write_enabled';
server/repositories/evidence.repository.ts:32:    const flagValue = await systemConfigService.getConfig(FLAG_KEY);
server/repositories/canonical.repository.ts:25:const FLAG_KEY = 'canonical_shadow_write_enabled';
server/repositories/canonical.repository.ts:26:const EVIDENCE_FLAG_KEY = 'evidence_shadow_write_enabled';
server/repositories/canonical.repository.ts:162:    const flagValue = await systemConfigService.getConfig(FLAG_KEY);
server/repositories/canonical.repository.ts:166:    const evidenceFlagValue = await systemConfigService.getConfig(EVIDENCE_FLAG_KEY);

sed -n '1,40p' server/repositories/evidence.repository.ts
import { eq, and, sql } from 'drizzle-orm';
import { db } from '../db';
import {
  documentEvidence,
  documentEvidencePeriod,
  documentEvidenceFigure,
} from '@shared/schema';
import { mapPayloadToEvidence } from '@shared/utils/evidence-mapper';
import { systemConfigService } from '../services/system-config.service';

const FLAG_KEY = 'evidence_shadow_write_enabled';

interface WriteFromPayloadInput {
  targetCompanyId: number;
  documentId: number;
  documentAnalysisResultId: number | null;
  documentType: string;
  payload: Record<string, unknown>;
  /** Resolved Gemini model string, threaded from GeminiResponse.model. */
  model?: string;
  /** Prompt generation identifier from shared/prompt-version.ts. */
  promptVersion?: string;
}

type WriteFromPayloadResult =
  | { written: false; reason: 'flag_off' }
  | { written: true; evidenceId: number; periodCount: number; figureCount: number };

export class EvidenceRepository {
  async writeFromPayload(input: WriteFromPayloadInput): Promise<WriteFromPayloadResult> {
    // Step 1: check kill switch — no DB reads or writes if flag is off
    const flagValue = await systemConfigService.getConfig(FLAG_KEY);
    if (flagValue !== 'true') {
      return { written: false, reason: 'flag_off' };
    }

    // Step 2: compute next extraction_version for this (document_id, document_type)
    // The analysis queue serialises per company, so no transaction/retry needed.
    const [versionRow] = await db
      .select({

sed -n '150,189p' server/repositories/canonical.repository.ts
      output,
    };
  }

  /**
   * Resolves one company's evidence into a canonical run. Slice 3c, shadow mode.
   * Nothing reads what this writes.
   */
  async writeForCompany(input: WriteForCompanyInput): Promise<CanonicalWriteResult> {
    // Both kill switches, before any DB read or write. Canonical over a corpus
    // that has stopped being updated would be confidently stale, so the evidence
    // switch gates this one too.
    const flagValue = await systemConfigService.getConfig(FLAG_KEY);
    if (flagValue !== 'true') {
      return { written: false, reason: 'flag_off' };
    }
    const evidenceFlagValue = await systemConfigService.getConfig(EVIDENCE_FLAG_KEY);
    if (evidenceFlagValue !== 'true') {
      return { written: false, reason: 'evidence_flag_off' };
    }

    const prepared = await this.resolveForCompany(input);
    if (!prepared.resolved) {
      return { written: false, reason: prepared.reason };
    }
    const { asOfDate, output } = prepared;

    // One transaction for the whole run. A partially written run would carry a
    // fingerprint computed over rows that do not all exist, and the diff report
    // would read it as a complete statement of the company's history.
    let runId = 0;
    let figureCount = 0;
    await db.transaction(async (tx) => {
      const [runRow] = await tx
        .insert(canonicalRun)
        .values({
          targetCompanyId: output.run.targetCompanyId,
          resolverVersion: output.run.resolverVersion,
          asOfDate: output.run.asOfDate,
          inputFingerprint: output.run.inputFingerprint,

rg -n "processExtractedData" server --glob "*.ts" | head -20
server/services/financial-data.service.ts:46:  async processExtractedData(
server/routes/financial-data.routes.ts:375:      const normResult = await financialDataService.processExtractedData(
server/services/file-analysis.service.ts:350:              const normalizationResult = await financialDataService.processExtractedData(
server/services/__tests__/forward-path-gate.test.ts:4: * Each scenario feeds a frozen fixture through processExtractedData, triggers
server/services/__tests__/forward-path-gate.test.ts:132:    await financialDataService.processExtractedData(
server/services/__tests__/forward-path-gate.test.ts:171:    await financialDataService.processExtractedData(
server/services/__tests__/forward-path-gate.test.ts:211:    await financialDataService.processExtractedData('profit_and_loss', sc03, coId);
server/services/__tests__/forward-path-gate.test.ts:246:    await financialDataService.processExtractedData('profit_and_loss', sc04, coId);
server/services/__tests__/forward-path-gate.test.ts:266:    await financialDataService.processExtractedData(
server/services/__tests__/forward-path-gate.test.ts:297:    await financialDataService.processExtractedData('staff_matrix', sc06, coId);
server/services/__tests__/forward-path-gate.test.ts:327:    await financialDataService.processExtractedData(
server/services/__tests__/forward-path-gate.test.ts:351:    await financialDataService.processExtractedData('profit_and_loss', statFY2023, coId);
server/services/__tests__/forward-path-gate.test.ts:392:    await financialDataService.processExtractedData('profit_and_loss', sc08Full, coId);
server/services/__tests__/forward-path-gate.test.ts:393:    await financialDataService.processExtractedData('profit_and_loss', sc08Part, coId);
server/services/__tests__/forward-path-gate.test.ts:399:    await financialDataService.processExtractedData('profit_and_loss', sc08Part, coId);
server/services/__tests__/forward-path-gate.test.ts:400:    await financialDataService.processExtractedData('profit_and_loss', sc08Full, coId);
server/services/__tests__/forward-path-gate.test.ts:435:    await financialDataService.processExtractedData('profit_and_loss', sc09Mgmt, coId);
server/services/__tests__/forward-path-gate.test.ts:436:    await financialDataService.processExtractedData('profit_and_loss', sc09Stat, coId);
server/services/__tests__/forward-path-gate.test.ts:442:    await financialDataService.processExtractedData('profit_and_loss', sc09Stat, coId);
server/services/__tests__/forward-path-gate.test.ts:443:    await financialDataService.processExtractedData('profit_and_loss', sc09Mgmt, coId);

rg -n "deriveStaffCosts|totalLongTermLiabilities" server/services/financial-data.service.ts | head -20
207:          staffCosts: this.deriveStaffCosts(yd, pl),
426:          totalLongTermLiabilities: this.deriveLongTermLiabilitiesTotal(longTermLiabilities),
523:          totalLongTermLiabilities: this.deriveLongTermLiabilitiesTotal(longTermLiabilities),
846:  private deriveStaffCosts(yd: any, pl: any): string | null {

rg -n "private deriveLongTermLiabilitiesTotal|deriveLongTermLiabilitiesTotal" server/services/financial-data.service.ts | head -20
426:          totalLongTermLiabilities: this.deriveLongTermLiabilitiesTotal(longTermLiabilities),
523:          totalLongTermLiabilities: this.deriveLongTermLiabilitiesTotal(longTermLiabilities),
797:  private deriveLongTermLiabilitiesTotal(ltl: any): string | null {

sed -n '46,105p' server/services/financial-data.service.ts
  async processExtractedData(
    documentType: string,
    analysisData: any,
    targetCompanyId: number,
    sourceDocumentId?: number,
    documentCategory?: string,
    imOptions?: IMOptions,
    documentName?: string,
  ): Promise<ProcessingResult> {
    console.log(`[FINANCIAL_DATA] Processing ${documentType} for company ${targetCompanyId}`);

    // Run IM detector before routing so the isIM flag flows to every insert path.
    const extractedYears = Object.keys(analysisData?.years ?? {})
      .map(Number)
      .filter(y => !isNaN(y));
    const currentFiscalYear = new Date().getFullYear();
    const imResult = detectInformationMemorandum({
      rawText: imOptions?.rawText,
      extractedYears,
      documentSource: analysisData?.source ?? null,
      currentFiscalYear,
      llmIsIM: imOptions?.llmIsIM,
      llmReason: imOptions?.llmReason,
    });
    const isIM = imResult.isIM;
    if (isIM) {
      console.log(
        `[FINANCIAL_DATA] IM detected for doc ${sourceDocumentId ?? 'unknown'} — reasons: ${imResult.reasons.join(' | ')}`,
      );
    }

    try {
      switch (documentType) {
        case 'profit_and_loss':
        case 'profit_loss':
        case 'p_and_l':
          return await this.processProfitAndLoss(analysisData, targetCompanyId, sourceDocumentId, documentCategory, isIM, documentName);
        
        case 'balance_sheet':
          return await this.processBalanceSheet(analysisData, targetCompanyId, sourceDocumentId, documentCategory, isIM, documentName);
        
        case 'staff_matrix':
          return await this.processStaffMatrix(analysisData, targetCompanyId, sourceDocumentId, documentCategory);
        
        case 'sales_ledger':
        case 'aged_debtors':
          return await this.processSalesLedger(analysisData, targetCompanyId, sourceDocumentId);
        
        case 'asset_register':
        case 'fixed_assets':
          return await this.processAssetRegister(analysisData, targetCompanyId, sourceDocumentId);
        
        case 'company_accounts':
          return await this.processCompanyAccounts(analysisData, targetCompanyId, sourceDocumentId, documentCategory, isIM, documentName);
        
        default:
          console.log(`[FINANCIAL_DATA] Unknown document type: ${documentType}, skipping normalization`);
          return { success: true, message: `Document type ${documentType} does not require normalization` };
      }
    } catch (error) {

sed -n '830,889p' server/services/financial-data.service.ts
  /**
   * CONTRACT 3 — staff_costs = staff wages and salaries + employer's national insurance
   * + staff pension contributions. Excludes staff training and recruitment. Excludes
   * directors' remuneration, which stays counted inside administrative_expenses via
   * overheads_breakdown.directors_salaries.
   * See claude/CONTRACT-field-composition.md.
   *
   * This is already the P&L prompt's own definition. The extracted aggregate follows it
   * in only 4 of 10 observed cases and produces three different formulas over the same
   * four components, including two different answers from md5-identical input. Every
   * component is read correctly every time, so the aggregate is derived rather than
   * extracted, per item 432.
   *
   * Requires ALL THREE components. A document carrying only some of them would produce an
   * understated sum, so the extracted aggregate is kept in that case.
   */
  private deriveStaffCosts(yd: any, pl: any): string | null {
    const extracted = this.parseDecimal(yd?.total_staff_costs || pl?.total_staff_costs);

    const overheads = yd?.overheads_breakdown || pl?.overheads_breakdown || null;
    if (!overheads || typeof overheads !== 'object') return extracted;

    const read = (key: string): number | null => {
      const v = this.parseDecimal((overheads as any)[key]);
      if (v === null) return null;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };

    const wages    = read('staff_wages_salaries');
    const ni       = read('employers_national_insurance');
    const pension  = read('staff_pension_contributions');
    const training = read('staff_training_recruitment');

    if (wages === null || ni === null || pension === null) return extracted;

    // A breakdown reporting zero wages is not describing a payroll. Prod row 1036 has
    // wages 0, NI 0, pension 0 against a stored 519,174; deriving from it would write 0.
    // parseDecimal(0) returns "0", not null, so a null check alone does not catch this.
    if (wages <= 0) return extracted;

    const contract = this.toMoney(wages + ni + pension);

    // Nothing stored: deriving adds information rather than overwriting it.
    if (extracted === null) return contract;

    const stored = Number(extracted);
    if (!Number.isFinite(stored)) return contract;

    const tol = Math.max(1, Math.abs(stored) * 0.0001);
    const near = (candidate: number) => Math.abs(stored - candidate) <= tol;

    // Overwrite ONLY where the stored aggregate matches a formula we can name.
    // Measured on prod 20 Aug: of 119 would-change rows, 51 include training, 22 drop
    // employer's NI, and 46 match NOTHING. Those 46 are not understood, so they are left
    // alone and surface as a cross-source conflict at step 3 rather than being rewritten.
    const t = training === null ? 0 : training;
    const includesTraining = near(wages + ni + pension + t);
    const niDropped        = near(wages + pension + t);

sed -n '785,824p' server/services/financial-data.service.ts
   * Measured read-only 20 Aug 2026: 82 of 82 dev periods and 32 of 32 prod periods that
   * carry a non-zero deferred taxation figure have it folded INSIDE the extracted total.
   * already_outside and neither were both zero on both databases.
   *
   * Derived by SUBTRACTION, never by summing the children. A note listing only some
   * categories would make a children-sum understate the total, which is the failure mode
   * already documented in the BS6 comment in shared/utils/evidence-mapper.ts. Across all
   * 114 affected rows, extracted_total minus deferred equals the children sum exactly.
   *
   * Subtracts ONLY where the fold is demonstrably present. Every other shape is returned
   * unchanged. This method never guesses.
   */
  private deriveLongTermLiabilitiesTotal(ltl: any): string | null {
    const extracted = this.parseDecimal(ltl?.total);
    if (extracted === null) return null;

    const deferredStr = this.parseDecimal(ltl?.deferred_taxation);
    if (deferredStr === null) return extracted;

    const total = Number(extracted);
    const deferred = Number(deferredStr);
    if (!Number.isFinite(total) || !Number.isFinite(deferred) || deferred === 0) {
      return extracted;
    }

    let children = 0;
    for (const key of ['bank_loans', 'hire_purchase_long_term', 'other_debt']) {
      const v = this.parseDecimal(ltl?.[key]);
      if (v === null) continue;
      const n = Number(v);
      if (Number.isFinite(n)) children += n;
    }

    const tolerance = Math.max(1, Math.abs(total) * 0.0001);

    // Fold present: total === children + deferred. Remove the provision.
    if (Math.abs(total - (children + deferred)) <= tolerance) {
      return this.toMoney(total - deferred);
    }

psql "$PROD_DATABASE_URL" -At -c "SELECT count(*) FROM deal_models;"
125

psql "$PROD_DATABASE_URL" -At -c "SELECT count(*) FROM deal_models WHERE total_purchase_price IS NOT NULL AND CAST(total_purchase_price AS numeric) <= 0;"
28

psql "$PROD_DATABASE_URL" -At -c "SELECT count(*) FROM current_offers WHERE offer_price IS NOT NULL;"
11

psql "$PROD_DATABASE_URL" -c "SELECT dm.id, dm.target_company_id, dm.total_purchase_price, dm.enterprise_value FROM deal_models dm WHERE dm.total_purchase_price IS NOT NULL AND CAST(dm.total_purchase_price AS numeric) <= 0 ORDER BY dm.id LIMIT 20;"
 id  | target_company_id | total_purchase_price |  enterprise_value  
-----+-------------------+----------------------+--------------------
  38 |                67 |         -1032787.456 |        1277300.544
  49 |                77 |  -185146.09999999963 | 3894852.9000000004
  50 |                77 |  -185146.09999999963 | 3894852.9000000004
  52 |                87 |              -281625 |             769678
  53 |                97 |              -672000 |             360639
  54 |                71 |   -365082.1666666665 | 1755458.8333333335
  56 |               100 |            -300905.7 |           268616.3
  59 |               105 |              -959697 |             -95384
  61 |                89 |            -771213.5 |          -541135.5
  63 |                80 |              -251400 |             151768
  75 |               133 |               -62188 |            -251500
  80 |                88 |   -83039.39200000004 |  20976.85799999996
  87 |               150 |   -98197.26249999998 |  93308.73750000002
  93 |               155 |               -95686 |             282393
  99 |               162 |   -6986.880000000005 | 12141.119999999995
 101 |               169 |              -151063 |              56621
 115 |               199 |   -968800.6666666667 | 130723.33333333333
 116 |               199 |            -741498.5 |           171419.5
 123 |               211 |            -33347.97 |           247885.5
 125 |               213 |   -53391.33333333334 | 180748.66666666666
(20 rows)

psql "$PROD_DATABASE_URL" -At -c "SELECT count(DISTINCT dm.target_company_id) FROM deal_models dm WHERE NOT EXISTS (SELECT 1 FROM financial_periods fp WHERE fp.target_company_id = dm.target_company_id AND fp.is_full_year = true AND (fp.source_tier IS NULL OR fp.source_tier <> 'information_memorandum') AND fp.period_end <= CURRENT_DATE);"
5

rg -n "NODE_ENV|nodeEnv" .replit package.json | head -20
package.json:7:    "dev": "NODE_ENV=development tsx server/index.ts",
package.json:9:    "start": "NODE_ENV=production node dist/index.js",

rg -n "\"start\"|\"build\"" package.json
8:    "build": "vite build && esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist",
9:    "start": "NODE_ENV=production node dist/index.js",
```

No client surface reads canonical or document-evidence tables.

Evidence shadow writes require `evidence_shadow_write_enabled` to equal the string `true`.

Canonical shadow writes require both `canonical_shadow_write_enabled` and `evidence_shadow_write_enabled` to equal the string `true`.

The flag checks are not conditional on `NODE_ENV`. Their database-backed values can differ between separate development and production databases.

`processExtractedData` and the staff-cost/long-term-liability derivations feed the normalized financial tables used by the existing user-visible deal-model path; they are not limited to the evidence/canonical shadow tables.

Production deal models: 125.

Production deal models with non-positive stored purchase prices: 28. These are exposed to the first-read nulling guard described in the assessment request.

Production current offers with non-null offer prices: 11.

Production deal-model companies with no valuation-eligible year: 5.

Deployment build: `vite build && esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist`.

Deployment start: `NODE_ENV=production node dist/index.js`.

## Production shadow flags and guard exposure

```text
psql "$PROD_DATABASE_URL" -c "SELECT key, value FROM system_config WHERE key IN ('evidence_shadow_write_enabled','canonical_shadow_write_enabled','open_access_enabled');"
              key              | value 
-------------------------------+-------
 open_access_enabled           | true
 evidence_shadow_write_enabled | true
(2 rows)

psql "$DATABASE_URL" -c "SELECT key, value FROM system_config WHERE key IN ('evidence_shadow_write_enabled','canonical_shadow_write_enabled','open_access_enabled');"
              key               | value 
--------------------------------+-------
 open_access_enabled            | true
 evidence_shadow_write_enabled  | true
 canonical_shadow_write_enabled | true
(3 rows)

psql "$PROD_DATABASE_URL" -c "SELECT status, count(*) FROM current_offers GROUP BY status ORDER BY status;"
  status  | count 
----------+-------
 accepted |     3
 sent     |     8
(2 rows)

psql "$PROD_DATABASE_URL" -c "SELECT id, target_company_id, status, offer_price FROM current_offers ORDER BY id;"
 id | target_company_id |  status  | offer_price 
----+-------------------+----------+-------------
  1 |                70 | sent     | £5,471,544
  2 |                78 | accepted | £410,596
  4 |                71 | accepted | £2,866,254
  6 |               124 | sent     | £1,329,107
  7 |                87 | sent     | £770,409
  8 |                76 | accepted | £6,795,340
 10 |               163 | sent     | £1,002,414
 11 |               218 | sent     | £2,588,114
 12 |               220 | sent     | £3,386,196
 13 |               228 | sent     | £152,815
 15 |               196 | sent     | £379,978
(11 rows)

psql "$PROD_DATABASE_URL" -At -c "SELECT count(*) FROM deal_documents WHERE document_type = 'offer_letter' AND status = 'draft';"
8

psql "$PROD_DATABASE_URL" -c "SELECT count(*) FILTER (WHERE is_locked = true) AS locked, count(*) FILTER (WHERE is_locked = false OR is_locked IS NULL) AS unlocked FROM deal_models WHERE total_purchase_price IS NOT NULL AND CAST(total_purchase_price AS numeric) <= 0;"
 locked | unlocked 
--------+----------
      1 |       27
(1 row)

psql "$PROD_DATABASE_URL" -c "SELECT DISTINCT tc.id, tc.company_name FROM deal_models dm JOIN target_companies tc ON tc.id = dm.target_company_id WHERE dm.total_purchase_price IS NOT NULL AND CAST(dm.total_purchase_price AS numeric) <= 0 ORDER BY tc.id;"
 id  |                company_name                
-----+--------------------------------------------
  67 | DNA
  71 | Acme Manufacturing Ltd
  77 | Brand New Company
  80 | Indirock Limited
  87 | Dental Surgery 70171
  88 | Kitchen Generator Limited
  89 | Innova Design Group Limited
  97 | Palatial leisure
 100 | EREKA and NECAB
 105 | Restoraction & DC Cotswolds
 133 | The Smile Gallery
 150 | Civil Engineering
 155 | LW Haddow
 162 | CDC Engineering And Fabrication Limited
 169 | Kent Construction & Restoration Limited
 197 | BESIXTH & Campus Group (MGA Media Limited)
 199 | Tipper Trunk Hire Business
 211 | Scotty Gates Limited
 213 | KJ Roofing Services Limited
 221 | Elizabeth's Rose Home Care
 224 | About Time Creative
 225 | K Consultancy
 238 | Kidco
 239 | Fabeliz Services
 251 | Capital Services Group
(25 rows)
```

Production and development both have `open_access_enabled=true` and `evidence_shadow_write_enabled=true`.

Development has `canonical_shadow_write_enabled=true`; production has no row for `canonical_shadow_write_enabled`, so the canonical shadow-write check does not receive `true` in production.

Production has 8 draft offer letters that could no longer be sent under the guard described in the assessment request.

Of the 28 production deal models with non-positive stored purchase prices, 1 is locked and 27 are unlocked. The locked model uses `computeFor` and retains its stored price; the 27 unlocked models are exposed to the first-read write behavior.

The 28 affected deal models span 25 production companies.

## Draft offer-letter sendability

```text
psql "$PROD_DATABASE_URL" -c "SELECT dd.id, dd.target_company_id, tc.company_name, dd.created_at, dd.generated_file_url IS NOT NULL AS has_file, dd.document_data->'_raw'->>'offerPrice' AS raw_offer_price, dd.document_data->>'offerPrice' AS displayed_price FROM deal_documents dd LEFT JOIN target_companies tc ON tc.id = dd.target_company_id WHERE dd.document_type = 'offer_letter' AND dd.status = 'draft' ORDER BY dd.id;"
 id | target_company_id |         company_name         |         created_at         | has_file |  raw_offer_price   | displayed_price 
----+-------------------+------------------------------+----------------------------+----------+--------------------+-----------------
 39 |                70 | Aithon Solutions             | 2026-04-17 10:18:37.914476 | t        | 5471544.266666666  | £5,471,544
 49 |               124 | Association of Learning      | 2026-05-05 14:43:45.577323 | t        | 1329107            | £1,329,107
 51 |                87 | Dental Surgery 70171         | 2026-05-19 14:18:25.895655 | t        | 770409             | £770,409
 55 |               163 | Lovell Landscape             | 2026-06-15 12:46:39.726148 | t        | 1002413.6666666665 | £1,002,414
 59 |               220 | Canoports UK Limited         | 2026-07-06 18:12:58.713645 | t        | 3386195.8          | £3,386,196
 61 |               228 | Thor-CON                     | 2026-07-16 19:00:52.76296  | t        | 152815.2           | £152,815
 63 |               196 | Compassion Home Care Limited | 2026-07-16 20:38:32.150821 | t        | 379977.80000000005 | £379,978
 64 |               196 | Compassion Home Care Limited | 2026-07-17 14:23:53.085793 | t        | 379977.80000000005 | £379,978
(8 rows)
```

Draft offer letters with `raw_offer_price` above zero: 8. These still send normally.

Draft offer letters with null `raw_offer_price`: 0.

Draft offer letters with `raw_offer_price` at or below zero: 0.

## Per-model production guard exposure

```text
psql "$PROD_DATABASE_URL" -c "SELECT dm.id AS model_id, dm.target_company_id, tc.company_name, dm.name AS model_name, dm.is_locked, dm.total_purchase_price, dm.enterprise_value, dm.calculated_ebitda, dm.ebitda_multiple, dm.updated_at FROM deal_models dm LEFT JOIN target_companies tc ON tc.id = dm.target_company_id WHERE dm.total_purchase_price IS NOT NULL AND CAST(dm.total_purchase_price AS numeric) <= 0 ORDER BY tc.company_name, dm.id;"
 model_id | target_company_id |                company_name                |  model_name   | is_locked | total_purchase_price |  enterprise_value  |  calculated_ebitda  |   ebitda_multiple   |       updated_at        
----------+-------------------+--------------------------------------------+---------------+-----------+----------------------+--------------------+---------------------+---------------------+-------------------------
      169 |               224 | About Time Creative                        | Deal Model v1 | f         |               -62877 |              14553 |                6468 |                2.25 | 2026-08-21 08:04:35.227
       54 |                71 | Acme Manufacturing Ltd                     | Deal Model v1 | t         |   -365082.1666666665 | 1755458.8333333335 |   501559.6666666667 |                 3.5 | 2026-06-28 00:48:24.418
      139 |               197 | BESIXTH & Campus Group (MGA Media Limited) | Deal Model v1 | f         |            -166308.3 | -42468.29999999999 | -10617.074999999997 |                   4 | 2026-07-14 12:01:43.804
       49 |                77 | Brand New Company                          | Deal Model v1 | f         |  -185146.09999999963 | 3894852.9000000004 |           2596568.6 |                 1.5 | 2026-04-21 08:34:14.529
       50 |                77 | Brand New Company                          | Deal Model v2 | f         |  -185146.09999999963 | 3894852.9000000004 |           2596568.6 |                 1.5 | 2026-04-21 08:41:29.671
       99 |               162 | CDC Engineering And Fabrication Limited    | Deal Model v1 | f         |   -6986.880000000005 | 12141.119999999995 |   3035.279999999999 |                   4 | 2026-06-07 18:27:28.271
      173 |               251 | Capital Services Group                     | Deal Model v1 | f         |   -728774.8333333333 |  891019.1666666667 |   356407.6666666667 |                 2.5 | 2026-09-03 12:00:40.483
       87 |               150 | Civil Engineering                          | Deal Model v1 | f         |   -98197.26249999998 |  93308.73750000002 |  33930.450000000004 |                2.75 | 2026-06-05 10:48:49.188
       38 |                67 | DNA                                        | Deal Model v1 | f         |         -1032787.456 |        1277300.544 |           532208.56 |                 2.4 | 2026-05-04 13:40:42.06
       52 |                87 | Dental Surgery 70171                       | Deal Model v1 | f         |              -281625 |             769678 |            307871.2 |                 2.5 | 2026-05-19 17:27:28.735
       56 |               100 | EREKA and NECAB                            | Deal Model v1 | f         |            -300905.7 |           268616.3 |             70688.5 |                 3.8 | 2026-04-27 13:15:00.689
      137 |               221 | Elizabeth's Rose Home Care                 | Deal Model v1 | f         |                    0 |              36813 | -26811.519999999997 | -1.3730292053565036 | 2026-08-18 15:36:26.849
      161 |               239 | Fabeliz Services                           | Deal Model v1 | f         |               -65761 |             -63518 |              -31759 |                   2 | 2026-07-24 18:29:11.203
       63 |                80 | Indirock Limited                           | Deal Model v1 | f         |              -251400 |             151768 |               75884 |                   2 | 2026-05-02 08:16:05.901
       61 |                89 | Innova Design Group Limited                | Deal Model v1 | f         |            -771213.5 |          -541135.5 |           -180378.5 |                   3 | 2026-07-04 08:21:15.86
      138 |                89 | Innova Design Group Limited                | Deal Model v2 | f         |                -1762 |             228316 |   76105.33333333333 |                   3 | 2026-07-14 12:02:33.332
      154 |               225 | K Consultancy                              | Deal Model v1 | f         |               -23882 |                  0 |                   0 |                   4 | 2026-08-18 14:16:27.423
      125 |               213 | KJ Roofing Services Limited                | Deal Model v1 | f         |   -53391.33333333334 | 180748.66666666666 |   90374.33333333333 |                   2 | 2026-06-23 20:39:05.881
      101 |               169 | Kent Construction & Restoration Limited    | Deal Model v1 | f         |              -151063 |              56621 |             28310.5 |                   2 | 2026-06-05 18:16:55.364
      160 |               238 | Kidco                                      | Deal Model v1 | f         |               -30645 |              21877 |             10938.5 |                   2 | 2026-07-28 16:30:39.674
       80 |                88 | Kitchen Generator Limited                  | Deal Model v1 | f         |   -83039.39200000004 |  20976.85799999996 |   7491.734999999986 |                 2.8 | 2026-05-22 18:23:08.06
       93 |               155 | LW Haddow                                  | Deal Model v1 | f         |               -95686 |             282393 |               94131 |                   3 | 2026-06-09 14:15:18.468
       53 |                97 | Palatial leisure                           | Deal Model v1 | f         |              -672000 |             360639 |              120213 |                   3 | 2026-06-02 12:59:31.842
       59 |               105 | Restoraction & DC Cotswolds                | Deal Model v1 | f         |              -959697 |             -95384 |              -47692 |                   2 | 2026-04-30 12:25:08.918
      123 |               211 | Scotty Gates Limited                       | Deal Model v1 | f         |            -33347.97 |           247885.5 |  110171.33333333333 |                2.25 | 2026-06-23 19:51:47.531
       75 |               133 | The Smile Gallery                          | Deal Model v1 | f         |               -62188 |            -251500 |              -62875 |                   4 | 2026-05-09 19:03:04.312
      115 |               199 | Tipper Trunk Hire Business                 | Deal Model v1 | f         |   -968800.6666666667 | 130723.33333333333 |  65361.666666666664 |                   2 | 2026-06-14 20:22:00.897
      116 |               199 | Tipper Trunk Hire Business                 | Deal Model v2 | f         |            -741498.5 |           171419.5 |            61221.25 |                 2.8 | 2026-06-24 19:58:25.022
(28 rows)

psql "$PROD_DATABASE_URL" -c "SELECT dm.id AS model_id, tc.company_name, EXISTS (SELECT 1 FROM financial_periods fp WHERE fp.target_company_id = dm.target_company_id AND fp.is_full_year = true AND (fp.source_tier IS NULL OR fp.source_tier <> 'information_memorandum') AND fp.period_end <= CURRENT_DATE) AS has_eligible_year FROM deal_models dm LEFT JOIN target_companies tc ON tc.id = dm.target_company_id WHERE dm.total_purchase_price IS NOT NULL AND CAST(dm.total_purchase_price AS numeric) <= 0 ORDER BY tc.company_name, dm.id;"
 model_id |                company_name                | has_eligible_year 
----------+--------------------------------------------+-------------------
      169 | About Time Creative                        | t
       54 | Acme Manufacturing Ltd                     | t
      139 | BESIXTH & Campus Group (MGA Media Limited) | t
       49 | Brand New Company                          | t
       50 | Brand New Company                          | t
       99 | CDC Engineering And Fabrication Limited    | t
      173 | Capital Services Group                     | t
       87 | Civil Engineering                          | t
       38 | DNA                                        | t
       52 | Dental Surgery 70171                       | t
       56 | EREKA and NECAB                            | t
      137 | Elizabeth's Rose Home Care                 | t
      161 | Fabeliz Services                           | t
       63 | Indirock Limited                           | t
       61 | Innova Design Group Limited                | t
      138 | Innova Design Group Limited                | t
      154 | K Consultancy                              | f
      125 | KJ Roofing Services Limited                | t
      101 | Kent Construction & Restoration Limited    | t
      160 | Kidco                                      | t
       80 | Kitchen Generator Limited                  | t
       93 | LW Haddow                                  | t
       53 | Palatial leisure                           | f
       59 | Restoraction & DC Cotswolds                | t
      123 | Scotty Gates Limited                       | t
       75 | The Smile Gallery                          | t
      115 | Tipper Trunk Hire Business                 | t
      116 | Tipper Trunk Hire Business                 | t
(28 rows)

psql "$PROD_DATABASE_URL" -c "SELECT DISTINCT tc.id, tc.company_name FROM deal_models dm JOIN target_companies tc ON tc.id = dm.target_company_id WHERE dm.total_purchase_price IS NOT NULL AND CAST(dm.total_purchase_price AS numeric) <= 0 AND EXISTS (SELECT 1 FROM current_offers co WHERE co.target_company_id = dm.target_company_id) ORDER BY tc.id;"
 id |      company_name      
----+------------------------
 71 | Acme Manufacturing Ltd
 87 | Dental Surgery 70171
(2 rows)

psql "$PROD_DATABASE_URL" -At -c "SELECT count(*) FROM deal_models WHERE total_purchase_price IS NOT NULL AND CAST(total_purchase_price AS numeric) <= 0;"
28
```

The uncapped inventory contains 28 affected production deal models.

Of those 28 models, 26 have a valuation-eligible year and 2 do not.

The affected models without a valuation-eligible year are model 154 for K Consultancy and model 53 for Palatial leisure.

Two affected companies have a current offer: Acme Manufacturing Ltd and Dental Surgery 70171.