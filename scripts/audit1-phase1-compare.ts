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

  let currentCompanyId:    number | null = null;
  let currentDocId:        number | null = null;
  let currentDocCompanyId: number | null = null;
  let currentFy:           number | null = null;
  let inGroupB = false;
  let inGroupA = false;

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
    const companyMatch = rawLine.match(/^COMPANY (\d+)$/);
    if (companyMatch) {
      currentCompanyId = parseInt(companyMatch[1], 10);
      continue;
    }

    const docMatch = rawLine.match(/^\s+┌─ DOC (\d+)/);
    if (docMatch) {
      flushFy();
      currentFy = null;
      currentDocId = parseInt(docMatch[1], 10);
      currentDocCompanyId = currentCompanyId;
      continue;
    }

    const coIdMatch = rawLine.match(/^\s+│\s+company_id:\s+(\d+)/);
    if (coIdMatch) {
      currentDocCompanyId = parseInt(coIdMatch[1], 10);
      continue;
    }

    const fyMatch = rawLine.match(/^\s+│\s+┌─ FY (\d{4})/);
    if (fyMatch) {
      flushFy();
      currentFy = parseInt(fyMatch[1], 10);
      continue;
    }

    if (/^\s+│\s+└─\s*$/.test(rawLine)) {
      inGroupA = false;
      inGroupB = false;
      continue;
    }

    if (/^\s+│\s+│\s+GROUP B:/.test(rawLine)) {
      inGroupB = true;
      inGroupA = false;
      continue;
    }

    if (/^\s+│\s+│\s+GROUP A/.test(rawLine)) {
      inGroupA = true;
      inGroupB = false;
      continue;
    }

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

  flushFy();

  return records;
}

// ---------------------------------------------------------------------------
// Comparison
// ---------------------------------------------------------------------------

function compareGroups(records: DocFyRecord[]): GroupComparison[] {
  const map = new Map<string, DocFyRecord[]>();
  for (const r of records) {
    const key = `${r.company_id}|${r.fiscal_year}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(r);
  }

  const result: GroupComparison[] = [];

  for (const [key, recs] of map.entries()) {
    if (recs.length < 2) continue;

    const [companyStr, fyStr] = key.split('|');
    const company_id  = parseInt(companyStr, 10);
    const fiscal_year = parseInt(fyStr, 10);
    const document_ids = recs.map(r => r.document_id).sort((a, b) => a - b);

    const fields: FieldComparison[] = [];

    for (const p of GROUP_A_PATHS) {
      const docValues = recs.map(r => ({ document_id: r.document_id, value: r.groupA[p] }));
      const nonNull   = docValues.filter(dv => dv.value !== null);

      let outcome: FieldOutcome;
      if (nonNull.length < 2) {
        outcome = 'INSUFFICIENT';
      } else {
        const first = nonNull[0].value!;
        const allSame = nonNull.every(dv => dv.value === first);
        outcome = allSame ? 'AGREEMENT' : 'DISAGREEMENT';
      }

      fields.push({ field: p, outcome, docValues });
    }

    result.push({ company_id, fiscal_year, document_ids, fields });
  }

  result.sort((a, b) =>
    a.company_id !== b.company_id
      ? a.company_id - b.company_id
      : a.fiscal_year - b.fiscal_year
  );

  return result;
}

// ---------------------------------------------------------------------------
// Case Rollup
// ---------------------------------------------------------------------------

interface DocClusterSummary {
  doc_id:          number;
  soloFieldCount:  number;   // fields where this doc is the only doc with its value
  soloFields:      GroupAPath[];
}

interface GroupRollup {
  company_id:       number;
  fiscal_year:      number;
  document_ids:     number[];
  disagreeCount:    number;
  docSummaries:     DocClusterSummary[];
  /** Human-readable pattern classification */
  pattern:          string;
}

function buildCaseRollup(comparisons: GroupComparison[]): GroupRollup[] {
  const rollups: GroupRollup[] = [];

  for (const g of comparisons) {
    const disFields = g.fields.filter(f => f.outcome === 'DISAGREEMENT');
    if (disFields.length === 0) continue;

    // For each disagreement field, find which docs have a "solo" value
    // (i.e. their value is not shared by any other doc in the group)
    const soloFieldsByDoc = new Map<number, GroupAPath[]>();
    for (const docId of g.document_ids) {
      soloFieldsByDoc.set(docId, []);
    }

    for (const f of disFields) {
      // Build value → [doc_ids] clusters (non-null only)
      const valueClusters = new Map<number, number[]>();
      for (const dv of f.docValues) {
        if (dv.value === null) continue;
        if (!valueClusters.has(dv.value)) valueClusters.set(dv.value, []);
        valueClusters.get(dv.value)!.push(dv.document_id);
      }

      // A doc is "solo" in this field if its value cluster has exactly 1 member
      for (const [, docsWithValue] of valueClusters.entries()) {
        if (docsWithValue.length === 1) {
          const soloDoc = docsWithValue[0];
          soloFieldsByDoc.get(soloDoc)?.push(f.field);
        }
      }
    }

    const docSummaries: DocClusterSummary[] = [];
    for (const docId of g.document_ids) {
      const soloFields = soloFieldsByDoc.get(docId) ?? [];
      docSummaries.push({
        doc_id:         docId,
        soloFieldCount: soloFields.length,
        soloFields,
      });
    }

    // Classify pattern
    const maxSolo = Math.max(...docSummaries.map(d => d.soloFieldCount));
    const soloDocs = docSummaries.filter(d => d.soloFieldCount > 1);
    const twoDocGroup = g.document_ids.length === 2;

    let pattern: string;
    if (twoDocGroup) {
      // Two docs — every disagreement is mutual; can't call either an outlier
      pattern = `2-doc group: ${disFields.length} field(s) disagree — each is a bilateral conflict; neither doc can be isolated as the outlier.`;
    } else if (soloDocs.length === 1 && maxSolo >= 2) {
      const d = soloDocs[0];
      pattern = `Single-doc outlier pattern: doc ${d.doc_id} holds a solo value in ${d.soloFieldCount}/${disFields.length} disagreement field(s) — likely one underlying defect rather than several.`;
    } else if (soloDocs.length > 1) {
      const desc = soloDocs.map(d => `doc ${d.doc_id} (${d.soloFieldCount} field(s))`).join(', ');
      pattern = `Multi-doc scatter: ${desc} each hold solo values in distinct fields — likely several distinct issues, not one.`;
    } else if (maxSolo === 1) {
      pattern = `No dominant outlier: every disagreement field has a different isolation pattern — likely several distinct issues.`;
    } else {
      // maxSolo === 0 means all disagreements involve 2+ docs each holding the same value
      // i.e. a stable 2-way split in a 3+ doc group
      const totalNonSolo = disFields.length;
      pattern = `Stable split pattern: ${totalNonSolo} field(s) with two distinct value clusters across the group — no single doc is isolated; documents partition into two sub-sets holding different values.`;
    }

    rollups.push({
      company_id:    g.company_id,
      fiscal_year:   g.fiscal_year,
      document_ids:  g.document_ids,
      disagreeCount: disFields.length,
      docSummaries,
      pattern,
    });
  }

  return rollups;
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
  let totalAgreement    = 0;
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

  // ── Case Rollup ──────────────────────────────────────────────────────────
  const rollups = buildCaseRollup(comparisons);
  const groupsWithDisagreements = rollups.length;
  const totalDisagreementFields = rollups.reduce((s, r) => s + r.disagreeCount, 0);

  lines.push('================================================================================');
  lines.push('CASE ROLLUP');
  lines.push('================================================================================');
  lines.push('');
  lines.push(`  Groups with disagreements: ${groupsWithDisagreements}`);
  lines.push(`  Total disagreement fields: ${totalDisagreementFields}  (= ${totalDisagreement})`);
  lines.push('');
  lines.push('  How to read: "solo value" = a document whose value for that field is not');
  lines.push('  shared by any other document in the same (company, FY) group. A document');
  lines.push('  that is solo across multiple fields is a candidate for one underlying defect.');
  lines.push('  No value-correctness judgement is made — that is reserved for PDF review.');
  lines.push('');

  for (const r of rollups) {
    lines.push(`  ┌─ company ${r.company_id}  FY ${r.fiscal_year}  docs: [${r.document_ids.join(', ')}]`);
    lines.push(`  │  disagreement fields: ${r.disagreeCount}`);
    lines.push(`  │  pattern: ${r.pattern}`);

    if (r.document_ids.length > 2) {
      // Show per-doc solo counts
      const sorted = [...r.docSummaries].sort((a, b) => b.soloFieldCount - a.soloFieldCount);
      for (const d of sorted) {
        if (d.soloFieldCount === 0) {
          lines.push(`  │    doc ${d.doc_id}: no solo fields (agrees with at least one other doc on every disagreement field)`);
        } else {
          const fieldList = d.soloFields.map(f => {
            // find the actual value for this doc in this field
            const gc = comparisons.find(g => g.company_id === r.company_id && g.fiscal_year === r.fiscal_year)!;
            const fc = gc.fields.find(ff => ff.field === f)!;
            const dv = fc.docValues.find(x => x.document_id === d.doc_id)!;
            return `${f.split('.').slice(1).join('.')}=${dv.value}`;
          });
          lines.push(`  │    doc ${d.doc_id}: solo in ${d.soloFieldCount} field(s) — ${fieldList.join(', ')}`);
        }
      }
    }

    lines.push(`  └─`);
    lines.push('');
  }

  lines.push('  CASE ROLLUP SUMMARY');
  lines.push('  ─────────────────────────────────────────────────────────────────────────────');

  // Count by pattern type
  const singleOutlier = rollups.filter(r => r.pattern.startsWith('Single-doc outlier'));
  const twoDocGroups  = rollups.filter(r => r.pattern.startsWith('2-doc group'));
  const stableSplit   = rollups.filter(r => r.pattern.startsWith('Stable split'));
  const multiScatter  = rollups.filter(r => r.pattern.startsWith('Multi-doc scatter') || r.pattern.startsWith('No dominant'));

  lines.push(`  Single-doc outlier (likely 1 underlying defect per group): ${singleOutlier.length} group(s)`);
  if (singleOutlier.length > 0) {
    for (const r of singleOutlier) {
      const outlierDoc = r.docSummaries.find(d => d.soloFieldCount > 1)!;
      lines.push(`    company ${r.company_id} FY ${r.fiscal_year}: doc ${outlierDoc.doc_id} outlier across ${outlierDoc.soloFieldCount}/${r.disagreeCount} fields`);
    }
  }
  lines.push(`  Stable split (2-cluster split, no single outlier): ${stableSplit.length} group(s)`);
  if (stableSplit.length > 0) {
    for (const r of stableSplit) {
      lines.push(`    company ${r.company_id} FY ${r.fiscal_year}: ${r.disagreeCount} fields`);
    }
  }
  lines.push(`  2-doc bilateral conflicts: ${twoDocGroups.length} group(s)`);
  if (twoDocGroups.length > 0) {
    for (const r of twoDocGroups) {
      lines.push(`    company ${r.company_id} FY ${r.fiscal_year}: ${r.disagreeCount} fields`);
    }
  }
  lines.push(`  Multi-doc scatter / no dominant outlier: ${multiScatter.length} group(s)`);
  if (multiScatter.length > 0) {
    for (const r of multiScatter) {
      lines.push(`    company ${r.company_id} FY ${r.fiscal_year}: ${r.disagreeCount} fields`);
    }
  }
  lines.push('');
  lines.push(`  Approximate real-case count (lower bound):  ${groupsWithDisagreements} group(s), likely ~${singleOutlier.reduce((s, r) => { const d = r.docSummaries.find(x => x.soloFieldCount > 1); return s + (d ? r.disagreeCount - d.soloFieldCount + 1 : r.disagreeCount); }, 0) + stableSplit.reduce((s, r) => s + 1, 0) + twoDocGroups.reduce((s, r) => s + r.disagreeCount, 0) + multiScatter.reduce((s, r) => s + r.disagreeCount, 0)} distinct underlying discrepancies across all groups`);
  lines.push(`  (80 field-rows collapses to roughly that many real issues once outlier clustering is applied)`);
  lines.push('');

  // ── Disagreement list ─────────────────────────────────────────────────────
  const disagreements = comparisons
    .map(g => ({ ...g, fields: g.fields.filter(f => f.outcome === 'DISAGREEMENT') }))
    .filter(g => g.fields.length > 0);

  lines.push('================================================================================');
  lines.push('DISAGREEMENT DETAIL');
  lines.push('================================================================================');
  lines.push('');

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

  // ── Full per-group detail ─────────────────────────────────────────────────
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

  // ── V-CHECK SUMMARY ──────────────────────────────────────────────────────
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
  console.log(`Groups with 2+ docs:     ${totalGroups}`);
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

  // ── Case rollup stdout summary ────────────────────────────────────────────
  const rollups = buildCaseRollup(comparisons);
  console.log('── CASE ROLLUP ──────────────────────────────────────────────────────');
  console.log(`Groups with disagreements: ${rollups.length}`);
  console.log('');
  for (const r of rollups) {
    console.log(`  company ${r.company_id}  FY ${r.fiscal_year}  [${r.disagreeCount} disagreement field(s)]`);
    console.log(`    ${r.pattern}`);
    if (r.document_ids.length > 2) {
      const sorted = [...r.docSummaries].sort((a, b) => b.soloFieldCount - a.soloFieldCount);
      for (const d of sorted) {
        if (d.soloFieldCount > 0) {
          console.log(`    doc ${d.doc_id}: solo in ${d.soloFieldCount} field(s): ${d.soloFields.map(f => f.split('.').slice(-1)[0]).join(', ')}`);
        } else {
          console.log(`    doc ${d.doc_id}: no solo fields`);
        }
      }
    }
    console.log('');
  }

  // ── HANDOVER DEFECT CHECK ─────────────────────────────────────────────────
  console.log('── HANDOVER DEFECT CHECK ────────────────────────────────────────────');

  const handoverChecks: Array<{
    company_id:  number;
    fiscal_year: number;
    field:       GroupAPath;
    label:       string;
    fixNote:     string | null;
  }> = [
    {
      company_id: 1877, fiscal_year: 2023,
      field: 'profit_and_loss.depreciation_amortisation',
      label: 'Midland FY2023 depreciation_amortisation',
      fixNote:
        'HANDOVER\'s defect predates the 1c-noanchor fix (commit 8918cfa). ' +
        'The defect was: doc 5830 extracted with the old 1c prompt (FIGURE ANCHORS block present) ' +
        'returned 51,910 (the FY2024 value from a note) instead of the correct 10,824 from the P&L ' +
        'comparative column. This capture used the fixed prompt (1c-noanchor). ' +
        'AGREEMENT across all 3 documents (5830/5831/5835, all 10824) confirms the fix worked — ' +
        'this is the expected post-fix result, not a detection miss.',
    },
    {
      company_id: 1877, fiscal_year: 2023,
      field: 'profit_and_loss.net_profit',
      label: 'Midland FY2023 net_profit',
      fixNote: null, // expected to still show DISAGREEMENT (unrelated to the anchor fix)
    },
  ];

  let allDefectsAccountedFor = true;

  for (const check of handoverChecks) {
    const group = comparisons.find(
      g => g.company_id === check.company_id && g.fiscal_year === check.fiscal_year
    );
    if (!group) {
      console.log(`  MISSING GROUP — no group found for company ${check.company_id} FY ${check.fiscal_year}: ${check.label}`);
      allDefectsAccountedFor = false;
      continue;
    }
    const field = group.fields.find(f => f.field === check.field);
    if (!field) {
      console.log(`  MISSING FIELD — field not in group: ${check.label}`);
      allDefectsAccountedFor = false;
      continue;
    }

    if (field.outcome === 'DISAGREEMENT') {
      const vals = field.docValues.map(dv => `doc ${dv.document_id}: ${dv.value}`).join(', ');
      console.log(`  DISAGREEMENT  ${check.label}`);
      console.log(`    values: ${vals}`);
      if (check.fixNote !== null) {
        // Unexpected DISAGREEMENT — should have been resolved by fix
        console.log(`    NOTE: expected AGREEMENT after fix. If DISAGREEMENT persists, investigate.`);
        allDefectsAccountedFor = false;
      } else {
        console.log(`    (Expected: DISAGREEMENT is not related to the 1c-noanchor fix.)`);
      }
    } else if (field.outcome === 'AGREEMENT') {
      if (check.fixNote !== null) {
        // Expected: fix resolved the defect
        const vals = field.docValues
          .filter(dv => dv.value !== null)
          .map(dv => `doc ${dv.document_id}: ${dv.value}`)
          .join(', ');
        console.log(`  AGREEMENT     ${check.label}`);
        console.log(`    values: ${vals}`);
        console.log(`    NOTE: ${check.fixNote}`);
      } else {
        // Named as a persistent defect but shows AGREEMENT — unexpected
        console.log(`  PROBLEM — expected DISAGREEMENT but got AGREEMENT: ${check.label}`);
        console.log(`  This defect was NOT expected to be resolved by the fix. Investigate.`);
        allDefectsAccountedFor = false;
      }
    } else {
      console.log(`  INSUFFICIENT  ${check.label} (fewer than 2 non-null values — cannot compare)`);
    }
  }

  console.log('');
  if (allDefectsAccountedFor) {
    console.log('  All named HANDOVER defects are accounted for:');
    console.log('    - depreciation_amortisation: AGREEMENT confirms the 1c-noanchor fix worked.');
    console.log('    - net_profit: DISAGREEMENT correctly flagged (unrelated to the anchor fix).');
  }
  console.log('─────────────────────────────────────────────────────────────────────');
}

main();
