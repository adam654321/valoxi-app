/**
 * AUDIT-1.apply-2 — Phase 1 cross-document GROUP A comparison
 *
 * Parses docs/pipeline-fidelity-fix/audit1-capture-2026-08-15.txt into
 * structured records (one per document_id × fiscal_year), then for every
 * (company_id, fiscal_year) group that has 2+ contributing documents,
 * compares each of the 30 GROUP A fields independently.
 *
 * Rules:
 *   AGREEMENT    — all non-null values for the field are exactly equal
 *   DISAGREEMENT — any two non-null values differ (exact numeric comparison)
 *   INSUFFICIENT — fewer than 2 documents have a non-null value (nothing to compare)
 *
 * Read-only. No database access. No API calls.
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

const GROUP_A_PATHS = [
  'balance_sheet.current_assets.amounts_owed_by_directors',
  'balance_sheet.current_assets.cash_at_bank',
  'balance_sheet.current_assets.total',
  'balance_sheet.current_assets.trade_debtors',
  'balance_sheet.current_liabilities.amounts_owed_to_directors',
  'balance_sheet.current_liabilities.bank_loans_current',
  'balance_sheet.current_liabilities.corporation_tax',
  'balance_sheet.current_liabilities.hire_purchase_current',
  'balance_sheet.current_liabilities.total',
  'balance_sheet.current_liabilities.trade_creditors',
  'balance_sheet.equity.retained_earnings',
  'balance_sheet.equity.share_capital',
  'balance_sheet.equity.total',
  'balance_sheet.fixed_assets.intangible_assets',
  'balance_sheet.fixed_assets.tangible_assets',
  'balance_sheet.long_term_liabilities.bank_loans',
  'balance_sheet.long_term_liabilities.hire_purchase_long_term',
  'balance_sheet.long_term_liabilities.total',
  'profit_and_loss.administrative_expenses',
  'profit_and_loss.corporation_tax',
  'profit_and_loss.cost_of_sales',
  'profit_and_loss.depreciation_amortisation',
  'profit_and_loss.gross_profit',
  'profit_and_loss.interest_payable',
  'profit_and_loss.interest_receivable',
  'profit_and_loss.net_profit',
  'profit_and_loss.operating_profit',
  'profit_and_loss.other_operating_income',
  'profit_and_loss.profit_before_tax',
  'profit_and_loss.revenue',
] as const;

type GroupAPath = typeof GROUP_A_PATHS[number];

interface GroupBFields {
  period_start:   string | null;
  period_end:     string | null;
  months_covered: number | null;
  report_date:    string | null;
}

interface DocFyRecord {
  document_id:  number;
  fiscal_year:  number;
  company_id:   number;
  groupA:       Record<GroupAPath, number | null>;
  groupB:       GroupBFields;
}

type FieldOutcome = 'AGREEMENT' | 'DISAGREEMENT' | 'INSUFFICIENT';

interface FieldComparison {
  field:      GroupAPath;
  outcome:    FieldOutcome;
  /** { document_id → value (number | null) } for all docs in the group */
  docValues:  Array<{ document_id: number; value: number | null }>;
}

interface GroupComparison {
  company_id:   number;
  fiscal_year:  number;
  document_ids: number[];
  fields:       FieldComparison[];
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

function parseCapture(filePath: string): DocFyRecord[] {
  const lines = fs.readFileSync(filePath, 'utf-8').split('\n');

  const records: DocFyRecord[] = [];

  let currentCompanyId: number | null = null;
  let currentDocId:     number | null = null;
  let currentDocCompanyId: number | null = null;
  let currentFy:        number | null = null;
  let inGroupB = false;
  let inGroupA = false;

  // Accumulator for the current (doc, fy) record being built
  let groupA: Record<string, number | null> = {};
  let groupB: GroupBFields = { period_start: null, period_end: null, months_covered: null, report_date: null };

  function flushFy() {
    if (currentDocId !== null && currentFy !== null && currentDocCompanyId !== null) {
      const fullGroupA: Record<GroupAPath, number | null> = {} as Record<GroupAPath, number | null>;
      for (const p of GROUP_A_PATHS) {
        fullGroupA[p] = (p in groupA) ? groupA[p] : null;
      }
      records.push({
        document_id: currentDocId,
        fiscal_year: currentFy,
        company_id:  currentDocCompanyId,
        groupA:      fullGroupA,
        groupB:      { ...groupB },
      });
    }
    groupA  = {};
    groupB  = { period_start: null, period_end: null, months_covered: null, report_date: null };
    inGroupA = false;
    inGroupB = false;
  }

  for (const rawLine of lines) {
    // Detect COMPANY header  (no leading spaces)
    const companyMatch = rawLine.match(/^COMPANY (\d+)$/);
    if (companyMatch) {
      currentCompanyId = parseInt(companyMatch[1], 10);
      continue;
    }

    // Detect DOC header:  "  ┌─ DOC 5830"
    const docMatch = rawLine.match(/^\s+┌─ DOC (\d+)/);
    if (docMatch) {
      flushFy();
      currentFy = null;
      currentDocId = parseInt(docMatch[1], 10);
      currentDocCompanyId = currentCompanyId;
      continue;
    }

    // Detect company_id inside DOC header block (use as authoritative source)
    const coIdMatch = rawLine.match(/^\s+│\s+company_id:\s+(\d+)/);
    if (coIdMatch) {
      currentDocCompanyId = parseInt(coIdMatch[1], 10);
      continue;
    }

    // Detect FY header:  "  │  ┌─ FY 2023  ..."
    const fyMatch = rawLine.match(/^\s+│\s+┌─ FY (\d{4})/);
    if (fyMatch) {
      flushFy();
      currentFy = parseInt(fyMatch[1], 10);
      continue;
    }

    // Detect end of FY block:  "  │  └─"  (exactly, not "  └─" which ends a doc)
    // The FY closing line is "  │  └─" — has │ before └─
    if (/^\s+│\s+└─\s*$/.test(rawLine)) {
      // end of current FY (don't flush here — next ┌─ FY or └─ doc will flush)
      inGroupA = false;
      inGroupB = false;
      continue;
    }

    // Detect GROUP B section start
    if (/^\s+│\s+│\s+GROUP B:/.test(rawLine)) {
      inGroupB = true;
      inGroupA = false;
      continue;
    }

    // Detect GROUP A section start
    if (/^\s+│\s+│\s+GROUP A/.test(rawLine)) {
      inGroupA = true;
      inGroupB = false;
      continue;
    }

    // Parse GROUP B field line:  "  │  │    period_end:     2023-03-31"
    if (inGroupB) {
      const gbMatch = rawLine.match(/^\s+│\s+│\s+(period_start|period_end|months_covered|report_date):\s+(.*?)\s*$/);
      if (gbMatch) {
        const key = gbMatch[1] as keyof GroupBFields;
        const raw = gbMatch[2].trim();
        if (key === 'months_covered') {
          groupB[key] = raw === 'null' ? null : parseInt(raw, 10);
        } else {
          (groupB[key] as string | null) = raw === 'null' ? null : raw;
        }
      }
      continue;
    }

    // Parse GROUP A field line:
    // "  │  │    balance_sheet.current_assets.cash_at_bank              = 139509"
    if (inGroupA) {
      const gaMatch = rawLine.match(/^\s+│\s+│\s+((?:balance_sheet|profit_and_loss)\.\S+)\s+=\s+(.*?)\s*$/);
      if (gaMatch) {
        const fieldPath = gaMatch[1].trim() as GroupAPath;
        const rawVal    = gaMatch[2].trim();
        groupA[fieldPath] = rawVal === 'null' ? null : parseFloat(rawVal);
      }
      continue;
    }
  }

  // Flush any final FY that wasn't closed
  flushFy();

  return records;
}

// ---------------------------------------------------------------------------
// Comparison
// ---------------------------------------------------------------------------

function compareGroups(records: DocFyRecord[]): GroupComparison[] {
  // Build map: `${company_id}|${fiscal_year}` → records[]
  const map = new Map<string, DocFyRecord[]>();
  for (const r of records) {
    const key = `${r.company_id}|${r.fiscal_year}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(r);
  }

  const result: GroupComparison[] = [];

  for (const [key, recs] of map.entries()) {
    if (recs.length < 2) continue; // single-document groups: nothing to compare

    const [companyStr, fyStr] = key.split('|');
    const company_id  = parseInt(companyStr, 10);
    const fiscal_year = parseInt(fyStr, 10);
    const document_ids = recs.map(r => r.document_id).sort((a, b) => a - b);

    const fields: FieldComparison[] = [];

    for (const path of GROUP_A_PATHS) {
      const docValues = recs.map(r => ({ document_id: r.document_id, value: r.groupA[path] }));
      const nonNull   = docValues.filter(dv => dv.value !== null);

      let outcome: FieldOutcome;
      if (nonNull.length < 2) {
        outcome = 'INSUFFICIENT';
      } else {
        const first = nonNull[0].value!;
        const allSame = nonNull.every(dv => dv.value === first);
        outcome = allSame ? 'AGREEMENT' : 'DISAGREEMENT';
      }

      fields.push({ field: path, outcome, docValues });
    }

    result.push({ company_id, fiscal_year, document_ids, fields });
  }

  // Sort by company_id, then fiscal_year for deterministic output
  result.sort((a, b) =>
    a.company_id !== b.company_id
      ? a.company_id - b.company_id
      : a.fiscal_year - b.fiscal_year
  );

  return result;
}

// ---------------------------------------------------------------------------
// Report generation
// ---------------------------------------------------------------------------

function buildReport(records: DocFyRecord[], comparisons: GroupComparison[]): string {
  const lines: string[] = [];

  lines.push('================================================================================');
  lines.push('AUDIT-1 — Phase 1 Cross-Document GROUP A Comparison');
  lines.push('capture file: docs/pipeline-fidelity-fix/audit1-capture-2026-08-15.txt');
  lines.push(`generated:    ${new Date().toISOString()}`);
  lines.push('================================================================================');
  lines.push('');

  // Summary counts
  const totalGroups = comparisons.length;
  let totalFieldComparisons = 0;
  let totalAgreement   = 0;
  let totalDisagreement = 0;
  let totalInsufficient = 0;

  for (const g of comparisons) {
    for (const f of g.fields) {
      totalFieldComparisons++;
      if (f.outcome === 'AGREEMENT')    totalAgreement++;
      if (f.outcome === 'DISAGREEMENT') totalDisagreement++;
      if (f.outcome === 'INSUFFICIENT') totalInsufficient++;
    }
  }

  lines.push('SUMMARY');
  lines.push('────────────────────────────────────────────────────────────────────────────────');
  lines.push(`  Total records parsed:               ${records.length}`);
  lines.push(`  Groups with 2+ documents:           ${totalGroups}`);
  lines.push(`  Total field-comparisons:            ${totalFieldComparisons}`);
  lines.push(`    AGREEMENT:                        ${totalAgreement}`);
  lines.push(`    DISAGREEMENT:                     ${totalDisagreement}`);
  lines.push(`    INSUFFICIENT:                     ${totalInsufficient}`);
  lines.push(`  Arithmetic check: ${totalAgreement} + ${totalDisagreement} + ${totalInsufficient} = ${totalAgreement + totalDisagreement + totalInsufficient} (must equal ${totalFieldComparisons}: ${totalAgreement + totalDisagreement + totalInsufficient === totalFieldComparisons ? 'PASS' : 'FAIL'})`);
  lines.push('');

  // Group inventory
  lines.push('GROUP INVENTORY (all groups with 2+ documents)');
  lines.push('────────────────────────────────────────────────────────────────────────────────');
  for (const g of comparisons) {
    lines.push(`  company ${g.company_id}  FY ${g.fiscal_year}  docs: [${g.document_ids.join(', ')}]`);
  }
  lines.push('');

  // Disagreement detail
  const disagreements = comparisons
    .map(g => ({ ...g, fields: g.fields.filter(f => f.outcome === 'DISAGREEMENT') }))
    .filter(g => g.fields.length > 0);

  lines.push('DISAGREEMENTS');
  lines.push('────────────────────────────────────────────────────────────────────────────────');

  if (disagreements.length === 0) {
    lines.push('  (none)');
  } else {
    let prevCompany: number | null = null;
    for (const g of disagreements) {
      if (g.company_id !== prevCompany) {
        lines.push('');
        lines.push(`  ┌─ COMPANY ${g.company_id}`);
        prevCompany = g.company_id;
      }
      lines.push(`  │`);
      lines.push(`  │  FY ${g.fiscal_year}  (docs compared: [${g.document_ids.join(', ')}])`);
      for (const f of g.fields) {
        lines.push(`  │`);
        lines.push(`  │    field: ${f.field}`);
        for (const dv of f.docValues) {
          const label = dv.value === null ? 'null' : String(dv.value);
          lines.push(`  │      doc ${dv.document_id}: ${label}`);
        }
      }
    }
    lines.push(`  │`);
    lines.push(`  └─`);
  }

  lines.push('');

  // Full per-group detail (all outcomes)
  lines.push('================================================================================');
  lines.push('FULL FIELD-BY-FIELD DETAIL');
  lines.push('================================================================================');
  lines.push('');

  for (const g of comparisons) {
    lines.push(`  ┌─ COMPANY ${g.company_id}  FY ${g.fiscal_year}  docs: [${g.document_ids.join(', ')}]`);
    lines.push(`  │`);
    for (const f of g.fields) {
      const valStr = f.docValues
        .map(dv => `doc${dv.document_id}=${dv.value === null ? 'null' : dv.value}`)
        .join('  ');
      lines.push(`  │  [${f.outcome.padEnd(12)}]  ${f.field}`);
      lines.push(`  │               ${valStr}`);
    }
    lines.push(`  └─`);
    lines.push('');
  }

  lines.push('================================================================================');
  lines.push('END OF REPORT');
  lines.push('================================================================================');

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const captureFile = path.join(
    __dirname, '..', 'docs', 'pipeline-fidelity-fix', 'audit1-capture-2026-08-15.txt'
  );
  const outputFile = path.join(
    __dirname, '..', 'docs', 'pipeline-fidelity-fix', 'audit1-phase1-comparison-2026-08-15.txt'
  );

  console.log(`Parsing capture file: ${captureFile}`);
  const records = parseCapture(captureFile);
  console.log(`  Parsed ${records.length} (document_id, fiscal_year) records`);

  console.log('Running cross-document comparison...');
  const comparisons = compareGroups(records);
  console.log(`  Groups with 2+ documents: ${comparisons.length}`);

  const report = buildReport(records, comparisons);

  fs.writeFileSync(outputFile, report, 'utf-8');
  console.log(`\nReport written to: ${outputFile}`);

  // Print summary to stdout for V-CHECK
  const totalGroups = comparisons.length;
  let agree = 0, disagree = 0, insuf = 0;
  for (const g of comparisons) {
    for (const f of g.fields) {
      if (f.outcome === 'AGREEMENT')    agree++;
      if (f.outcome === 'DISAGREEMENT') disagree++;
      if (f.outcome === 'INSUFFICIENT') insuf++;
    }
  }
  const total = agree + disagree + insuf;

  console.log('\n── V-CHECK SUMMARY ──────────────────────────────────────────────────');
  console.log(`Groups with 2+ docs:    ${totalGroups}`);
  console.log(`Total field-comparisons: ${total}`);
  console.log(`  AGREEMENT:             ${agree}`);
  console.log(`  DISAGREEMENT:          ${disagree}`);
  console.log(`  INSUFFICIENT:          ${insuf}`);
  console.log(`  Arithmetic check:      ${agree} + ${disagree} + ${insuf} = ${agree + disagree + insuf} (${agree + disagree + insuf === total ? 'PASS' : 'FAIL'})`);
  console.log('');

  console.log('Group inventory:');
  for (const g of comparisons) {
    console.log(`  company ${g.company_id}  FY ${g.fiscal_year}  docs: [${g.document_ids.join(', ')}]`);
  }
  console.log('');

  // Disagreements
  const disGroups = comparisons
    .map(g => ({ ...g, fields: g.fields.filter(f => f.outcome === 'DISAGREEMENT') }))
    .filter(g => g.fields.length > 0);

  if (disGroups.length === 0) {
    console.log('DISAGREEMENTS: none');
  } else {
    console.log('DISAGREEMENTS:');
    for (const g of disGroups) {
      console.log(`  company ${g.company_id}  FY ${g.fiscal_year}  docs: [${g.document_ids.join(', ')}]`);
      for (const f of g.fields) {
        const vals = f.docValues
          .map(dv => `  doc ${dv.document_id}: ${dv.value === null ? 'null' : dv.value}`)
          .join('\n    ');
        console.log(`    field: ${f.field}`);
        console.log(`    ${vals}`);
      }
    }
  }
  console.log('─────────────────────────────────────────────────────────────────────');

  // Probe for the two known defects from HANDOVER
  console.log('\n── HANDOVER DEFECT CHECK ─────────────────────────────────────────────');
  const checks = [
    { company_id: 1877, fiscal_year: 2023, field: 'profit_and_loss.depreciation_amortisation' as GroupAPath, label: 'Midland FY2023 depreciation_amortisation' },
    { company_id: 1877, fiscal_year: 2023, field: 'profit_and_loss.net_profit' as GroupAPath,                label: 'Midland FY2023 net_profit' },
  ];

  let allDefectsFound = true;
  for (const check of checks) {
    const group = comparisons.find(
      g => g.company_id === check.company_id && g.fiscal_year === check.fiscal_year
    );
    if (!group) {
      console.log(`  MISSING GROUP — no group found for company ${check.company_id} FY ${check.fiscal_year}: ${check.label}`);
      allDefectsFound = false;
      continue;
    }
    const field = group.fields.find(f => f.field === check.field);
    if (!field) {
      console.log(`  MISSING FIELD — field not present in group: ${check.label}`);
      allDefectsFound = false;
      continue;
    }
    if (field.outcome === 'DISAGREEMENT') {
      const vals = field.docValues.map(dv => `doc ${dv.document_id}: ${dv.value}`).join(', ');
      console.log(`  FOUND  [DISAGREEMENT]  ${check.label}`);
      console.log(`         values: ${vals}`);
    } else {
      console.log(`  PROBLEM — expected DISAGREEMENT but got ${field.outcome}: ${check.label}`);
      console.log(`  BUG in comparison logic — stopping.`);
      allDefectsFound = false;
    }
  }
  if (allDefectsFound) {
    console.log('  Both handover defects correctly flagged as DISAGREEMENT. Logic OK.');
  }
  console.log('─────────────────────────────────────────────────────────────────────');
}

main();
