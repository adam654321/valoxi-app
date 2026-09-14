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