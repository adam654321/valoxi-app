#!/usr/bin/env tsx
/**
 * scripts/audit1-conflict-report.ts
 *
 * AUDIT-1 Phase 3 — Deterministic conflict enumeration.
 * Read-only against committed JSON captures in audit/pipeline-fidelity/.
 * No database. No Gemini. No changes to existing files.
 *
 * Output: docs/pipeline-fidelity-fix/audit1-conflict-report.md
 *
 * Usage: npx tsx scripts/audit1-conflict-report.ts
 */

import * as fs from 'fs';
import * as path from 'path';

const ROOT = process.cwd();
const AUDIT_DIR = path.join(ROOT, 'audit', 'pipeline-fidelity');
const OUTPUT_PATH = path.join(ROOT, 'docs', 'pipeline-fidelity-fix', 'audit1-conflict-report.md');

// ─── Constants ───────────────────────────────────────────────────────────────

/** devDocId permanently excluded — R2 bytes gone, harness skipped it */
const EXCLUDE_DOC_IDS = new Set([5878]);

const TIER_MAP: Record<number, string> = {
  5830: 'T1a', 5831: 'T1a', 5857: 'T1a', 5861: 'T1a', 5867: 'T1a', 5868: 'T1a',
  5874: 'T1a', 5877: 'T1a', 5879: 'T1a',
  5862: 'T1b', 5863: 'T1b', 5869: 'T1b',
  5832: 'T2',  5860: 'T2',  5875: 'T2',  5876: 'T2',
  5835: 'T3',  5873: 'T3',
  5833: 'INT', 5836: 'INT', 5865: 'INT', 5866: 'INT', 5880: 'INT', 5881: 'INT',
};

/** Higher index = lower precedence */
const TIER_RANK: Record<string, number> = {
  T1a: 0, T1b: 1, T2: 2, T3: 3, INT: 4, 'n/a': 5,
};

function getTier(devDocId: number): string {
  return TIER_MAP[devDocId] ?? 'n/a';
}

/** T1a outranks T2 → returns true when tierA has HIGHER precedence (lower rank index) */
function isHigherTier(tierA: string, tierB: string): boolean {
  return (TIER_RANK[tierA] ?? 5) < (TIER_RANK[tierB] ?? 5);
}

const COMPANIES = [
  { dir: 'company-1877', name: 'Thor-CON (Midland Air Conditioning)' },
  { dir: 'company-1880', name: 'Innova Design Group Limited' },
  { dir: 'company-1881', name: 'Cooper Gibson' },
] as const;

// Scalar IS top-level fields to compare
const IS_SCALAR = [
  'revenue', 'costOfSales', 'grossProfit', 'administrativeExpenses',
  'depreciationAmortisation', 'otherOperatingIncome', 'operatingProfit',
  'interestReceivable', 'interestPayable', 'profitBeforeTax', 'corporationTax',
  'netProfit', 'staffCosts', 'directorsRemuneration', 'dividendsPaid',
] as const;

// IS nested objects to recurse one level into
const IS_NESTED = ['costOfSalesBreakdown', 'overheadsBreakdown'] as const;

// Scalar BS top-level fields to compare
const BS_SCALAR = [
  'intangibleAssets', 'tangibleFixedAssets', 'freeholdProperty', 'leaseholdProperty',
  'plantMachinery', 'fixturesFittings', 'motorVehicles', 'computerEquipment',
  'stockInventory', 'tradeDebtors', 'prepayments', 'amountsOwedByDirectors',
  'amountsOwedByConnectedCompanies', 'directorsCurrentAccount', 'otherDebtors',
  'cashAtBank', 'totalCurrentAssets', 'tradeCreditors', 'taxationSocialSecurity',
  'vatPayable', 'corporationTaxDue', 'bankLoansOverdraftCurrent', 'hirePurchaseCurrent',
  'accruals', 'amountsOwedToDirectors', 'otherCreditors', 'totalCurrentLiabilities',
  'bankLoansLongTerm', 'hirePurchaseLongTerm', 'deferredTaxation', 'otherLongTermDebt',
  'totalLongTermLiabilities', 'shareCapital', 'retainedEarnings', 'totalEquity',
] as const;

// ─── Types ───────────────────────────────────────────────────────────────────

type Classification =
  | 'FIRST_WRITE'
  | 'AGREE'
  | 'GRANULARITY'
  | 'CONFLICT'
  | 'ENRICHED'
  | 'ERASED';

type ScalarValue = number | string | null;

interface DocEntry {
  devDocId: number;
  prodDocId: number;
  filename: string;
}

interface WriteEvent {
  company: string;
  devDocId: number;
  prodDocId: number;
  filename: string;
  tier: string;
  fiscalYear: number;
  periodId: number;
  statement: 'IS' | 'BS';
  field: string;
  previousValue: ScalarValue;
  previousSourceDocId: number | null;
  previousTier: string | null;
  newValue: ScalarValue;
  newSourceDocId: number;
  classification: Classification;
}

// ─── Value normalisation ─────────────────────────────────────────────────────

/**
 * Canonical scalar form.
 * - null / undefined / '' → null
 * - Finite numeric string / number → number, so "0" == 0 and "1.0" == 1
 * - Other strings → trimmed string
 */
function norm(v: unknown): ScalarValue {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (s === '') return null;
  const n = Number(s);
  if (Number.isFinite(n)) return n;
  return s;
}

function valEq(a: unknown, b: unknown): boolean {
  const aNorm = norm(a);
  const bNorm = norm(b);

  if (typeof aNorm === 'number' && typeof bNorm === 'number') {
    return aNorm === bNorm;
  }

  return aNorm === bNorm;
}

function toNum(v: ScalarValue): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

// ─── Field extraction ────────────────────────────────────────────────────────

/**
 * Extract scalar fields from an IS or BS row, recursing one level into
 * named nested objects. Returns field → canonical scalar value.
 */
function extractFields(
  row: Record<string, unknown>,
  scalarFields: readonly string[],
  nestedFields: readonly string[],
): Map<string, ScalarValue> {
  const out = new Map<string, ScalarValue>();
  for (const f of scalarFields) {
    out.set(f, norm(row[f]));
  }
  for (const nf of nestedFields) {
    const nested = row[nf];
    if (nested !== null && nested !== undefined && typeof nested === 'object' && !Array.isArray(nested)) {
      for (const [k, v] of Object.entries(nested as Record<string, unknown>)) {
        if (v === null || v === undefined || typeof v !== 'object') {
          out.set(`${nf}.${k}`, norm(v));
        }
      }
    }
  }
  return out;
}

// ─── JSON loader ─────────────────────────────────────────────────────────────

function readJson(p: string): unknown {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

// ─── Core processing ─────────────────────────────────────────────────────────

interface BeforeAfterFile {
  beforePeriods: Array<{ id: number; fiscalYear: number }>;
  afterPeriods:  Array<{ id: number; fiscalYear: number }>;
  newPeriods:    Array<{ id: number; fiscalYear: number }>;
  beforeIS: Array<Record<string, unknown>>;
  afterIS:  Array<Record<string, unknown>>;
  newIS:    Array<Record<string, unknown>>;
  beforeBS: Array<Record<string, unknown>>;
  afterBS:  Array<Record<string, unknown>>;
  newBS:    Array<Record<string, unknown>>;
  changedPeriods: Array<{ id: number; fiscalYear: number }>;
}

function processCompany(companyName: string, rawDir: string, docEntries: DocEntry[]): WriteEvent[] {
  /** periodId → fiscalYear, accumulated across all before-after files */
  const periodFY = new Map<number, number>();

  const allEvents: WriteEvent[] = [];

  const docById = new Map(docEntries.map(e => [e.devDocId, e]));
  const sortedIds = docEntries.map(e => e.devDocId).sort((a, b) => a - b);

  for (const devDocId of sortedIds) {
    if (EXCLUDE_DOC_IDS.has(devDocId)) continue;

    const bafPath = path.join(rawDir, `phase2-doc-${devDocId}-before-after.json`);
    if (!fs.existsSync(bafPath)) continue;

    const baf = readJson(bafPath) as BeforeAfterFile;
    const doc = docById.get(devDocId)!;
    const tier = getTier(devDocId);

    // Accumulate fiscalYear mapping from afterPeriods and newPeriods
    for (const p of [...(baf.afterPeriods ?? []), ...(baf.newPeriods ?? [])]) {
      if (!periodFY.has(p.id)) periodFY.set(p.id, p.fiscalYear);
    }

    // ── IS ──────────────────────────────────────────────────────────────────
    emitStatementEvents(
      companyName, doc, tier, 'IS',
      baf.beforeIS ?? [], baf.afterIS ?? [],
      IS_SCALAR, IS_NESTED,
      periodFY, allEvents,
    );

    // ── BS ──────────────────────────────────────────────────────────────────
    emitStatementEvents(
      companyName, doc, tier, 'BS',
      baf.beforeBS ?? [], baf.afterBS ?? [],
      BS_SCALAR, [],
      periodFY, allEvents,
    );
  }

  return allEvents;
}

function emitStatementEvents(
  companyName: string,
  doc: DocEntry,
  tier: string,
  statement: 'IS' | 'BS',
  beforeRows: Array<Record<string, unknown>>,
  afterRows: Array<Record<string, unknown>>,
  scalarFields: readonly string[],
  nestedFields: readonly string[],
  periodFY: Map<number, number>,
  out: WriteEvent[],
): void {
  if (afterRows.length === 0) return;

  const beforeByPeriod = new Map<number, Record<string, unknown>>(
    beforeRows.map(r => [r.financialPeriodId as number, r]),
  );

  // ── Collect all row writes for this (devDocId, statement) batch ───────────
  // We need them all before classifying so GRANULARITY can inspect siblings.

  interface RawChange {
    periodId: number;
    field: string;
    prevValue: ScalarValue;
    prevSourceDocId: number | null;
    newValue: ScalarValue;
    newSourceDocId: number;
  }

  const rawChanges: RawChange[] = [];

  for (const afterRow of afterRows) {
    const periodId = afterRow.financialPeriodId as number;
    const afterFields = extractFields(afterRow, scalarFields, nestedFields);
    const newSourceDocId = afterRow.sourceDocumentId as number;

    const beforeRow = beforeByPeriod.get(periodId);

    if (!beforeRow) {
      // New row — every populated field is its first write.
      for (const [field, newVal] of afterFields) {
        if (newVal !== null) {
          rawChanges.push({
            periodId, field,
            prevValue: null,
            prevSourceDocId: null,
            newValue: newVal,
            newSourceDocId,
          });
        }
      }
    } else {
      // A source-document change means the new document wrote every populated
      // field in the row. If the source did not change, preserve the original
      // behaviour and record only actual value changes.
      const beforeFields = extractFields(beforeRow, scalarFields, nestedFields);
      const prevSourceDocId = beforeRow.sourceDocumentId as number;
      const sourceChanged = prevSourceDocId !== newSourceDocId;
      const fields = new Set([...beforeFields.keys(), ...afterFields.keys()]);

      for (const field of fields) {
        const newVal = afterFields.get(field) ?? null;
        const prevVal = beforeFields.get(field) ?? null;
        // Both-null positions carry no reported value and have no classification.
        if ((sourceChanged || !valEq(prevVal, newVal)) && !(prevVal === null && newVal === null)) {
          rawChanges.push({
            periodId, field,
            prevValue: prevVal,
            prevSourceDocId,
            newValue: newVal,
            newSourceDocId,
          });
        }
      }
    }
  }

  // ── GRANULARITY detection — per periodId ─────────────────────────────────
  // Group changes by periodId, then for each non-null→non-null decreased field
  // check if its decrease == sum of null→non-null siblings in the same group.

  const granularityFields = new Set<string>(); // "periodId|field" keys

  const byPeriod = new Map<number, RawChange[]>();
  for (const ch of rawChanges) {
    if (!byPeriod.has(ch.periodId)) byPeriod.set(ch.periodId, []);
    byPeriod.get(ch.periodId)!.push(ch);
  }

  for (const [periodId, changes] of byPeriod) {
    const nullToNonNull = changes.filter(c => c.prevValue === null && c.newValue !== null);

    if (nullToNonNull.length === 0) continue; // no potential siblings, skip

    const nonNullToNonNull = changes.filter(
      c => c.prevValue !== null && c.newValue !== null && !valEq(c.prevValue, c.newValue),
    );

    for (const candidate of nonNullToNonNull) {
      const prevNum = toNum(candidate.prevValue);
      const newNum  = toNum(candidate.newValue);
      if (prevNum === null || newNum === null) continue;
      if (newNum >= prevNum) continue; // must have decreased

      const decrease = prevNum - newNum;

      // A bundled source figure may be split across a subset of newly-filled
      // siblings. For example, 255845 becomes 22148 + 133815 + 99882:
      // only the latter two are the newly-filled sibling fields.
      const siblingValues = nullToNonNull
        .filter(sib => sib.field !== candidate.field)
        .map(sib => toNum(sib.newValue))
        .filter((value): value is number => value !== null);

      if (hasExactSiblingSum(siblingValues, decrease)) {
        granularityFields.add(`${periodId}|${candidate.field}`);
      }
    }
  }

  // ── Classify and emit ────────────────────────────────────────────────────
  for (const ch of rawChanges) {
    let classification: Classification;

    if (ch.prevValue === null && ch.newValue === null) {
      // Excluded above, retained defensively so every category is exhaustive.
      continue;
    } else if (ch.prevValue === null) {
      classification = ch.prevSourceDocId === null ? 'FIRST_WRITE' : 'ENRICHED';
    } else if (ch.newValue === null) {
      classification = 'ERASED';
    } else if (valEq(ch.prevValue, ch.newValue)) {
      classification = 'AGREE';
    } else if (granularityFields.has(`${ch.periodId}|${ch.field}`)) {
      classification = 'GRANULARITY';
    } else {
      classification = 'CONFLICT';
    }

    const fy = periodFY.get(ch.periodId) ?? 0;
    const prevTier = ch.prevSourceDocId !== null ? getTier(ch.prevSourceDocId) : null;

    out.push({
      company: companyName,
      devDocId: doc.devDocId,
      prodDocId: doc.prodDocId,
      filename: doc.filename,
      tier,
      fiscalYear: fy,
      periodId: ch.periodId,
      statement,
      field: ch.field,
      previousValue: ch.prevValue,
      previousSourceDocId: ch.prevSourceDocId,
      previousTier: prevTier,
      newValue: ch.newValue,
      newSourceDocId: ch.newSourceDocId,
      classification,
    });
  }
}

// ─── Markdown generation ─────────────────────────────────────────────────────

function hasExactSiblingSum(values: number[], target: number): boolean {
  if (values.length === 0) return false;

  // Financial statement figures in these captures are non-negative. Sorting
  // gives deterministic pruning while still allowing any non-empty subset.
  const sorted = [...values].sort((a, b) => b - a);
  const suffixSums = new Array<number>(sorted.length + 1).fill(0);
  for (let i = sorted.length - 1; i >= 0; i--) {
    suffixSums[i] = suffixSums[i + 1] + sorted[i];
  }

  const search = (index: number, sum: number, hasSibling: boolean): boolean => {
    if (sum === target) return hasSibling;
    if (index === sorted.length || sum > target || sum + suffixSums[index] < target) return false;
    return search(index + 1, sum + sorted[index], true) || search(index + 1, sum, hasSibling);
  };

  return search(0, 0, false);
}

function fmtVal(v: ScalarValue): string {
  return v === null ? '(null)' : String(v);
}

function fmtDoc(devDocId: number, prodDocId: number, tier: string): string {
  return `doc ${devDocId}/${prodDocId}, tier ${tier}`;
}

function pct(diff: number, base: number): string {
  if (base === 0) return 'n/a';
  return `${((Math.abs(diff) / Math.abs(base)) * 100).toFixed(2)}%`;
}

function buildReport(allEvents: WriteEvent[]): string {
  const lines: string[] = [];

  lines.push('# Audit-1 Conflict Report');
  lines.push('');
  lines.push(`Generated from committed captures — timestamp suppressed for determinism`);
  lines.push('Script: `scripts/audit1-conflict-report.ts`  ');
  lines.push('Source: `audit/pipeline-fidelity/` (committed JSON captures, no DB, no Gemini)  ');
  lines.push('Scope: devDocIds 5830–5840 (Thor-CON), 5857–5872 (Innova), 5873–5883 excl 5878 (Cooper Gibson)');
  lines.push('');
  lines.push('Tier precedence (highest → lowest): T1a > T1b > T2 > T3 > INT > n/a');
  lines.push('');
  lines.push('---');
  lines.push('');

  // ── Compute surviving value per (company, periodId, statement, field) ─────
  // Last write event wins.
  const survivorKey = (e: WriteEvent) => `${e.company}|${e.periodId}|${e.statement}|${e.field}`;
  const survivorMap = new Map<string, WriteEvent>();
  for (const ev of allEvents) {
    survivorMap.set(survivorKey(ev), ev);
  }

  // ── S1 ────────────────────────────────────────────────────────────────────
  lines.push('## S1 — Write History per Company / Fiscal Year / Field');
  lines.push('');
  lines.push('Surviving value marked **bold**. Only fields with at least one write event shown.');
  lines.push('');

  // Group: company → fiscalYear → statement → field → events[]
  const s1: Map<string, Map<number, Map<string, Map<string, WriteEvent[]>>>> = new Map();
  for (const ev of allEvents) {
    if (!s1.has(ev.company)) s1.set(ev.company, new Map());
    const byFY = s1.get(ev.company)!;
    if (!byFY.has(ev.fiscalYear)) byFY.set(ev.fiscalYear, new Map());
    const bySt = byFY.get(ev.fiscalYear)!;
    const stKey = ev.statement;
    if (!bySt.has(stKey)) bySt.set(stKey, new Map());
    const byField = bySt.get(stKey)!;
    if (!byField.has(ev.field)) byField.set(ev.field, []);
    byField.get(ev.field)!.push(ev);
  }

  for (const [company, byFY] of [...s1.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    lines.push(`### ${company}`);
    lines.push('');

    for (const [fy, bySt] of [...byFY.entries()].sort(([a], [b]) => a - b)) {
      lines.push(`#### FY ${fy}`);
      lines.push('');

      for (const [st, byField] of [...bySt.entries()].sort(([a], [b]) => a.localeCompare(b))) {
        lines.push(`##### ${st}`);
        lines.push('');

        for (const [field, events] of [...byField.entries()].sort(([a], [b]) => a.localeCompare(b))) {
          const survEv = survivorMap.get(`${company}|${events[0].periodId}|${st}|${field}`);
          lines.push(`**\`${field}\`** (period ${events[0].periodId})`);
          for (const ev of events) {
            const isSurv = survEv === ev;
            const valStr = `${fmtVal(ev.newValue)} (${fmtDoc(ev.devDocId, ev.prodDocId, ev.tier)}, ${ev.classification})`;
            lines.push(`- ${isSurv ? `**${valStr}** ← surviving` : valStr}`);
          }
          lines.push('');
        }
      }
    }
  }

  lines.push('---');
  lines.push('');

  // ── S2 ────────────────────────────────────────────────────────────────────
  const conflicts = allEvents.filter(e => e.classification === 'CONFLICT');

  lines.push('## S2 — CONFLICT Rows');
  lines.push('');
  lines.push('Sorted: company → fiscal year → field.');
  lines.push('');

  if (conflicts.length === 0) {
    lines.push('*No CONFLICT events.*');
    lines.push('');
  } else {
    const sorted = [...conflicts].sort((a, b) => {
      const co = a.company.localeCompare(b.company);
      if (co !== 0) return co;
      if (a.fiscalYear !== b.fiscalYear) return a.fiscalYear - b.fiscalYear;
      const st = a.statement.localeCompare(b.statement);
      if (st !== 0) return st;
      return a.field.localeCompare(b.field);
    });

    lines.push('| Company | FY | Stmt | Period | Field | Prev value | Prev doc (tier) | New value | New doc (tier) | |Δ| | %Δ |');
    lines.push('|---|---|---|---|---|---|---|---|---|---|---|');

    for (const ev of sorted) {
      const prevDocStr = ev.previousSourceDocId !== null
        ? `${ev.previousSourceDocId}/${ev.prodDocId} (${ev.previousTier ?? 'n/a'})`
        : 'none';
      const newDocStr = `${ev.devDocId}/${ev.prodDocId} (${ev.tier})`;
      const prevNum = toNum(ev.previousValue);
      const newNum  = toNum(ev.newValue);
      let absDiff = 'n/a';
      let pcDiff  = 'n/a';
      if (prevNum !== null && newNum !== null) {
        absDiff = String(Math.abs(newNum - prevNum));
        pcDiff  = pct(newNum - prevNum, prevNum);
      }
      lines.push(
        `| ${ev.company} | ${ev.fiscalYear} | ${ev.statement} | ${ev.periodId} | \`${ev.field}\` ` +
        `| ${fmtVal(ev.previousValue)} | ${prevDocStr} | ${fmtVal(ev.newValue)} | ${newDocStr} ` +
        `| ${absDiff} | ${pcDiff} |`,
      );
    }
    lines.push('');
  }

  lines.push('---');
  lines.push('');

  // ── S3 ────────────────────────────────────────────────────────────────────
  lines.push('## S3 — Counts and Accuracy Rate by Tier Pair');
  lines.push('');

  const classifications: Classification[] = [
    'FIRST_WRITE', 'AGREE', 'GRANULARITY', 'CONFLICT', 'ENRICHED', 'ERASED',
  ];
  const classCounts = new Map<Classification, number>(
    classifications.map(classification => [classification, 0]),
  );
  for (const ev of allEvents) {
    classCounts.set(ev.classification, (classCounts.get(ev.classification) ?? 0) + 1);
  }

  const totalEvents = allEvents.length;
  lines.push(`Total write events (all classifications): **${totalEvents}**`);
  lines.push('');
  for (const classification of classifications) {
    lines.push(`- ${classification}: ${classCounts.get(classification) ?? 0}`);
  }
  lines.push(`- Sum check: ${classifications.map(c => classCounts.get(c) ?? 0).join(' + ')} = ${classifications.reduce((sum, c) => sum + (classCounts.get(c) ?? 0), 0)} (expected ${totalEvents})`);
  lines.push('');
  lines.push('Accuracy rate = **AGREE / (AGREE + CONFLICT)**. Its sample size is the denominator. GRANULARITY, ENRICHED, FIRST_WRITE and ERASED are excluded from this rate.');
  lines.push('');

  type TierPairCounts = Record<Classification, number>;
  const tierPairCounts = new Map<string, TierPairCounts>();
  for (const ev of allEvents) {
    if (ev.previousSourceDocId === null) continue;
    const key = `${ev.previousTier ?? 'n/a'} → ${ev.tier}`;
    if (!tierPairCounts.has(key)) {
      tierPairCounts.set(key, {
        FIRST_WRITE: 0, AGREE: 0, GRANULARITY: 0, CONFLICT: 0, ENRICHED: 0, ERASED: 0,
      });
    }
    tierPairCounts.get(key)![ev.classification]++;
  }

  if (tierPairCounts.size > 0) {
    lines.push('| Tier pair | AGREE | CONFLICT | GRANULARITY | ENRICHED | ERASED | Accuracy rate (AGREE / sample) | Sample size |');
    lines.push('|---|---|---|---|---|---|---|---|');

    const sortedPairs = [...tierPairCounts.entries()].sort(([a], [b]) => a.localeCompare(b));
    for (const [pair, counts] of sortedPairs) {
      const sampleSize = counts.AGREE + counts.CONFLICT;
      const accuracy = sampleSize === 0 ? 'n/a' : `${((counts.AGREE / sampleSize) * 100).toFixed(2)}% (${counts.AGREE}/${sampleSize})`;
      lines.push(`| ${pair} | ${counts.AGREE} | ${counts.CONFLICT} | ${counts.GRANULARITY} | ${counts.ENRICHED} | ${counts.ERASED} | ${accuracy} | ${sampleSize} |`);
    }
    lines.push('');
  } else {
    lines.push('*No writes to existing rows.*');
    lines.push('');
  }

  lines.push('---');
  lines.push('');

  // ── S4 ────────────────────────────────────────────────────────────────────
  lines.push('## S4 — HIGHER TIER DEGRADED BY LOWER TIER');
  lines.push('');
  lines.push('ERASED rows are listed first, followed by CONFLICT rows. Each previous document tier outranks the replacing document tier (T1a > T1b > T2 > T3 > INT > n/a).');
  lines.push('');

  const s4Rows = allEvents.filter(ev => {
    const prevTier = ev.previousTier ?? 'n/a';
    return (ev.classification === 'ERASED' || ev.classification === 'CONFLICT')
      && isHigherTier(prevTier, ev.tier);
  });

  if (s4Rows.length === 0) {
    lines.push('*No higher-tier values were degraded by a lower-tier document.*');
    lines.push('');
  } else {
    const sortedS4 = [...s4Rows].sort((a, b) => {
      const classOrder = a.classification === 'ERASED' ? 0 : 1;
      const otherClassOrder = b.classification === 'ERASED' ? 0 : 1;
      if (classOrder !== otherClassOrder) return classOrder - otherClassOrder;
      const co = a.company.localeCompare(b.company);
      if (co !== 0) return co;
      if (a.fiscalYear !== b.fiscalYear) return a.fiscalYear - b.fiscalYear;
      const st = a.statement.localeCompare(b.statement);
      if (st !== 0) return st;
      return a.field.localeCompare(b.field);
    });

    lines.push('| Class | Company | FY | Stmt | Period | Field | High-tier value | High-tier doc | Lower-tier value | Lower-tier doc |');
    lines.push('|---|---|---|---|---|---|---|---|---|---|');
    for (const ev of sortedS4) {
      const prevDocStr = ev.previousSourceDocId !== null
        ? `${ev.previousSourceDocId} (${ev.previousTier ?? 'n/a'})`
        : 'none';
      lines.push(
        `| ${ev.classification} | ${ev.company} | ${ev.fiscalYear} | ${ev.statement} | ${ev.periodId} | \`${ev.field}\` ` +
        `| ${fmtVal(ev.previousValue)} | ${prevDocStr} | ${fmtVal(ev.newValue)} | ${ev.devDocId} (${ev.tier}) |`,
      );
    }
    lines.push('');
  }

  lines.push('---');
  lines.push('');

  // ── S5 ────────────────────────────────────────────────────────────────────
  lines.push('## S5 — All ERASED Rows');
  lines.push('');
  lines.push('Grouped by company and fiscal year; every row where a later document replaced a non-null value with null.');
  lines.push('');

  const erasedRows = allEvents
    .filter(ev => ev.classification === 'ERASED')
    .sort((a, b) => {
      const co = a.company.localeCompare(b.company);
      if (co !== 0) return co;
      if (a.fiscalYear !== b.fiscalYear) return a.fiscalYear - b.fiscalYear;
      const st = a.statement.localeCompare(b.statement);
      if (st !== 0) return st;
      return a.field.localeCompare(b.field);
    });

  if (erasedRows.length === 0) {
    lines.push('*No ERASED rows.*');
    lines.push('');
  } else {
    let currentCompany = '';
    let currentYear = -1;
    for (const ev of erasedRows) {
      if (ev.company !== currentCompany) {
        currentCompany = ev.company;
        currentYear = -1;
        lines.push(`### ${currentCompany}`);
        lines.push('');
      }
      if (ev.fiscalYear !== currentYear) {
        currentYear = ev.fiscalYear;
        lines.push(`#### FY ${currentYear}`);
        lines.push('');
        lines.push('| Stmt | Period | Field | Erased value | Previous doc (tier) | Erasing doc (tier) |');
        lines.push('|---|---|---|---|---|---|');
      }
      lines.push(
        `| ${ev.statement} | ${ev.periodId} | \`${ev.field}\` | ${fmtVal(ev.previousValue)} ` +
        `| ${ev.previousSourceDocId} (${ev.previousTier ?? 'n/a'}) | ${ev.devDocId} (${ev.tier}) |`,
      );
    }
    lines.push('');
  }

  // ── S6 ────────────────────────────────────────────────────────────────────
  lines.push('---');
  lines.push('');
  lines.push('## S6 — Same-Tier CONFLICT Rows');
  lines.push('');
  lines.push('All CONFLICT rows where the previous and new documents have the same tier. Document IDs are the dev capture document IDs.');
  lines.push('');

  for (const tier of ['T1a', 'T1b']) {
    const sameTierConflicts = conflicts
      .filter(ev => ev.previousTier === tier && ev.tier === tier)
      .sort((a, b) => {
        const co = a.company.localeCompare(b.company);
        if (co !== 0) return co;
        if (a.fiscalYear !== b.fiscalYear) return a.fiscalYear - b.fiscalYear;
        const st = a.statement.localeCompare(b.statement);
        if (st !== 0) return st;
        return a.field.localeCompare(b.field);
      });

    lines.push(`### ${tier} → ${tier}`);
    lines.push('');
    if (sameTierConflicts.length === 0) {
      lines.push('*No matching CONFLICT rows.*');
      lines.push('');
      continue;
    }

    lines.push('| Company | FY | Statement | Field | Previous value | New value | Previous doc ID | New doc ID |');
    lines.push('|---|---|---|---|---|---|---|---|');
    for (const ev of sameTierConflicts) {
      lines.push(
        `| ${ev.company} | ${ev.fiscalYear} | ${ev.statement} | \`${ev.field}\` ` +
        `| ${fmtVal(ev.previousValue)} | ${fmtVal(ev.newValue)} | ${ev.previousSourceDocId} | ${ev.devDocId} |`,
      );
    }
    lines.push('');
  }

  return lines.join('\n');
}

// ─── Main ────────────────────────────────────────────────────────────────────

function main(): void {
  const allEvents: WriteEvent[] = [];

  for (const co of COMPANIES) {
    const rawDir  = path.join(AUDIT_DIR, co.dir, 'raw');
    const mapPath = path.join(rawDir, 'phase1-doc-map.json');

    if (!fs.existsSync(mapPath)) {
      console.error(`Missing: ${mapPath}`);
      process.exit(1);
    }

    const docMap = readJson(mapPath) as DocEntry[];
    console.log(`Processing ${co.name}: ${docMap.length} docs`);

    const events = processCompany(co.name, rawDir, docMap);
    console.log(`  → ${events.length} write events`);
    allEvents.push(...events);
  }

  console.log(`\nTotal write events across all companies: ${allEvents.length}`);

  const md = buildReport(allEvents);

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, md, 'utf8');
  console.log(`\nOutput: ${OUTPUT_PATH}`);
}

main();
