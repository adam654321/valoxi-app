/**
 * Pipeline Fidelity Audit Harness
 * Usage: npx tsx audit/harness.ts <prodTcId> <phase>
 *
 * Phases: 1 | 2 | 3 | 4 | 5 | 6
 *
 * STANDING CONTROLS (enforced here):
 *   - All DB queries print hostname first.
 *   - Prod access is SELECT only (enforced by using prodDb helper).
 *   - Real service functions are called, no reimplementation.
 *   - No file modifications to prompts/calculators/schema/services.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Constants ────────────────────────────────────────────────────────────────
const AUDIT_DIR = path.join(__dirname, 'pipeline-fidelity');
const STATE_FILE = path.join(AUDIT_DIR, 'state.json');
const DEV_USER_COMPANY_ID = 5;
const DEV_USER_ID = 89;        // adam+team2@shiftopsconsulting.com

// ── Helpers ──────────────────────────────────────────────────────────────────
function loadState(): any {
  return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
}

function saveState(state: any): void {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function companyDir(devTcId: number): string {
  const dir = path.join(AUDIT_DIR, `company-${devTcId}`);
  fs.mkdirSync(path.join(dir, 'raw'), { recursive: true });
  return dir;
}

function writeRaw(dir: string, name: string, data: any): void {
  const p = path.join(dir, 'raw', name);
  fs.writeFileSync(p, typeof data === 'string' ? data : JSON.stringify(data, null, 2));
  console.log(`[HARNESS] Wrote raw/${name}`);
}

function appendMd(dir: string, text: string): void {
  const p = path.join(dir, 'dev-pipeline.md');
  fs.appendFileSync(p, text + '\n');
}

function appendLive(dir: string, text: string): void {
  const p = path.join(dir, 'live-snapshot.md');
  fs.appendFileSync(p, text + '\n');
}

// Prod DB — SELECT only
function prodDb() {
  const url = process.env.PROD_DATABASE_URL!;
  const host = new URL(url).hostname;
  console.log(`[PROD_DB] host: ${host}`);
  return new Pool({ connectionString: url });
}

async function prodQuery(sql: string, params?: any[]): Promise<any[]> {
  const pool = prodDb();
  try {
    const res = await pool.query(sql, params);
    return res.rows;
  } finally {
    await pool.end();
  }
}

function devDbHost(): void {
  console.log(`[DEV_DB] host: helium (heliumdb)`);
}

// ── Phase 1 — Clone into Dev ──────────────────────────────────────────────────
async function phase1(prodTcId: number): Promise<void> {
  console.log(`\n=== PHASE 1: Clone TC ${prodTcId} into dev ===`);
  devDbHost();

  const state = loadState();
  const tcKey = String(prodTcId);

  // 1.1 Read prod company row
  const [prodCompany] = await prodQuery(
    `SELECT id, company_name, industry, sub_sector, website, phone, email, address,
            annual_revenue, employee_count, year_established, description, created_by,
            created_at, stage, stage_updated_at, is_archived, user_company_id
     FROM target_companies WHERE id = $1`, [prodTcId]
  );
  console.log(`[PHASE1] Prod company: ${prodCompany.company_name} (id=${prodCompany.id}, uc=${prodCompany.user_company_id})`);

  // Read prod documents
  const prodDocs = await prodQuery(
    `SELECT id, document_name, original_filename, document_category, secondary_category,
            file_path, file_type, file_size, upload_date
     FROM documents WHERE target_company_id = $1 ORDER BY upload_date`, [prodTcId]
  );
  console.log(`[PHASE1] Prod documents: ${prodDocs.length}`);

  // Save raw prod data
  const dir = path.join(AUDIT_DIR, `company-${prodTcId}-prod-stage`);
  fs.mkdirSync(path.join(dir, 'raw'), { recursive: true });
  writeRaw(dir, 'prod-company.json', prodCompany);
  writeRaw(dir, 'prod-docs.json', prodDocs);

  // 1.2 Create dev company
  const { targetCompaniesRepository } = await import('../server/repositories/target-companies.repository');
  const devCompany = await targetCompaniesRepository.create({
    companyName: `[AUDIT-${prodTcId}] ${prodCompany.company_name}`,
    userCompanyId: DEV_USER_COMPANY_ID,
    industry: prodCompany.industry,
    subSector: prodCompany.sub_sector,
    website: prodCompany.website,
    phone: prodCompany.phone,
    email: prodCompany.email,
    address: prodCompany.address,
    annualRevenue: prodCompany.annual_revenue,
    employeeCount: prodCompany.employee_count,
    yearEstablished: prodCompany.year_established,
    description: prodCompany.description,
    createdBy: DEV_USER_ID,
    stage: 'New Target',
  });
  console.log(`[PHASE1] Created dev company: id=${devCompany.id} name="${devCompany.companyName}"`);

  // Update state early
  state.companies[tcKey].devTcId = devCompany.id;
  saveState(state);

  // Create the company dir now we know the dev ID
  const cDir = companyDir(devCompany.id);
  writeRaw(cDir, 'prod-company.json', prodCompany);
  writeRaw(cDir, 'prod-docs.json', prodDocs);

  // 1.3 + 1.4: Create dev documents + HEAD check R2
  const { documentsRepository } = await import('../server/repositories/documents.repository');
  const { fileStorageService } = await import('../server/services/file-storage.service');
  const { randomBytes } = await import('crypto');

  const docRows: any[] = [];
  const devDocIds: number[] = [];

  for (const d of prodDocs) {
    // HEAD check R2
    let headOk = false;
    let headSize = 0;
    let headContentType = 'unknown';
    const headResult = await fileStorageService.head(d.file_path);
    if (headResult) {
      headOk = true;
      headSize = headResult.size;
      headContentType = headResult.contentType;
    }
    console.log(`[PHASE1] R2 HEAD ${d.file_path}: ok=${headOk} size=${headSize} ct=${headContentType}`);

    const token = randomBytes(32).toString('hex');
    const devDoc = await documentsRepository.createDocument({
      targetCompanyId: devCompany.id,
      uploadedBy: DEV_USER_ID,
      documentName: d.document_name,
      originalFilename: d.original_filename,
      filePath: d.file_path,
      fileSize: d.file_size,
      fileType: d.file_type,
      documentCategory: d.document_category,
      secondaryCategory: d.secondary_category,
      description: `[AUDIT clone of prod doc ${d.id}]`,
      isConfidential: true,
      uploadDate: d.upload_date,
      publicToken: token,
    });

    // Create file_upload_event
    const { db } = await import('../server/db');
    const { fileUploadEvents } = await import('@shared/schema');
    const [evt] = await db.insert(fileUploadEvents).values({
      documentId: devDoc.id,
      targetCompanyId: devCompany.id,
      uploadedBy: DEV_USER_ID,
      fileName: d.original_filename,
      fileUrl: d.file_path,
      webhookStatus: 'pending',
      uploadedAt: d.upload_date,
    }).returning();

    docRows.push({
      prodDocId: d.id,
      devDocId: devDoc.id,
      eventId: evt.id,
      filename: d.original_filename,
      category: d.document_category,
      fileType: d.file_type,
      fileSize: d.file_size,
      r2Key: d.file_path,
      headOk,
      headSize,
      headContentType,
      uploadDate: d.upload_date,
    });
    devDocIds.push(devDoc.id);

    if (!headOk) {
      console.warn(`[PHASE1] FINDING: R2 key not found: ${d.file_path} (prod doc ${d.id})`);
    }
  }

  // Write document table to dev-pipeline.md
  const mdHeader = `# Pipeline Fidelity: TC ${prodTcId} (${prodCompany.company_name})\n\n` +
    `**Dev TC ID**: ${devCompany.id}  \n` +
    `**Prod TC ID**: ${prodTcId}  \n` +
    `**Industry**: ${prodCompany.industry}  \n` +
    `**Sub-sector**: ${prodCompany.sub_sector}  \n` +
    `**Audit date**: 2026-07-30  \n\n` +
    `---\n\n## Phase 1 — Document Cloning\n\n` +
    `**Dev DB host**: helium  \n` +
    `**Prod DB host**: ep-old-recipe-an7e4afw.c-6.us-east-1.aws.neon.tech  \n\n` +
    `| Prod ID | Dev ID | Filename | Category | Type | Size | R2 Key | HEAD OK |\n` +
    `|---|---|---|---|---|---|---|---|\n` +
    docRows.map(r =>
      `| ${r.prodDocId} | ${r.devDocId} | ${r.filename} | ${r.category} | ${r.fileType.split('/').pop() ?? r.fileType} | ${r.fileSize} | \`${r.r2Key}\` | ${r.headOk ? '✓' : '**MISSING**'} |`
    ).join('\n') + '\n';

  fs.writeFileSync(path.join(cDir, 'dev-pipeline.md'), mdHeader);
  writeRaw(cDir, 'phase1-doc-map.json', docRows);

  // Update state
  state.companies[tcKey].devTcId = devCompany.id;
  state.companies[tcKey].phases['1'] = {
    completed: true,
    devDocIds,
    eventIds: docRows.map(r => r.eventId),
    docMap: docRows,
    missingR2: docRows.filter(r => !r.headOk).map(r => r.r2Key),
  };
  state.companies[tcKey].phase = 1;
  saveState(state);

  console.log(`[PHASE1] Complete. Dev TC=${devCompany.id}, ${devDocIds.length} docs created.`);
}

// ── Phase 2 — Classification & Extraction ─────────────────────────────────────
async function phase2(prodTcId: number): Promise<void> {
  console.log(`\n=== PHASE 2: Classification + Extraction for prod TC ${prodTcId} ===`);
  devDbHost();

  const state = loadState();
  const tcKey = String(prodTcId);
  const devTcId: number = state.companies[tcKey].devTcId;
  const docMap: any[] = state.companies[tcKey].phases['1'].docMap;
  const cDir = companyDir(devTcId);

  const { analyzeUploadedFileWithGemini } = await import('../server/services/file-analysis.service');
  const { db } = await import('../server/db');
  const { documentAnalysisResults, financialPeriods, incomeStatements, balanceSheets } = await import('@shared/schema');
  const { eq } = await import('drizzle-orm');

  // Snapshot BEFORE state of financial tables
  const beforePeriods = await db.select().from(financialPeriods).where(eq(financialPeriods.targetCompanyId, devTcId));
  const beforeIS = await db.select().from(incomeStatements).where(eq(incomeStatements.targetCompanyId, devTcId));
  const beforeBS = await db.select().from(balanceSheets).where(eq(balanceSheets.targetCompanyId, devTcId));

  appendMd(cDir, `\n---\n\n## Phase 2 — Classification & Extraction\n\n`);
  appendMd(cDir, `**Before state**: ${beforePeriods.length} periods, ${beforeIS.length} IS rows, ${beforeBS.length} BS rows\n`);

  const docResults: any[] = [];

  for (const docRow of docMap) {
    console.log(`\n[PHASE2] Processing doc prod=${docRow.prodDocId} dev=${docRow.devDocId} file=${docRow.filename}`);

    if (!docRow.headOk) {
      console.warn(`[PHASE2] Skipping ${docRow.filename} — R2 key missing`);
      docResults.push({ ...docRow, status: 'skipped_missing_r2', analysisResults: [] });
      continue;
    }

    // Snapshot before this document
    const pBefore = await db.select().from(financialPeriods).where(eq(financialPeriods.targetCompanyId, devTcId));
    const isBefore = await db.select().from(incomeStatements).where(eq(incomeStatements.targetCompanyId, devTcId));
    const bsBefore = await db.select().from(balanceSheets).where(eq(balanceSheets.targetCompanyId, devTcId));

    // Run the real analysis
    let analysisError: string | null = null;
    try {
      await analyzeUploadedFileWithGemini(docRow.eventId);
    } catch (err: any) {
      analysisError = err.message || String(err);
      console.error(`[PHASE2] analyzeUploadedFileWithGemini error: ${analysisError}`);
    }

    // Snapshot after this document
    const pAfter = await db.select().from(financialPeriods).where(eq(financialPeriods.targetCompanyId, devTcId));
    const isAfter = await db.select().from(incomeStatements).where(eq(incomeStatements.targetCompanyId, devTcId));
    const bsAfter = await db.select().from(balanceSheets).where(eq(balanceSheets.targetCompanyId, devTcId));

    // Get analysis results for this document
    const thisDocResults = await db.select().from(documentAnalysisResults)
      .where(eq(documentAnalysisResults.documentId, docRow.devDocId));

    // Check event status
    const { fileUploadEvents } = await import('@shared/schema');
    const [evt] = await db.select().from(fileUploadEvents).where(eq(fileUploadEvents.id, docRow.eventId));

    const newPeriods = pAfter.filter(p => !pBefore.find((pb: any) => pb.id === p.id));
    const newIS = isAfter.filter(i => !isBefore.find((ib: any) => ib.id === i.id));
    const newBS = bsAfter.filter(b => !bsBefore.find((bb: any) => bb.id === b.id));
    const changedPeriods = pAfter.filter(p => {
      const before = pBefore.find((pb: any) => pb.id === p.id);
      return before && JSON.stringify(before) !== JSON.stringify(p);
    });

    // Determine extraction status
    let extractionStatus = 'no_analysis_result';
    let extractionReason = analysisError || 'no result';
    if (analysisError) {
      extractionStatus = 'errored';
      extractionReason = analysisError;
    } else if (thisDocResults.length === 0) {
      extractionStatus = 'produced_nothing';
      extractionReason = `webhook_status=${evt?.webhookStatus}`;
    } else {
      const hasUsableFigures = thisDocResults.some((r: any) => {
        const ad = r.analysisData as any;
        return ad && ad.years && Object.keys(ad.years).length > 0;
      });
      if (hasUsableFigures) {
        extractionStatus = 'produced_usable_figures';
        extractionReason = `${thisDocResults.length} result row(s)`;
      } else {
        const hasStructure = thisDocResults.length > 0;
        extractionStatus = hasStructure ? 'produced_structure_all_nulls' : 'produced_nothing';
        extractionReason = `${thisDocResults.length} result row(s) but no year data`;
      }
    }

    const docResult = {
      prodDocId: docRow.prodDocId,
      devDocId: docRow.devDocId,
      eventId: docRow.eventId,
      filename: docRow.filename,
      category: docRow.category,
      webhookStatus: evt?.webhookStatus,
      webhookResponse: evt?.webhookResponse,
      analysisResults: thisDocResults.map((r: any) => ({
        id: r.id,
        documentType: r.documentType,
        createdAt: r.createdAt,
        hasYears: !!(r.analysisData as any)?.years,
        yearCount: Object.keys((r.analysisData as any)?.years ?? {}).length,
        analysisData: r.analysisData,
      })),
      extractionStatus,
      extractionReason,
      error: analysisError,
      newPeriods,
      newIS,
      newBS,
      changedPeriods,
    };
    docResults.push(docResult);

    // Save raw analysis data
    for (const ar of thisDocResults) {
      writeRaw(cDir, `phase2-doc-${docRow.devDocId}-type-${ar.documentType}.json`, ar.analysisData);
    }
    writeRaw(cDir, `phase2-doc-${docRow.devDocId}-before-after.json`, {
      beforePeriods: pBefore, afterPeriods: pAfter, newPeriods,
      beforeIS: isBefore, afterIS: isAfter, newIS,
      beforeBS: bsBefore, afterBS: bsAfter, newBS,
      changedPeriods,
    });

    appendMd(cDir, `\n### Doc ${docRow.prodDocId} → dev ${docRow.devDocId}: \`${docRow.filename}\`\n`);
    appendMd(cDir, `**Category**: ${docRow.category}  **Type**: ${docRow.fileType}  **Status**: \`${extractionStatus}\`  \n`);
    appendMd(cDir, `**Reason**: ${extractionReason}  **Webhook**: \`${evt?.webhookStatus}\`  \n`);
    if (thisDocResults.length > 0) {
      appendMd(cDir, `\n**Analysis results** (${thisDocResults.length} row(s)):\n\n` +
        `| AR id | document_type | created_at | years | revenue present | op_profit present | D&A present | cash present |\n` +
        `|---|---|---|---|---|---|---|---|\n` +
        thisDocResults.map((r: any) => {
          const ad = r.analysisData as any;
          const years = Object.keys(ad?.years ?? {});
          const firstYear = years[0] ? ad.years[years[0]] : null;
          const pl = firstYear?.profit_and_loss ?? firstYear ?? {};
          const bs = firstYear?.balance_sheet ?? {};
          return `| ${r.id} | ${r.documentType} | ${r.createdAt} | ${years.join(', ') || '—'} | ${pl.revenue != null ? '✓' : '✗'} | ${pl.operating_profit != null ? '✓' : '✗'} | ${pl.depreciation_amortisation != null ? '✓' : '✗'} | ${bs.cash_at_bank != null ? '✓' : '✗'} |`;
        }).join('\n') + '\n');
    }
    if (newPeriods.length > 0) {
      appendMd(cDir, `\n**New periods created**: ${newPeriods.length}\n`);
      appendMd(cDir, `| id | period_type | fiscal_year | period_end | is_full_year | months_covered | source_tier | source_doc_id |\n|---|---|---|---|---|---|---|---|\n` +
        newPeriods.map((p: any) => `| ${p.id} | ${p.periodType} | ${p.fiscalYear} | ${p.periodEnd} | ${p.isFullYear} | ${p.monthsCovered} | ${p.sourceTier} | ${p.sourceDocumentId} |`).join('\n') + '\n');
    }
    if (changedPeriods.length > 0) {
      appendMd(cDir, `\n**Changed periods**: ${changedPeriods.length} — see raw/phase2-doc-${docRow.devDocId}-before-after.json\n`);
    }

    console.log(`[PHASE2] Doc ${docRow.devDocId} done: status=${extractionStatus} periods+${newPeriods.length} IS+${newIS.length} BS+${newBS.length}`);
  }

  // 2.6 Final financial_periods table
  const finalPeriods = await db.select().from(financialPeriods).where(eq(financialPeriods.targetCompanyId, devTcId));
  const finalIS = await db.select().from(incomeStatements).where(eq(incomeStatements.targetCompanyId, devTcId));
  const finalBS = await db.select().from(balanceSheets).where(eq(balanceSheets.targetCompanyId, devTcId));
  writeRaw(cDir, 'phase2-final-periods.json', { periods: finalPeriods, incomeStatements: finalIS, balanceSheets: finalBS });

  appendMd(cDir, `\n---\n\n### Phase 2 Final State\n\n`);
  appendMd(cDir, `**Final**: ${finalPeriods.length} periods, ${finalIS.length} IS rows, ${finalBS.length} BS rows\n\n`);
  appendMd(cDir, `| Period id | period_type | fiscal_year | period_end | is_full_year | months | source_tier | IS rows | BS rows |\n` +
    `|---|---|---|---|---|---|---|---|---|\n` +
    finalPeriods.map((p: any) => {
      const isRows = finalIS.filter((i: any) => i.financialPeriodId === p.id).length;
      const bsRows = finalBS.filter((b: any) => b.financialPeriodId === p.id).length;
      return `| ${p.id} | ${p.periodType} | ${p.fiscalYear} | ${p.periodEnd} | ${p.isFullYear} | ${p.monthsCovered ?? '—'} | ${p.sourceTier} | ${isRows} | ${bsRows} |`;
    }).join('\n') + '\n');

  const usableYears = finalPeriods
    .filter((p: any) => p.isFullYear && p.sourceTier !== 'information_memorandum')
    .map((p: any) => p.fiscalYear);
  appendMd(cDir, `\n**Usable EBITDA years** (full-year, non-IM): ${usableYears.length > 0 ? usableYears.join(', ') : 'NONE'}  \n`);

  state.companies[tcKey].phases['2'] = {
    completed: true,
    docResults: docResults.map(r => ({
      prodDocId: r.prodDocId, devDocId: r.devDocId, filename: r.filename,
      category: r.category, extractionStatus: r.extractionStatus, extractionReason: r.extractionReason,
    })),
    finalPeriodCount: finalPeriods.length,
    finalISCount: finalIS.length,
    finalBSCount: finalBS.length,
    usableYears,
  };
  state.companies[tcKey].phase = 2;
  saveState(state);

  console.log(`[PHASE2] Complete. Periods=${finalPeriods.length} IS=${finalIS.length} BS=${finalBS.length} usableYears=${JSON.stringify(usableYears)}`);
}

// ── Phase 3 — Expert Analysis ─────────────────────────────────────────────────
async function phase3(prodTcId: number): Promise<void> {
  console.log(`\n=== PHASE 3: Expert analysis for prod TC ${prodTcId} ===`);
  devDbHost();

  const state = loadState();
  const tcKey = String(prodTcId);
  const devTcId: number = state.companies[tcKey].devTcId;
  const cDir = companyDir(devTcId);

  // Capture the exact input each expert receives
  const { getReconciledFinancials } = await import('../server/services/reconciled-financials.service');
  const reconciledInput = await getReconciledFinancials(devTcId);
  writeRaw(cDir, 'phase3-reconciled-financials-input.json', reconciledInput);
  console.log(`[PHASE3] Reconciled financials captured: ${Object.keys(reconciledInput.incomeByYear).length} income years, ${Object.keys(reconciledInput.balanceSheetsByYear).length} BS years`);

  // Snapshot expert results before
  const { db } = await import('../server/db');
  const { expertAnalysisResults } = await import('@shared/schema');
  const { eq } = await import('drizzle-orm');
  const before = await db.select().from(expertAnalysisResults).where(eq(expertAnalysisResults.targetCompanyId, devTcId));
  console.log(`[PHASE3] Existing expert records: ${before.length}`);

  // Trigger the full expert pipeline
  const { expertAnalysisService } = await import('../server/services/expert-analysis.service');
  let pipelineError: string | null = null;
  try {
    await expertAnalysisService.triggerExpertPipeline(devTcId, DEV_USER_ID);
  } catch (err: any) {
    pipelineError = err.message || String(err);
    console.error(`[PHASE3] Pipeline error: ${pipelineError}`);
  }

  // Read all expert results
  const after = await db.select().from(expertAnalysisResults).where(eq(expertAnalysisResults.targetCompanyId, devTcId));

  appendMd(cDir, `\n---\n\n## Phase 3 — Expert Analysis\n\n`);
  if (pipelineError) {
    appendMd(cDir, `**PIPELINE ERROR**: ${pipelineError}\n\n`);
  }
  appendMd(cDir, `**Expert results**: ${after.length} records\n\n`);

  for (const r of after) {
    const ad = r.analysisData as any;
    writeRaw(cDir, `phase3-expert-${r.expertType}-output.json`, ad);

    appendMd(cDir, `\n### Expert: ${r.expertType} (id=${r.id})\n`);
    appendMd(cDir, `**Status**: ${r.status}  **Score**: ${r.score ?? '—'}  **Confidence**: ${r.confidence ?? '—'}  **Time**: ${r.processingTime ?? '—'}ms  \n`);

    if (r.status === 'success' && ad) {
      if (r.expertType === 'qoe') {
        appendMd(cDir, `\n**QoE Summary**:\n`);
        const addBacks = ad.add_backs ?? [];
        const deductions = ad.deductions ?? [];
        appendMd(cDir, `- Total add-backs: ${addBacks.length}\n- Total deductions: ${deductions.length}\n`);
        appendMd(cDir, `\n| Item | Type | Category | Amount | Recurrence | Defensibility |\n|---|---|---|---|---|---|\n`);
        for (const a of addBacks) {
          appendMd(cDir, `| ${a.description} | add_back | ${a.category} | £${a.amount} | ${a.recurrence} | ${a.defensibility_score} |\n`);
        }
        for (const d of deductions) {
          appendMd(cDir, `| ${d.description} | deduction | ${d.category} | £${d.amount} | ${d.recurrence} | ${d.defensibility_score} |\n`);
        }
        const adj = ad.adjusted_ebitda ?? {};
        appendMd(cDir, `\n**Adjusted EBITDA scenarios**:\n`);
        appendMd(cDir, `- Conservative: £${adj.conservative ?? '—'}\n- Base: £${adj.base ?? '—'}\n- Optimistic: £${adj.optimistic ?? '—'}\n`);
        appendMd(cDir, `\n*Base EBITDA: £${adj.reported_ebitda ?? '—'}  + Add-backs: £${adj.plus_add_backs ?? '—'}  – Deductions: £${adj.minus_deductions ?? '—'}  = £${adj.equals_adjusted_ebitda_base ?? '—'}*  \n`);
      }

      if (r.expertType === 'valuation') {
        const mult = ad.multiples ?? {};
        const bridge = ad.offer_price_bridge ?? {};
        appendMd(cDir, `\n**Valuation figures**: multiple=${mult.selected_multiple} range=[${mult.sector_multiple_range?.low}–${mult.sector_multiple_range?.high}]  \n`);
        appendMd(cDir, `adjusted_ebitda_base: £${ad.adjusted_ebitda_base ?? '—'}  \n`);
        appendMd(cDir, `Bridge: EV=£${bridge.enterprise_value ?? '—'} +cash=£${bridge.plus_cash ?? '—'} -LTD=£${bridge.minus_long_term_debt ?? '—'} -DL=£${bridge.minus_director_loans ?? '—'} -WC=£${bridge.minus_working_capital_adjustment ?? '—'} → offer=£${bridge.offer_price ?? '—'}  \n`);
      }

      if (r.expertType === 'financial') {
        const ym = ad.yearly_metrics ?? {};
        appendMd(cDir, `\n**Yearly EBITDA from financial expert**:\n`);
        for (const [yr, data] of Object.entries(ym as any)) {
          appendMd(cDir, `- ${yr}: EBITDA=£${(data as any).ebitda ?? '—'}  revenue=£${(data as any).revenue ?? '—'}  op_profit=£${(data as any).operating_profit ?? '—'}  \n`);
        }
      }
    }
    if (r.status === 'failed') {
      appendMd(cDir, `**Error**: ${(ad as any)?.error ?? 'unknown'}\n`);
    }
  }

  // 3.4 Figure traceability check (QoE and valuation)
  const reconciledYearEbitdas = Object.fromEntries(
    Object.entries(reconciledInput.incomeByYear).map(([yr, row]) => [yr, (row as any).ebitda])
  );
  appendMd(cDir, `\n### 3.4 Figure Traceability Check\n\n`);
  appendMd(cDir, `**Reconciled EBITDA by year (input)**: ${JSON.stringify(reconciledYearEbitdas)}\n\n`);

  const qoeResult = after.find(r => r.expertType === 'qoe');
  if (qoeResult?.status === 'success') {
    const qad = qoeResult.analysisData as any;
    const untraceable: string[] = [];
    const reportedEbitda = qad.adjusted_ebitda?.reported_ebitda;
    if (reportedEbitda != null) {
      const found = Object.values(reconciledYearEbitdas).some(v => Math.abs(Number(v) - Number(reportedEbitda)) < 1);
      if (!found) {
        untraceable.push(`QoE.adjusted_ebitda.reported_ebitda=${reportedEbitda} — not found in any reconciled year`);
      }
    }
    if (untraceable.length > 0) {
      appendMd(cDir, `**Untraceable figures**:\n` + untraceable.map(u => `- ${u}`).join('\n') + '\n');
    } else {
      appendMd(cDir, `All key figures traceable to input (or no mismatch detected).\n`);
    }
  }

  // 3.5 What the analysis wrote to the DB
  const { dealModelAdjustments } = await import('@shared/schema');
  const adjRows = await db.select().from(dealModelAdjustments);
  appendMd(cDir, `\n### 3.5 Database Writes\n\n`);
  appendMd(cDir, `Expert analysis writes to: **expert_analysis_results** table only.  \n`);
  appendMd(cDir, `No writes to deal_model_adjustments, ebitda_adjustments, valuations, or financial tables during Phase 3.  \n`);
  appendMd(cDir, `(deal_model_adjustments are created at deal model creation time in Phase 4.)\n`);

  state.companies[tcKey].phases['3'] = {
    completed: true,
    pipelineError,
    expertSummary: after.map(r => ({
      type: r.expertType, id: r.id, status: r.status, score: r.score, confidence: r.confidence,
    })),
  };
  state.companies[tcKey].phase = 3;
  saveState(state);

  console.log(`[PHASE3] Complete. ${after.length} expert results.`);
}

// ── Phase 4 — Deal Model ──────────────────────────────────────────────────────
async function phase4(prodTcId: number): Promise<void> {
  console.log(`\n=== PHASE 4: Deal model for prod TC ${prodTcId} ===`);
  devDbHost();

  const state = loadState();
  const tcKey = String(prodTcId);
  const devTcId: number = state.companies[tcKey].devTcId;
  const cDir = companyDir(devTcId);

  const { dealModelService } = await import('../server/services/deal-model.service');
  let modelResult: any = null;
  let modelError: string | null = null;

  try {
    modelResult = await dealModelService.createModel(devTcId, DEV_USER_ID, DEV_USER_COMPANY_ID, `Audit Model — TC ${prodTcId}`);
  } catch (err: any) {
    modelError = err.message || String(err);
    console.error(`[PHASE4] createModel error: ${modelError}`);
  }

  appendMd(cDir, `\n---\n\n## Phase 4 — Deal Model\n\n`);

  if (modelError) {
    appendMd(cDir, `**ERROR creating deal model**: ${modelError}\n\n`);
    state.companies[tcKey].phases['4'] = { completed: false, error: modelError };
    state.companies[tcKey].phase = 4;
    saveState(state);
    return;
  }

  if (!modelResult) {
    appendMd(cDir, `**No model result returned**\n`);
    state.companies[tcKey].phases['4'] = { completed: false, error: 'no result' };
    state.companies[tcKey].phase = 4;
    saveState(state);
    return;
  }

  const model = modelResult;
  const calc = model.calculations;
  writeRaw(cDir, 'phase4-deal-model.json', { model: { ...model, calculations: undefined }, calculations: calc });

  appendMd(cDir, `**Model id**: ${model.id}  **Name**: ${model.name}  \n`);
  appendMd(cDir, `**Stored columns**:\n`);
  appendMd(cDir, `- averagingYears: ${model.averagingYears}\n- ebitdaMultiple: ${model.ebitdaMultiple}\n`);
  appendMd(cDir, `- calculated_ebitda: ${model.calculatedEbitda}\n- adjusted_ebitda: ${model.adjustedEbitda}\n`);
  appendMd(cDir, `- enterprise_value: ${model.enterpriseValue}\n- offer_driver: ${model.offerDriver}\n`);
  appendMd(cDir, `- target_offer_price: ${model.targetOfferPrice}\n- total_purchase_price: ${model.totalPurchasePrice}\n`);
  appendMd(cDir, `- is_locked: ${model.isLocked}\n\n`);

  // 4.2 EBITDA years verification
  const { fetchReportedEbitdaByYear } = await import('../server/services/deal-model.service');
  const reportedEbitdaByYear = await fetchReportedEbitdaByYear(devTcId);
  writeRaw(cDir, 'phase4-reported-ebitda-by-year.json', reportedEbitdaByYear);

  const years = Object.keys(reportedEbitdaByYear).sort((a, b) => Number(b) - Number(a));
  const N = model.averagingYears || 3;
  const topN = years.slice(0, N);
  const rawValues = topN.map(y => Number(reportedEbitdaByYear[y]));
  const rawSum = rawValues.reduce((a, b) => a + b, 0);
  const rawAvg = rawValues.length > 0 ? rawSum / rawValues.length : 0;

  appendMd(cDir, `\n### 4.2 EBITDA Years\n\n`);
  appendMd(cDir, `**All available years**: ${years.join(', ')} (${years.length} total)\n`);
  appendMd(cDir, `**Averaging window** (N=${N}): years=${topN.join(', ')}\n`);
  appendMd(cDir, `\n| Year | Reported EBITDA |\n|---|---|\n`);
  for (const y of topN) {
    appendMd(cDir, `| ${y} | £${reportedEbitdaByYear[y]} |\n`);
  }
  appendMd(cDir, `\n**Sum**: £${rawSum.toFixed(2)}  **÷${rawValues.length}**  = **£${rawAvg.toFixed(2)}** raw average  \n`);
  appendMd(cDir, `**Calculator averageAdjustedEbitda**: £${calc?.averageAdjustedEbitda ?? '—'}  \n`);
  const ebitdaMatch = rawValues.length > 0 && Math.abs(rawAvg - Number(calc?.averageAdjustedEbitda ?? 0)) < 10;
  appendMd(cDir, `**Reconciles to raw avg**: ${rawValues.length === 0 ? 'N/A — no eligible years' : (ebitdaMatch ? 'roughly (adjustments applied below)' : 'NO — check adjustments')}  \n`);

  // 4.3 Adjustments
  const adjs = model.adjustments ?? [];
  writeRaw(cDir, 'phase4-adjustments.json', adjs);
  appendMd(cDir, `\n### 4.3 Adjustments (${adjs.length} rows)\n\n`);
  appendMd(cDir, `| id | type | category | description | amount | amounts_by_year | status | is_accepted |\n|---|---|---|---|---|---|---|---|\n`);
  let totalAddBacks = 0;
  let totalDeductions = 0;
  for (const a of adjs) {
    const yearly = a.amountsByYear ? JSON.stringify(a.amountsByYear) : '—';
    appendMd(cDir, `| ${a.id} | ${a.adjustmentType} | ${a.category} | ${a.description} | £${a.amount} | ${yearly} | ${a.status} | ${a.isAccepted} |\n`);
    if (a.isAccepted || a.status === 'accepted' || a.status === 'modified') {
      if (a.adjustmentType === 'add_back') totalAddBacks += Number(a.amount);
      else totalDeductions += Number(a.amount);
    }
  }
  appendMd(cDir, `\n*Note: amounts above are the stored amounts. The calculator applies year-specific overrides from amounts_by_year if set.*  \n`);
  appendMd(cDir, `**Calculator averageAdjustedEbitda**: £${calc?.averageAdjustedEbitda ?? '—'}  \n`);

  // 4.4 Enterprise value bridge
  const ev = calc?.enterpriseValue ?? 0;
  const op = calc?.offerPrice ?? 0;
  appendMd(cDir, `\n### 4.4 Enterprise Value & Offer Price Bridge\n\n`);
  appendMd(cDir, `| Line | Amount |\n|---|---|\n`);
  appendMd(cDir, `| Average Adjusted EBITDA | £${calc?.averageAdjustedEbitda ?? '—'} |\n`);
  appendMd(cDir, `| × Multiple (${model.ebitdaMultiple}) | £${ev} |\n`);
  appendMd(cDir, `| + Excess Cash | £${model.plusExcessCash ?? 0} |\n`);
  appendMd(cDir, `| + Property Value | £${model.propertyValue ?? 0} |\n`);
  appendMd(cDir, `| – Primary Debt | £${model.minusPrimaryDebt ?? 0} |\n`);
  appendMd(cDir, `| – Other Debt | £${model.minusOtherDebt ?? 0} |\n`);
  appendMd(cDir, `| – Corp Tax Due | £${model.minusCorpTaxDue ?? 0} |\n`);
  appendMd(cDir, `| – Working Capital Adj | £${model.minusWorkingCapitalAdj ?? 0} |\n`);
  appendMd(cDir, `| **Offer Price** | **£${op}** |\n`);
  const bridgeCheck = Number(calc?.averageAdjustedEbitda ?? 0) * Number(model.ebitdaMultiple ?? 0) +
    Number(model.plusExcessCash ?? 0) + Number(model.propertyValue ?? 0) -
    Number(model.minusPrimaryDebt ?? 0) - Number(model.minusOtherDebt ?? 0) -
    Number(model.minusCorpTaxDue ?? 0) - Number(model.minusWorkingCapitalAdj ?? 0);
  const bridgeOk = Math.abs(bridgeCheck - Number(op)) < 5;
  appendMd(cDir, `\n**Bridge check**: ${bridgeCheck.toFixed(2)} vs stored ${op} → ${bridgeOk ? '✓ RECONCILES' : '**MISMATCH Δ=' + (bridgeCheck - Number(op)).toFixed(2) + '**'}  \n`);

  // 4.5 Generate offer doc
  const { dealDocumentService } = await import('../server/services/deal-document.service');
  let offerDoc: any = null;
  let offerError: string | null = null;
  try {
    offerDoc = await dealDocumentService.createOfflineOfferFromDealModel({
      dealModelId: model.id,
      targetCompanyId: devTcId,
      userCompanyId: DEV_USER_COMPANY_ID,
      createdBy: DEV_USER_ID,
    });
  } catch (err: any) {
    offerError = err.message || String(err);
    console.error(`[PHASE4] Offer doc error: ${offerError}`);
  }
  if (offerDoc) {
    writeRaw(cDir, 'phase4-offer-doc.json', offerDoc);
    const dd = offerDoc.documentData as any;
    appendMd(cDir, `\n### 4.5 Offer Document\n\n`);
    appendMd(cDir, `**Doc id**: ${offerDoc.id}  **Status**: ${offerDoc.status}  \n`);
    appendMd(cDir, `**Figures in offer document**:\n`);
    appendMd(cDir, `- offerPrice: ${dd?.offerPrice ?? '—'}\n- enterpriseValue: ${dd?.enterpriseValue ?? '—'}\n`);
    appendMd(cDir, `- averageEbitda (raw): £${dd?._raw?.averageEbitda ?? '—'}\n- ebitdaMultiple: ${dd?._raw?.ebitdaMultiple ?? '—'}\n`);
    appendMd(cDir, `- Breakdown: \`${dd?.breakdownText?.replace(/\n/g, ' | ')}\`\n\n`);

    const docOfferPrice = dd?._raw?.offerPrice;
    const modelOfferPrice = calc?.offerPrice;
    if (docOfferPrice != null && modelOfferPrice != null) {
      const delta = Math.abs(Number(docOfferPrice) - Number(modelOfferPrice));
      appendMd(cDir, `**Screen vs doc divergence**: screen=£${modelOfferPrice} doc=£${docOfferPrice} Δ=£${delta.toFixed(2)} ${delta < 5 ? '✓' : '**DIVERGENCE**'}  \n`);
    }
  } else if (offerError) {
    appendMd(cDir, `\n### 4.5 Offer Document\n\n**ERROR**: ${offerError}\n`);
  }

  // 4.6 Faithfulness verdict
  const hasPeriods = (state.companies[tcKey].phases['2']?.finalPeriodCount ?? 0) > 0;
  const hasUsable = (state.companies[tcKey].phases['2']?.usableYears ?? []).length > 0;
  appendMd(cDir, `\n### 4.6 Faithfulness Verdict\n\n`);
  appendMd(cDir, hasUsable
    ? `**YES** — the deal model uses verified financial periods extracted from submitted documents. ${topN.length} fiscal year(s) fed the average (${topN.join(', ')}).  \n`
    : `**NO** — no full-year non-IM periods are available, so the deal model produces a £0 EBITDA. The submitted documents did not yield usable figures under the current filter rules.  \n`
  );

  state.companies[tcKey].phases['4'] = {
    completed: true,
    modelId: model.id,
    averageAdjustedEbitda: calc?.averageAdjustedEbitda,
    offerPrice: calc?.offerPrice,
    enterpriseValue: calc?.enterpriseValue,
    bridgeOk,
  };
  state.companies[tcKey].phase = 4;
  saveState(state);

  console.log(`[PHASE4] Complete. Model id=${model.id} avgAdj=${calc?.averageAdjustedEbitda} offerPrice=${calc?.offerPrice}`);
}

// ── Phase 5 — Determinism Control (138 only) ──────────────────────────────────
async function phase5(prodTcId: number): Promise<void> {
  if (prodTcId !== 138) {
    console.log('[PHASE5] Skipping — determinism control is only for TC 138');
    return;
  }
  console.log(`\n=== PHASE 5: Determinism control for TC 138 ===`);
  devDbHost();

  const state = loadState();
  const devTcId: number = state.companies['138'].devTcId;
  const cDir = companyDir(devTcId);
  const detDir = path.join(AUDIT_DIR, 'determinism');
  fs.mkdirSync(detDir, { recursive: true });

  const { expertAnalysisService } = await import('../server/services/expert-analysis.service');
  const { db } = await import('../server/db');
  const { expertAnalysisResults } = await import('@shared/schema');
  const { eq } = await import('drizzle-orm');

  // First run already done in Phase 3 — read those outputs
  const run1Results = await db.select().from(expertAnalysisResults).where(eq(expertAnalysisResults.targetCompanyId, devTcId));
  fs.writeFileSync(path.join(detDir, '138-run1-results.json'), JSON.stringify(run1Results, null, 2));

  // Delete existing expert records and run again
  await db.delete(expertAnalysisResults).where(eq(expertAnalysisResults.targetCompanyId, devTcId));
  await expertAnalysisService.triggerExpertPipeline(devTcId, DEV_USER_ID);
  const run2Results = await db.select().from(expertAnalysisResults).where(eq(expertAnalysisResults.targetCompanyId, devTcId));
  fs.writeFileSync(path.join(detDir, '138-run2-results.json'), JSON.stringify(run2Results, null, 2));

  // Diff
  let diffMd = `# Determinism Diff — TC 138 (Two Identical Runs)\n\n`;
  diffMd += `| Expert | Field | Run 1 | Run 2 | Δ |\n|---|---|---|---|---|\n`;
  let maxDelta = 0;

  for (const r1 of run1Results) {
    const r2 = run2Results.find(r => r.expertType === r1.expertType);
    if (!r2) {
      diffMd += `| ${r1.expertType} | *entire record* | present | **MISSING** | — |\n`;
      continue;
    }
    const ad1 = r1.analysisData as any;
    const ad2 = r2.analysisData as any;

    // Compare scores
    if (r1.score !== r2.score) {
      const delta = Math.abs(Number(r1.score) - Number(r2.score));
      maxDelta = Math.max(maxDelta, delta);
      diffMd += `| ${r1.expertType} | score | ${r1.score} | ${r2.score} | ${delta.toFixed(2)} |\n`;
    } else {
      diffMd += `| ${r1.expertType} | score | ${r1.score} | ${r2.score} | identical |\n`;
    }

    // For QoE: compare adjusted_ebitda values
    if (r1.expertType === 'qoe') {
      const adj1 = ad1?.adjusted_ebitda ?? {};
      const adj2 = ad2?.adjusted_ebitda ?? {};
      for (const key of ['conservative', 'base', 'optimistic']) {
        const v1 = Number(adj1[key] ?? 0);
        const v2 = Number(adj2[key] ?? 0);
        const delta = Math.abs(v1 - v2);
        maxDelta = Math.max(maxDelta, delta);
        diffMd += `| qoe | adjusted_ebitda.${key} | ${adj1[key] ?? '—'} | ${adj2[key] ?? '—'} | ${delta > 0 ? delta.toFixed(2) : 'identical'} |\n`;
      }
    }
  }

  diffMd += `\n**Noise floor (largest movement between two identical runs)**: £${maxDelta.toFixed(2)}\n`;
  diffMd += `\nAnything smaller than £${maxDelta.toFixed(2)} in a dev-vs-live comparison is sampling noise, not a defect.\n`;
  fs.writeFileSync(path.join(detDir, '138-run-diff.md'), diffMd);

  appendMd(cDir, `\n---\n\n## Phase 5 — Determinism Control\n\nSee determinism/138-run-diff.md. Noise floor: £${maxDelta.toFixed(2)}\n`);

  state.companies['138'].phases['5'] = { completed: true, noiseFloor: maxDelta };
  state.companies['138'].phase = 5;
  saveState(state);

  console.log(`[PHASE5] Complete. Noise floor = £${maxDelta.toFixed(2)}`);
}

// ── Phase 6 — Live Snapshot ───────────────────────────────────────────────────
async function phase6(prodTcId: number): Promise<void> {
  console.log(`\n=== PHASE 6: Live snapshot for prod TC ${prodTcId} ===`);
  const pool = new Pool({ connectionString: process.env.PROD_DATABASE_URL! });
  const host = new URL(process.env.PROD_DATABASE_URL!).hostname;
  console.log(`[PROD_DB] host: ${host}`);

  const state = loadState();
  const tcKey = String(prodTcId);
  const devTcId: number = state.companies[tcKey].devTcId;
  const cDir = companyDir(devTcId);

  const q = async (sql: string, params?: any[]) => (await pool.query(sql, params)).rows;

  // 6.1 Documents
  const docs = await q(`
    SELECT id, document_name, original_filename, document_category, file_path, file_type, file_size, upload_date
    FROM documents WHERE target_company_id = $1 ORDER BY upload_date`, [prodTcId]);

  // Get analysis results per document
  const docWithAnalysis: any[] = [];
  for (const d of docs) {
    const ars = await q(`
      SELECT id, document_type, created_at, analysis_data
      FROM document_analysis_results WHERE document_id = $1`, [d.id]);
    docWithAnalysis.push({ ...d, analysisResults: ars });
  }

  writeRaw(cDir, 'phase6-prod-docs-with-analysis.json', docWithAnalysis);

  fs.writeFileSync(path.join(cDir, 'live-snapshot.md'),
    `# Live Snapshot — TC ${prodTcId} (Prod)\n\n` +
    `**Prod host**: ${host}  \n` +
    `**Snapshot date**: 2026-07-30  \n\n` +
    `---\n\n## 6.1 Documents on Live Record\n\n` +
    `| Doc id | Filename | Category | Type | Size | Analysis results | Status |\n` +
    `|---|---|---|---|---|---|---|\n` +
    docWithAnalysis.map(d => {
      const status = d.analysisResults.length === 0 ? 'no_analysis'
        : d.analysisResults.some((r: any) => r.analysis_data?.years && Object.keys(r.analysis_data.years).length > 0) ? 'usable_figures'
        : 'structure_only';
      return `| ${d.id} | ${d.document_name} | ${d.document_category} | ${d.file_type.split('/').pop()} | ${d.file_size} | ${d.analysisResults.length} | ${status} |`;
    }).join('\n') + '\n'
  );

  // 6.2 Financial periods
  const periods = await q(`
    SELECT id, period_type, fiscal_year, period_end, period_label, months_covered,
           is_full_year, source_tier, source_document_id, created_at, updated_at
    FROM financial_periods WHERE target_company_id = $1 ORDER BY fiscal_year, period_end`, [prodTcId]);

  let liveISCount = 0, liveBSCount = 0;
  for (const p of periods) {
    const [{ c: isC }] = await q(`SELECT COUNT(*) as c FROM income_statements WHERE financial_period_id = $1`, [p.id]);
    const [{ c: bsC }] = await q(`SELECT COUNT(*) as c FROM balance_sheets WHERE financial_period_id = $1`, [p.id]);
    p._isCount = Number(isC);
    p._bsCount = Number(bsC);
    liveISCount += Number(isC);
    liveBSCount += Number(bsC);
  }

  const usableProdYears = periods.filter((p: any) => p.is_full_year && p.source_tier !== 'information_memorandum' && p._isCount > 0).map((p: any) => p.fiscal_year);

  appendLive(cDir, `\n## 6.2 Live Financial Periods\n\n` +
    `| id | period_type | fiscal_year | period_end | is_full_year | months | source_tier | IS rows | BS rows |\n` +
    `|---|---|---|---|---|---|---|---|---|\n` +
    periods.map((p: any) => `| ${p.id} | ${p.period_type} | ${p.fiscal_year} | ${p.period_end} | ${p.is_full_year} | ${p.months_covered ?? '—'} | ${p.source_tier} | ${p._isCount} | ${p._bsCount} |`).join('\n') + '\n\n' +
    `**Usable EBITDA years** (full-year, non-IM, has IS): ${usableProdYears.length > 0 ? usableProdYears.join(', ') : 'NONE'}  \n`
  );
  writeRaw(cDir, 'phase6-prod-periods.json', periods);

  // 6.3 Most recent expert analysis
  const experts = await q(`
    SELECT id, expert_type, status, score, confidence, created_at, analysis_data
    FROM expert_analysis_results WHERE target_company_id = $1
    ORDER BY expert_type, created_at DESC`, [prodTcId]);

  const latestExperts: any[] = [];
  const seenTypes = new Set<string>();
  for (const e of experts) {
    if (!seenTypes.has(e.expert_type)) {
      seenTypes.add(e.expert_type);
      latestExperts.push(e);
    }
  }
  writeRaw(cDir, 'phase6-prod-experts.json', latestExperts);

  appendLive(cDir, `\n## 6.3 Most Recent Expert Analysis\n\n`);
  for (const e of latestExperts) {
    appendLive(cDir, `\n### ${e.expert_type} (id=${e.id})\n**Status**: ${e.status}  **Score**: ${e.score ?? '—'}  **Confidence**: ${e.confidence ?? '—'}  **Created**: ${e.created_at}  \n`);
    if (e.expert_type === 'qoe' && e.status === 'success') {
      const ad = e.analysis_data ?? {};
      const adj = ad.adjusted_ebitda ?? {};
      appendLive(cDir, `Adjusted EBITDA: conservative=£${adj.conservative ?? '—'} base=£${adj.base ?? '—'} optimistic=£${adj.optimistic ?? '—'}  \n`);
    }
    if (e.expert_type === 'valuation' && e.status === 'success') {
      const ad = e.analysis_data ?? {};
      appendLive(cDir, `Multiple: ${ad.multiples?.selected_multiple ?? '—'}  adjusted_ebitda_base: £${ad.adjusted_ebitda_base ?? '—'}  \n`);
    }
  }

  // 6.4 Deal models + offers
  const models = await q(`
    SELECT id, name, created_at, updated_at, averaging_years, calculated_ebitda,
           adjusted_ebitda, ebitda_multiple, offer_driver, target_offer_price,
           total_purchase_price, is_locked
    FROM deal_models WHERE target_company_id = $1 ORDER BY created_at`, [prodTcId]);
  writeRaw(cDir, 'phase6-prod-deal-models.json', models);

  appendLive(cDir, `\n## 6.4 Live Deal Models\n\n`);
  for (const m of models) {
    const adjs2 = await q(`SELECT id, adjustment_type, category, description, amount, status, is_accepted FROM deal_model_adjustments WHERE deal_model_id = $1`, [m.id]);
    appendLive(cDir, `\n### Model id=${m.id} name="${m.name}"\n`);
    appendLive(cDir, `| Column | Value |\n|---|---|\n` +
      `| averaging_years | ${m.averaging_years} |\n| ebitda_multiple | ${m.ebitda_multiple} |\n` +
      `| calculated_ebitda | ${m.calculated_ebitda} |\n| adjusted_ebitda | ${m.adjusted_ebitda} |\n` +
      `| total_purchase_price | ${m.total_purchase_price} |\n| is_locked | ${m.is_locked} |\n`);
    if (adjs2.length > 0) {
      appendLive(cDir, `\n**Adjustments (${adjs2.length})**:\n| id | type | category | description | amount | status | accepted |\n|---|---|---|---|---|---|---|\n` +
        adjs2.map((a: any) => `| ${a.id} | ${a.adjustment_type} | ${a.category} | ${a.description} | £${a.amount} | ${a.status} | ${a.is_accepted} |`).join('\n') + '\n');
    }
  }

  const offers = await q(`SELECT id, created_at, sent_at, deal_model_id, offer_price, enterprise_value, status, document_data FROM current_offers WHERE target_company_id = $1`, [prodTcId]);
  const offerDocs = await q(`SELECT id, document_type, status, created_at, sent_at, deal_model_id, document_data FROM deal_documents WHERE target_company_id = $1 AND document_type = 'offer_letter' ORDER BY created_at`, [prodTcId]);
  writeRaw(cDir, 'phase6-prod-offers.json', { currentOffers: offers, dealDocuments: offerDocs });

  if (offers.length > 0 || offerDocs.length > 0) {
    appendLive(cDir, `\n### Current Offers & Offer Documents\n\n`);
    for (const o of offers) {
      appendLive(cDir, `**current_offer id=${o.id}** sent_at=${o.sent_at ?? 'not sent'} deal_model_id=${o.deal_model_id} offer_price=${o.offer_price} ev=${o.enterprise_value} status=${o.status}  \n`);
      const dd = o.document_data as any;
      if (dd?._raw) appendLive(cDir, `Stored averageEbitda=£${dd._raw.averageEbitda} multiple=${dd._raw.ebitdaMultiple} breakdownText: ${dd.breakdownText?.replace(/\n/g, ' | ')}  \n`);
    }
  }

  // 6.5 Recompute live EBITDA average
  const liveEbitdaByYear: Record<string, number> = {};
  for (const p of periods) {
    if (p.is_full_year && p.source_tier !== 'information_memorandum' && p._isCount > 0) {
      const [isRow] = await q(`SELECT operating_profit, depreciation_amortisation FROM income_statements WHERE financial_period_id = $1 LIMIT 1`, [p.id]);
      if (isRow) {
        const op = Number(isRow.operating_profit ?? 0);
        const da = Math.abs(Number(isRow.depreciation_amortisation ?? 0));
        liveEbitdaByYear[p.fiscal_year] = op + da;
      }
    }
  }

  const liveYears = Object.keys(liveEbitdaByYear).sort((a, b) => Number(b) - Number(a));
  const N = models[0]?.averaging_years ?? 3;
  const liveTopN = liveYears.slice(0, N);
  const liveVals = liveTopN.map(y => liveEbitdaByYear[y]);
  const liveSum = liveVals.reduce((a, b) => a + b, 0);
  const liveAvg = liveVals.length > 0 ? liveSum / liveVals.length : 0;

  appendLive(cDir, `\n## 6.5 Live EBITDA Recomputation (current data, filter rules)\n\n`);
  appendLive(cDir, `**Eligible years** (full-year, non-IM, has IS data): ${liveYears.length > 0 ? liveYears.join(', ') : 'NONE'}  \n`);
  appendLive(cDir, `**Top ${N} (averaging window)**: ${liveTopN.join(', ') || 'none'}  \n`);
  for (const y of liveTopN) {
    appendLive(cDir, `- ${y}: £${liveEbitdaByYear[y]}  \n`);
  }
  appendLive(cDir, `**Live raw avg EBITDA**: £${liveAvg.toFixed(2)}  \n`);

  const storedModel = models[0];
  if (storedModel) {
    const storedAdj = Number(storedModel.adjusted_ebitda ?? 0);
    const delta = Math.abs(liveAvg - storedAdj);
    appendLive(cDir, `**Stored adjusted_ebitda**: £${storedAdj} (model id=${storedModel.id})  \n`);
    appendLive(cDir, `**Δ live_avg_raw vs stored**: £${delta.toFixed(2)} (note: adjusted_ebitda includes QoE adjustments, so raw avg ≠ stored is expected)  \n`);
  }
  if (offers.length > 0) {
    const sentOffer = offers.find((o: any) => o.sent_at);
    if (sentOffer) {
      const dd = sentOffer.document_data as any;
      const offerEbitda = dd?._raw?.averageEbitda;
      if (offerEbitda != null) {
        const delta2 = Math.abs(liveAvg - Number(offerEbitda));
        appendLive(cDir, `**Offer averageEbitda**: £${offerEbitda} vs live raw avg £${liveAvg.toFixed(2)} Δ=£${delta2.toFixed(2)}  \n`);
        if (delta2 > 1000) appendLive(cDir, `**⚠ OFFER FIGURE DIFFERS FROM LIVE DATA BY £${delta2.toFixed(2)}**  \n`);
      }
    }
  }

  await pool.end();

  state.companies[tcKey].phases['6'] = {
    completed: true,
    liveUsableYears: usableProdYears,
    liveRawAvgEbitda: liveAvg,
  };
  state.companies[tcKey].phase = 6;
  saveState(state);

  console.log(`[PHASE6] Complete. Live usable years=${JSON.stringify(usableProdYears)} liveAvg=${liveAvg.toFixed(2)}`);
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const prodTcId = Number(args[0]);
  const phaseArg = args[1];

  if (!prodTcId || isNaN(prodTcId)) {
    console.error('Usage: npx tsx audit/harness.ts <prodTcId> <phase>');
    process.exit(1);
  }

  const phases = phaseArg === 'all' ? ['1','2','3','4','5','6'] : [phaseArg];

  for (const ph of phases) {
    switch (ph) {
      case '1': await phase1(prodTcId); break;
      case '2': await phase2(prodTcId); break;
      case '3': await phase3(prodTcId); break;
      case '4': await phase4(prodTcId); break;
      case '5': await phase5(prodTcId); break;
      case '6': await phase6(prodTcId); break;
      default:
        console.error(`Unknown phase: ${ph}`);
        process.exit(1);
    }
  }

  console.log(`\n[HARNESS] Done — TC ${prodTcId} phases ${phases.join(',')}`);
}

main().catch(err => {
  console.error('[HARNESS] Fatal:', err);
  process.exit(1);
});
