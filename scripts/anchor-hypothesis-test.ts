/**
 * scripts/anchor-hypothesis-test.ts
 * ANCHOR-TEST — tests which part of the 1c P&L prompt causes the FY2023
 * depreciation_amortisation value to shift from 10,824 to 51,910 for doc 5830.
 *
 * WRITES NOTHING to any database table. No INSERT, UPDATE, DELETE, or ALTER.
 * READ-ONLY on the database (document row lookup + row-count checks only).
 *
 * Three prompt variants (held as strings inside this script; server/prompts is NOT edited):
 *   VARIANT A — pre-1c prompt text from commit 46f60e3 (2026-07-17), pasted verbatim.
 *   VARIANT B — current 1c prompt, obtained at runtime via buildProfitAndLossAnalysisPrompt().
 *   VARIANT C — variant B with ONLY the FIGURE ANCHORS block removed.
 *
 * geminiClient.generateContent is called directly (not analyzeDocumentWithGemini)
 * because the prompt must be overridden per variant. The same options the step-2
 * path uses are replicated: temperature 0, responseMimeType application/json,
 * thinkingLevel MINIMAL, base64 inline data for the PDF.
 *
 * Usage (one command per variant):
 *   npx tsx scripts/anchor-hypothesis-test.ts --variant=A --runs=5
 *   npx tsx scripts/anchor-hypothesis-test.ts --variant=B --runs=5
 *   npx tsx scripts/anchor-hypothesis-test.ts --variant=C --runs=5
 *
 * Document fixed: 5830 (profit_and_loss only, per spec).
 * Report appended to: docs/pipeline-fidelity-fix/anchor-hypothesis-2026-08-09.txt
 */

import { db } from '../server/db';
import { sql } from 'drizzle-orm';
import { geminiClient } from '../server/services/gemini-client';
import { buildProfitAndLossAnalysisPrompt } from '../server/prompts/step2-profit-and-loss-prompt';
import { fileStorageService } from '../server/services/file-storage.service';
import fs from 'fs/promises';
import path from 'path';

// ─── Arg parsing ──────────────────────────────────────────────────────────────

const variantArg = process.argv.find((a) => a.startsWith('--variant='))?.slice('--variant='.length);
const runsArg    = process.argv.find((a) => a.startsWith('--runs='))?.slice('--runs='.length);

if (!variantArg || !runsArg) {
  console.error('Usage: npx tsx scripts/anchor-hypothesis-test.ts --variant=A|B|C --runs=<N>');
  process.exit(1);
}

const VARIANT = variantArg as 'A' | 'B' | 'C';
const N_RUNS  = parseInt(runsArg, 10);

if (!['A', 'B', 'C'].includes(VARIANT)) {
  console.error('--variant must be A, B, or C');
  process.exit(1);
}
if (isNaN(N_RUNS) || N_RUNS < 1) {
  console.error('--runs must be a positive integer');
  process.exit(1);
}

const DOC_ID   = 5830;
const DOC_TYPE = 'profit_and_loss' as const;

// ─── VARIANT A — pre-1c prompt from commit 46f60e3 (2026-07-17) ──────────────
// Pasted verbatim from:
//   git show 46f60e3:server/prompts/step2-profit-and-loss-prompt.ts
// Confirmed: grep -c "FIGURE ANCHORS"=0, "anchors"=0, "period_start"=0, "identity"=0

const VARIANT_A_PROMPT = `ROLE
You are a financial analysis AI specialising in company financial performance assessment for CEOs, investors, and business buyers.
You will be provided with the full Profit and Loss statements of a company for multiple consecutive financial years, in text or structured form.

YOUR TASK (TWO STAGES)

STAGE 1 \u2014 DATA EXTRACTION & CALCULATION

1. Identify the financial years covered
\u2022 Extract all consecutive financial years present (e.g. 2022, 2023, 2024).
\u2022 Identify the period end dates if shown (e.g., "31 March 2024").
\u2022 months_covered: for each year, the number of months the reported period covers, as an integer. A full statutory year is 12. Management accounts or year-to-date figures covering a partial year must state the actual months (e.g. April-only accounts = 1, January to May = 5). If the document states the period (e.g. 'for the period 1 April 2026 to 30 April 2026'), derive months from it. If genuinely unstated, omit that year from months_covered.
\u2022 report_date: the date this document was generated, prepared, or printed \u2014 e.g. "Prepared 8 September 2025" or a footer date. Extract as ISO format YYYY-MM-DD. Set to null if no such date is visible in the document.

2. Extract the following Profit & Loss fields for each year
Only extract or calculate numeric values:
\u2022 No \u00a3 symbols
\u2022 No commas
\u2022 No text
Use null if a value is missing or cannot be calculated.

Profit & Loss Fields
\u2022 revenue (turnover)
\u2022 cost_of_sales
\u2022 gross_profit
\u2022 administrative_expenses (total figure)
\u2022 depreciation_amortisation (usually in notes, extract if available)
\u2022 other_operating_income
\u2022 operating_profit
\u2022 interest_receivable
\u2022 interest_payable
\u2022 profit_before_tax
\u2022 corporation_tax (tax charge)
\u2022 net_profit

3. Extract cost breakdowns if available in the document
Revenue Breakdown (if available by product/service line or customer segment)
Cost of Sales Breakdown:
\u2022 direct_materials
\u2022 direct_labour
\u2022 subcontractor_costs
\u2022 other_direct_costs

Overheads/Administrative Expenses Breakdown (extract ALL that appear):
\u2022 staff_wages_salaries (employee wages/salaries excluding directors)
\u2022 directors_salaries
\u2022 directors_pension
\u2022 employers_national_insurance
\u2022 staff_pension_contributions
\u2022 staff_training_recruitment
\u2022 use_of_home_as_office
\u2022 rent_rates (office rent, business rates)
\u2022 utilities (heat, light, power)
\u2022 insurance
\u2022 accountancy_bookkeeping
\u2022 professional_fees (legal, consultancy)
\u2022 software_subscriptions
\u2022 computer_costs
\u2022 it_support_hosting
\u2022 telecommunications (phone, internet)
\u2022 printing_stationery
\u2022 postage_courier
\u2022 subscriptions_memberships
\u2022 bank_charges
\u2022 advertising_marketing
\u2022 travel_subsistence
\u2022 motor_expenses
\u2022 repairs_maintenance
\u2022 depreciation
\u2022 amortisation
\u2022 other_overheads

Also extract separately for direct SQL access:
\u2022 total_staff_costs (sum of all staff-related costs excluding directors)
\u2022 total_directors_remuneration (directors salaries + pension + NI)
\u2022 dividends_paid (if shown in detailed P&L or notes)

4. Calculate the following financial ratios per year
(Do NOT assume they are provided \u2014 calculate them yourself if possible)
Use percentages as numbers (e.g. 72.4, not "72.4%").

\u2022 gross_margin_percent
(gross_profit / revenue) \u00d7 100

\u2022 net_margin_percent
(net_profit / revenue) \u00d7 100

\u2022 interest_coverage_ratio
(operating_profit / interest_payable)
  \u25e6 If interest_payable is 0 or missing \u2192 null

STAGE 2 \u2014 EXECUTIVE FINANCIAL SUMMARY
Using only the extracted and calculated data above:

5. Analyse year-on-year changes, focusing on:
\u2022 Revenue growth or decline
\u2022 Gross profit and gross margin movement
\u2022 Net profit movement
\u2022 Financial resilience (interest coverage, if available)

6. Write 5\u20138 concise bullet points:
\u2022 Use professional British English
\u2022 Suitable for a CEO, investor, or buyer
\u2022 Quantify % movements where meaningful
\u2022 Highlight:
  \u25e6 Positive trends (e.g. margin expansion, improved profitability)
  \u25e6 Red flags (e.g. margin compression, declining revenues)
\u2022 Treat movements over \u00b13% as significant

STRICT OUTPUT REQUIREMENTS
\u2022 Return ONLY valid JSON
\u2022 No commentary, markdown, emojis, or explanatory text outside the JSON
\u2022 Output must begin with { and end with }

FINAL OUTPUT FORMAT
{
  "document": "profit_and_loss",
  "source": "statutory",
  "years_covered": [2022, 2023, 2024],
  "period_ends": {
    "2022": "2022-03-31",
    "2023": "2023-03-31",
    "2024": "2024-03-31"
  },
  "months_covered": {
    "2022": 12,
    "2023": 12,
    "2024": 12
  },
  "report_date": null,
  "years": {
    "2022": {
      "year": 2022,
      "profit_and_loss": {
        "revenue": null,
        "cost_of_sales": null,
        "gross_profit": null,
        "administrative_expenses": null,
        "depreciation_amortisation": null,
        "other_operating_income": null,
        "operating_profit": null,
        "interest_receivable": null,
        "interest_payable": null,
        "profit_before_tax": null,
        "corporation_tax": null,
        "net_profit": null
      },
      "revenue_breakdown": {
        "by_product": {},
        "by_segment": {}
      },
      "cost_of_sales_breakdown": {
        "direct_materials": null,
        "direct_labour": null,
        "subcontractor_costs": null,
        "other_direct_costs": null
      },
      "overheads_breakdown": {
        "staff_wages_salaries": null,
        "directors_salaries": null,
        "directors_pension": null,
        "employers_national_insurance": null,
        "staff_pension_contributions": null,
        "staff_training_recruitment": null,
        "use_of_home_as_office": null,
        "rent_rates": null,
        "utilities": null,
        "insurance": null,
        "accountancy_bookkeeping": null,
        "professional_fees": null,
        "software_subscriptions": null,
        "computer_costs": null,
        "it_support_hosting": null,
        "telecommunications": null,
        "printing_stationery": null,
        "postage_courier": null,
        "subscriptions_memberships": null,
        "bank_charges": null,
        "advertising_marketing": null,
        "travel_subsistence": null,
        "motor_expenses": null,
        "repairs_maintenance": null,
        "depreciation": null,
        "amortisation": null,
        "other_overheads": null
      },
      "total_staff_costs": null,
      "total_directors_remuneration": null,
      "dividends_paid": null,
      "exceptional_items": [],
      "financial_ratios": {
        "gross_margin_percent": null,
        "net_margin_percent": null,
        "interest_coverage_ratio": null
      }
    }
  },
  "summary_insights": [
    "Revenue increased year-on-year, indicating sustained top-line growth.",
    "Gross margin improved materially, suggesting enhanced cost efficiency.",
    "Net profitability strengthened despite higher administrative expenses.",
    "Interest coverage remains robust, reflecting low financial risk.",
    "Overall financial performance shows improving operational resilience."
  ]
}`;

// ─── FIGURE ANCHORS block — the exact text removed in VARIANT C ───────────────
// Removed from the line "FIGURE ANCHORS" up to and including the blank line
// before "STRICT OUTPUT REQUIREMENTS". Nothing else in VARIANT B is changed.

const FIGURE_ANCHORS_BLOCK = `FIGURE ANCHORS
For every figure you extract in the years object (not calculated ratios), add an entry to a top-level anchors object.
The key is the figure's exact path in the output JSON, e.g. years.2024.profit_and_loss.revenue.
The value is: { "page": <1-based page number where the figure is printed>, "label": "<the row label exactly as printed, e.g. Turnover>" }
If the page cannot be determined, set page to null. If the label cannot be determined, set label to null.
Do NOT create anchors for financial_ratios entries or for any value you calculated rather than read.
Never invent a page number or a label.

`;

// ─── GROUP A P&L field suffixes (same list as STABILITY-1) ───────────────────

const GROUP_A_PL_FIELDS = [
  'revenue',
  'cost_of_sales',
  'gross_profit',
  'administrative_expenses',
  'depreciation_amortisation',
  'other_operating_income',
  'operating_profit',
  'interest_receivable',
  'interest_payable',
  'profit_before_tax',
  'corporation_tax',
  'net_profit',
] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function safeNum(v: unknown): string {
  if (v === null || v === undefined) return 'null';
  return String(v);
}

function getYears(payload: Record<string, unknown>): string[] {
  const yearsObj = payload['years'];
  if (!yearsObj || typeof yearsObj !== 'object') return [];
  return Object.keys(yearsObj as object).sort();
}

function getPLField(payload: Record<string, unknown>, year: string, field: string): string {
  const yearsObj = payload['years'] as Record<string, unknown> | undefined;
  if (!yearsObj) return 'null';
  const yearObj = yearsObj[year] as Record<string, unknown> | undefined;
  if (!yearObj) return 'null';
  const pl = yearObj['profit_and_loss'] as Record<string, unknown> | undefined;
  if (!pl) return 'null';
  return safeNum(pl[field]);
}

function getAnchor(payload: Record<string, unknown>, key: string): { page: unknown; label: unknown } | null {
  const anchors = payload['anchors'] as Record<string, unknown> | undefined;
  if (!anchors) return null;
  const entry = anchors[key] as { page?: unknown; label?: unknown } | undefined;
  if (!entry) return null;
  return { page: entry.page ?? null, label: entry.label ?? null };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const reportPath = path.join(
    process.cwd(),
    'docs',
    'pipeline-fidelity-fix',
    'anchor-hypothesis-2026-08-09.txt',
  );

  const reportLines: string[] = [];
  const log = (s: string = '') => {
    process.stdout.write(s + '\n');
    reportLines.push(s);
  };

  // ── Build prompts ──────────────────────────────────────────────────────────
  const variantB = buildProfitAndLossAnalysisPrompt();
  if (!variantB.includes('FIGURE ANCHORS')) {
    console.error('ABORT: VARIANT B (current prompt) does not contain "FIGURE ANCHORS". Check prompt file.');
    process.exit(1);
  }

  const variantC = variantB.replace(FIGURE_ANCHORS_BLOCK, '');
  if (variantC.includes('FIGURE ANCHORS')) {
    console.error('ABORT: VARIANT C still contains "FIGURE ANCHORS" after removal. String mismatch — check FIGURE_ANCHORS_BLOCK constant.');
    process.exit(1);
  }

  const prompts: Record<'A' | 'B' | 'C', string> = {
    A: VARIANT_A_PROMPT,
    B: variantB,
    C: variantC,
  };

  const activePrompt = prompts[VARIANT];

  // ── Lookup document row ────────────────────────────────────────────────────
  const docRows = await db.execute<{
    id: number;
    file_path: string;
    original_filename: string;
  }>(sql`
    SELECT id, file_path, original_filename
    FROM documents
    WHERE id = ${DOC_ID}
    LIMIT 1
  `);

  if (docRows.rows.length === 0) {
    console.error(`Document ${DOC_ID} not found`);
    process.exit(1);
  }

  const doc = docRows.rows[0];
  const filePath = doc.file_path;
  const fileName = doc.original_filename;
  const mimeType = 'application/pdf'; // doc 5830 confirmed PDF

  // ── Pre-run row counts ─────────────────────────────────────────────────────
  const counts0 = await db.execute<{ tbl: string; cnt: string }>(sql`
    SELECT 'document_analysis_results' AS tbl, COUNT(*)::text AS cnt FROM document_analysis_results
    UNION ALL
    SELECT 'document_evidence',         COUNT(*)::text FROM document_evidence
    UNION ALL
    SELECT 'document_evidence_period',  COUNT(*)::text FROM document_evidence_period
    UNION ALL
    SELECT 'document_evidence_figure',  COUNT(*)::text FROM document_evidence_figure
  `);
  const preRunCounts = new Map(counts0.rows.map((r) => [r.tbl, r.cnt]));

  // ── Header ─────────────────────────────────────────────────────────────────
  log('='.repeat(72));
  log(`ANCHOR-TEST REPORT`);
  log(`doc_id:    ${DOC_ID}`);
  log(`type:      ${DOC_TYPE}`);
  log(`variant:   ${VARIANT}`);
  log(`runs:      ${N_RUNS}`);
  log(`filePath:  ${filePath}`);
  log(`fileName:  ${fileName}`);
  log(`mimeType:  ${mimeType}`);
  log(`started:   ${new Date().toISOString()}`);
  log('='.repeat(72));
  log();

  if (VARIANT === 'C') {
    log('FIGURE ANCHORS BLOCK REMOVED FROM VARIANT C (exact text):');
    log('─'.repeat(72));
    // Print each line of the removed block with a leading pipe so it is visually distinct
    for (const l of FIGURE_ANCHORS_BLOCK.split('\n')) {
      log(`  | ${l}`);
    }
    log('─'.repeat(72));
    log();
  }

  // ── Read file from R2 once (same across all runs) ─────────────────────────
  console.log(`[ANCHOR-TEST] Reading file from storage: ${filePath}`);
  const fileBuffer = await fileStorageService.download(filePath);
  if (!fileBuffer || fileBuffer.length === 0) {
    console.error(`[ANCHOR-TEST] Failed to download file: ${filePath}`);
    process.exit(1);
  }
  const base64Data = fileBuffer.toString('base64');
  console.log(`[ANCHOR-TEST] File read OK, ${fileBuffer.length} bytes`);
  log(`fileBytes:  ${fileBuffer.length}`);
  log();

  // ── Per-run accumulator ───────────────────────────────────────────────────
  // Key: `${year}|${field}` → values across runs
  const groupAAccum = new Map<string, (string)[]>();
  // Anchors for VARIANT B only: key → { page, label } per run
  const anchorAccumDA23 = [] as Array<{ page: unknown; label: unknown } | null>;
  const anchorAccumDA24 = [] as Array<{ page: unknown; label: unknown } | null>;

  // ── N sequential runs ──────────────────────────────────────────────────────
  for (let run = 1; run <= N_RUNS; run++) {
    log(`────────────────────────────────────────────────────────────────`);
    log(`RUN ${run}/${N_RUNS}  started: ${new Date().toISOString()}`);

    const startTime = Date.now();

    let payload: Record<string, unknown> | null = null;
    let modelUsed: string | null = null;

    try {
      const response = await geminiClient.generateContent({
        prompt: activePrompt,
        temperature: 0,
        responseMimeType: 'application/json',
        thinkingLevel: 'MINIMAL',
        inlineData: { mimeType, data: base64Data },
        service: `anchor_test_variant_${VARIANT}`,
      });

      const elapsed = Date.now() - startTime;
      modelUsed = (response as { model?: string }).model ?? 'unknown';
      console.log(`[ANCHOR-TEST] RUN ${run}: response ${response.text.length} chars, ${elapsed}ms`);
      log(`RUN ${run}: OK  elapsed=${elapsed}ms`);

      if (response.json) {
        payload = response.json as Record<string, unknown>;
      } else {
        log(`RUN ${run}: WARN — response.json is null (raw: ${response.text.slice(0, 200)})`);
      }
    } catch (err: unknown) {
      const elapsed = Date.now() - startTime;
      log(`RUN ${run}: ERROR  elapsed=${elapsed}ms  err=${String(err)}`);
    }

    if (!payload) {
      // Back-fill nulls so run counts stay aligned
      for (const [, arr] of groupAAccum) arr.push('ERROR');
      anchorAccumDA23.push(null);
      anchorAccumDA24.push(null);
      continue;
    }

    // Extract GROUP A values for each year found in the response
    const years = getYears(payload);
    for (const yr of years) {
      for (const field of GROUP_A_PL_FIELDS) {
        const key = `${yr}|${field}`;
        const val = getPLField(payload, yr, field);
        if (!groupAAccum.has(key)) {
          groupAAccum.set(key, Array(run - 1).fill('(absent)'));
        }
        groupAAccum.get(key)!.push(val);
      }
    }
    // Back-fill keys absent in this run
    for (const [, arr] of groupAAccum) {
      if (arr.length < run) arr.push('(absent)');
    }

    // Anchors for VARIANT B
    if (VARIANT === 'B') {
      anchorAccumDA23.push(getAnchor(payload, 'years.2023.profit_and_loss.depreciation_amortisation'));
      anchorAccumDA24.push(getAnchor(payload, 'years.2024.profit_and_loss.depreciation_amortisation'));
    }
  }

  log();
  log('='.repeat(72));
  log(`VARIANT ${VARIANT} — GROUP A RESULTS`);
  log('='.repeat(72));
  log();

  // Print GROUP A table: key, then all run values
  for (const [key, vals] of [...groupAAccum.entries()].sort()) {
    const distinct = new Set(vals.filter((v) => v !== 'null' && v !== '(absent)' && v !== 'ERROR'));
    const stable = distinct.size <= 1;
    const tag = stable ? 'STABLE  ' : 'UNSTABLE';
    log(`  ${tag}  ${key}`);
    log(`           runs: [${vals.join(', ')}]`);
  }
  log();

  // ── Smoking gun: anchors for VARIANT B ────────────────────────────────────
  if (VARIANT === 'B') {
    log('='.repeat(72));
    log('VARIANT B — DEPRECIATION ANCHORS (smoking gun section)');
    log('='.repeat(72));
    log();
    log('  Key: years.2023.profit_and_loss.depreciation_amortisation');
    for (let i = 0; i < anchorAccumDA23.length; i++) {
      const a = anchorAccumDA23[i];
      if (!a) {
        log(`    run ${i + 1}: NO ANCHOR`);
      } else {
        log(`    run ${i + 1}: page=${JSON.stringify(a.page)}  label=${JSON.stringify(a.label)}`);
      }
    }
    log();
    log('  Key: years.2024.profit_and_loss.depreciation_amortisation');
    for (let i = 0; i < anchorAccumDA24.length; i++) {
      const a = anchorAccumDA24[i];
      if (!a) {
        log(`    run ${i + 1}: NO ANCHOR`);
      } else {
        log(`    run ${i + 1}: page=${JSON.stringify(a.page)}  label=${JSON.stringify(a.label)}`);
      }
    }
    log();
  }

  // ── Row counts after ───────────────────────────────────────────────────────
  const counts1 = await db.execute<{ tbl: string; cnt: string }>(sql`
    SELECT 'document_analysis_results' AS tbl, COUNT(*)::text AS cnt FROM document_analysis_results
    UNION ALL
    SELECT 'document_evidence',         COUNT(*)::text FROM document_evidence
    UNION ALL
    SELECT 'document_evidence_period',  COUNT(*)::text FROM document_evidence_period
    UNION ALL
    SELECT 'document_evidence_figure',  COUNT(*)::text FROM document_evidence_figure
  `);
  const postRunCounts = new Map(counts1.rows.map((r) => [r.tbl, r.cnt]));

  log('─'.repeat(72));
  log('ROW COUNT PROOF (writes-nothing check)');
  log('─'.repeat(72));
  for (const tbl of ['document_analysis_results', 'document_evidence', 'document_evidence_period', 'document_evidence_figure']) {
    const pre  = preRunCounts.get(tbl)  ?? '?';
    const post = postRunCounts.get(tbl) ?? '?';
    const ok   = pre === post ? 'UNCHANGED' : 'CHANGED — ABORT';
    log(`  ${tbl}: before=${pre}  after=${post}  \u2192 ${ok}`);
  }
  log();

  log(`completed: ${new Date().toISOString()}`);
  log('='.repeat(72));

  // ── Append to report file ──────────────────────────────────────────────────
  let existing = '';
  try { existing = await fs.readFile(reportPath, 'utf-8'); } catch {}
  await fs.writeFile(reportPath, existing + reportLines.join('\n') + '\n\n', 'utf-8');
  console.log(`Report appended to ${reportPath}`);
}

main().catch((e) => {
  console.error('[anchor-hypothesis-test] fatal:', e);
  process.exit(1);
});
