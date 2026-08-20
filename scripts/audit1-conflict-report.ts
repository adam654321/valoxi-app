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

// ─── R1: brief scope filter ──────────────────────────────────────────────────
// BRIEF-extraction-accuracy-audit.md, SCOPE: "Breakdown detail and residual
// other_* buckets are OUT of scope; item 429 measured them unstable by nature
// and they do not carry a valuation."
// Applied to the GATE tables only. Enumeration stays complete so the 1,425
// total and sections S1-S5 remain the full audit trail.

const OUT_OF_SCOPE_PREFIXES = ['costOfSalesBreakdown.', 'overheadsBreakdown.'] as const;

const OUT_OF_SCOPE_FIELDS = new Set<string>([
  'otherOperatingIncome', 'otherDebtors', 'otherCreditors', 'otherLongTermDebt',
]);

function isInScope(field: string): boolean {
  if (OUT_OF_SCOPE_PREFIXES.some(p => field.startsWith(p))) return false;
  return !OUT_OF_SCOPE_FIELDS.has(field);
}

// ─── R2: reverse granularity, DECLARED RULES ONLY ────────────────────────────
// A split replaced by its bundled parent. Deliberately NOT a general arithmetic
// rule. A generic "increase equals the sum of siblings erased in the same event"
// rule was tested against these captures and rejected: it fires six times and
// only one is genuine. It also matches
//   - the Midland FY2023 restatement: retainedEarnings 164,400 -> 168,834 and
//     totalEquity 164,500 -> 168,934, each +4,434, against deferredTaxation
//     4,434 erased in the same event; and
//   - defect D3: tradeDebtors 470,739 -> 553,354 against prepayments 81,765 +
//     otherDebtors 850 erased.
// Arithmetic cannot separate reverse granularity from a mislabelled bundle,
// because D3 IS a bundle replacing a split. A generic rule would silently
// reclassify a restatement and a known defect as not-a-conflict.
const REVERSE_GRANULARITY_RULES: ReadonlyArray<{ parent: string; children: readonly string[] }> = [
  // Midland: doc 5830 splits tangible assets into plant and leasehold;
  // doc 5831 reports the bundled total. 35,376 + 10,231 = 45,607.
  { parent: 'plantMachinery', children: ['leaseholdProperty'] },
];

// ─── Adjudication: conflicts that are documented not-a-defect ────────────────
// Key: `${previousSourceDocId}|${devDocId}`. Declared, itemised, never silent.
// Every excluded row is listed in section S8.

/** Midland FY2023 as-filed vs as-restated. Product decision 20 Aug 2026:
 *  show the restated figures, keep both versions, surface as a step 3
 *  CONFLICTED case. Not an extraction defect. */
const RESTATEMENT_PAIRS = new Set<string>(['5830|5831']);

/** Document pairs that are md5-identical on input (v81 section 4.4).
 *  A conflict between byte-identical inputs measures nondeterminism (D4),
 *  not extraction accuracy against source. */
const IDENTICAL_INPUT_PAIRS = new Set<string>([
  '5857|5867', '5867|5857', '5861|5868', '5868|5861',
]);

// ─── Types ───────────────────────────────────────────────────────────────────

type Classification =
  | 'FIRST_WRITE'
  | 'AGREE'
  | 'GRANULARITY'
  | 'GRANULARITY_REVERSE'
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
  inScope: boolean;
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
      inScope: isInScope(ch.field),
    });
  }
}

// ─── R2 post-pass ────────────────────────────────────────────────────────────

interface ReverseGranularityHit {
  company: string;
  devDocId: number;
  statement: 'IS' | 'BS';
  periodId: number;
  fiscalYear: number;
  parent: string;
  prev: number;
  next: number;
  children: Array<{ field: string; value: number }>;
}

/**
 * Reclassify declared parent<-child reverse-granularity pairs from
 * CONFLICT + ERASED to GRANULARITY_REVERSE. Requires an EXACT arithmetic
 * match in addition to the declared rule. Mutates events in place.
 */
function applyReverseGranularity(events: WriteEvent[]): ReverseGranularityHit[] {
  const hits: ReverseGranularityHit[] = [];

  const groups = new Map<string, WriteEvent[]>();
  for (const ev of events) {
    const k = `${ev.devDocId}|${ev.statement}|${ev.periodId}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(ev);
  }

  for (const group of groups.values()) {
    for (const rule of REVERSE_GRANULARITY_RULES) {
      const parent = group.find(e => e.field === rule.parent && e.classification === 'CONFLICT');
      if (!parent) continue;

      const prev = toNum(parent.previousValue);
      const next = toNum(parent.newValue);
      if (prev === null || next === null || next <= prev) continue;

      const children: WriteEvent[] = [];
      for (const childField of rule.children) {
        const child = group.find(e => e.field === childField && e.classification === 'ERASED');
        if (!child) break;
        children.push(child);
      }
      if (children.length !== rule.children.length) continue;

      let sum = 0;
      let ok = true;
      for (const child of children) {
        const v = toNum(child.previousValue);
        if (v === null) { ok = false; break; }
        sum += v;
      }
      if (!ok) continue;
      if (prev + sum !== next) continue;

      parent.classification = 'GRANULARITY_REVERSE';
      for (const child of children) child.classification = 'GRANULARITY_REVERSE';

      hits.push({
        company: parent.company,
        devDocId: parent.devDocId,
        statement: parent.statement,
        periodId: parent.periodId,
        fiscalYear: parent.fiscalYear,
        parent: rule.parent,
        prev,
        next,
        children: children.map(c => ({ field: c.field, value: toNum(c.previousValue)! })),
      });
    }
  }

  return hits.sort((a, b) =>
    a.company.localeCompare(b.company)
    || a.devDocId - b.devDocId
    || a.periodId - b.periodId
    || a.parent.localeCompare(b.parent));
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

function isAdjudicatedOut(ev: WriteEvent): 'RESTATEMENT' | 'IDENTICAL_INPUT' | null {
  if (ev.classification !== 'CONFLICT') return null;
  if (ev.previousSourceDocId === null) return null;
  const pair = `${ev.previousSourceDocId}|${ev.devDocId}`;
  if (RESTATEMENT_PAIRS.has(pair)) return 'RESTATEMENT';
  if (IDENTICAL_INPUT_PAIRS.has(pair)) return 'IDENTICAL_INPUT';
  return null;
}

function buildReport(allEvents: WriteEvent[], reverseHits: ReverseGranularityHit[]): string {
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
    'FIRST_WRITE', 'AGREE', 'GRANULARITY', 'GRANULARITY_REVERSE', 'CONFLICT', 'ENRICHED', 'ERASED',
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
  lines.push('Accuracy rate = **AGREE / (AGREE + CONFLICT)**. Its sample size is the denominator. GRANULARITY, GRANULARITY_REVERSE, ENRICHED, FIRST_WRITE and ERASED are excluded from this rate.');
  lines.push('');

  type TierPairCounts = Record<Classification, number>;

  const tierPairTable = (filter: (ev: WriteEvent) => boolean): string[] => {
    const out: string[] = [];
    const tierPairCounts = new Map<string, TierPairCounts>();
    for (const ev of allEvents) {
      if (ev.previousSourceDocId === null) continue;
      if (!filter(ev)) continue;
      const key = `${ev.previousTier ?? 'n/a'} → ${ev.tier}`;
      if (!tierPairCounts.has(key)) {
        tierPairCounts.set(key, {
          FIRST_WRITE: 0, AGREE: 0, GRANULARITY: 0, GRANULARITY_REVERSE: 0,
          CONFLICT: 0, ENRICHED: 0, ERASED: 0,
        });
      }
      tierPairCounts.get(key)![ev.classification]++;
    }

    if (tierPairCounts.size === 0) {
      out.push('*No writes to existing rows.*');
      out.push('');
      return out;
    }

    out.push('| Tier pair | AGREE | CONFLICT | GRANULARITY | GRAN_REV | ENRICHED | ERASED | Accuracy rate (AGREE / sample) | Sample size |');
    out.push('|---|---|---|---|---|---|---|---|---|');
    const sortedPairs = [...tierPairCounts.entries()].sort(([a], [b]) => a.localeCompare(b));
    for (const [pair, counts] of sortedPairs) {
      const sampleSize = counts.AGREE + counts.CONFLICT;
      const accuracy = sampleSize === 0 ? 'n/a' : `${((counts.AGREE / sampleSize) * 100).toFixed(2)}% (${counts.AGREE}/${sampleSize})`;
      out.push(`| ${pair} | ${counts.AGREE} | ${counts.CONFLICT} | ${counts.GRANULARITY} | ${counts.GRANULARITY_REVERSE} | ${counts.ENRICHED} | ${counts.ERASED} | ${accuracy} | ${sampleSize} |`);
    }
    out.push('');
    return out;
  };

  lines.push('### S3.1 — All fields, unfiltered');
  lines.push('');
  lines.push('Reconciles to the total above. Retained as the full audit trail. NOT the gate.');
  lines.push('');
  lines.push(...tierPairTable(() => true));

  lines.push('### S3.2 — IN SCOPE (R1) — the measured gate');
  lines.push('');
  lines.push('Excludes `costOfSalesBreakdown.*`, `overheadsBreakdown.*` and the residual buckets');
  lines.push('`otherOperatingIncome`, `otherDebtors`, `otherCreditors`, `otherLongTermDebt`,');
  lines.push('per BRIEF-extraction-accuracy-audit.md SCOPE and item 429.');
  lines.push('');
  lines.push(...tierPairTable(ev => ev.inScope));

  lines.push('### S3.3 — ADJUDICATED — the honest gate');
  lines.push('');
  lines.push('In scope, less conflicts that are documented not-a-defect: the Midland FY2023');
  lines.push('restatement (5830 vs 5831) and conflicts between md5-identical inputs.');
  lines.push('Every excluded row is itemised in S8.');
  lines.push('');
  lines.push(...tierPairTable(ev => ev.inScope && isAdjudicatedOut(ev) === null));

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

  const sortConflicts = (rows: WriteEvent[]): WriteEvent[] => [...rows].sort((a, b) => {
    const co = a.company.localeCompare(b.company);
    if (co !== 0) return co;
    if (a.fiscalYear !== b.fiscalYear) return a.fiscalYear - b.fiscalYear;
    const st = a.statement.localeCompare(b.statement);
    if (st !== 0) return st;
    return a.field.localeCompare(b.field);
  });

  for (const tier of ['T1a', 'T1b']) {
    for (const scope of [true, false]) {
      const rows = sortConflicts(conflicts.filter(
        ev => ev.previousTier === tier && ev.tier === tier && ev.inScope === scope,
      ));

      lines.push(`### ${tier} → ${tier} — ${scope ? 'IN SCOPE' : 'OUT OF SCOPE (R1)'}`);
      lines.push('');
      if (rows.length === 0) {
        lines.push('*No matching CONFLICT rows.*');
        lines.push('');
        continue;
      }

      lines.push('| Company | FY | Statement | Field | Previous value | New value | Previous doc ID | New doc ID | Adjudication |');
      lines.push('|---|---|---|---|---|---|---|---|---|');
      for (const ev of rows) {
        lines.push(
          `| ${ev.company} | ${ev.fiscalYear} | ${ev.statement} | \`${ev.field}\` ` +
          `| ${fmtVal(ev.previousValue)} | ${fmtVal(ev.newValue)} | ${ev.previousSourceDocId} | ${ev.devDocId} ` +
          `| ${isAdjudicatedOut(ev) ?? 'UNEXPLAINED'} |`,
        );
      }
      lines.push('');
    }
  }

  // ── S7 ────────────────────────────────────────────────────────────────────
  lines.push('---');
  lines.push('');
  lines.push('## S7 — Reverse-Granularity Reclassifications (R2)');
  lines.push('');
  lines.push('Declared parent-child rules only, each additionally requiring an exact');
  lines.push('arithmetic match. Every reclassification is listed here. Nothing is silent.');
  lines.push('');
  if (reverseHits.length === 0) {
    lines.push('*No reverse-granularity reclassifications.*');
    lines.push('');
  } else {
    lines.push('| Company | FY | Stmt | Period | Parent field | Prev | New | Erased children | Arithmetic |');
    lines.push('|---|---|---|---|---|---|---|---|---|');
    for (const h of reverseHits) {
      const kids = h.children.map(c => `\`${c.field}\` ${c.value}`).join(' + ');
      const sums = h.children.map(c => String(c.value)).join(' + ');
      lines.push(
        `| ${h.company} | ${h.fiscalYear} | ${h.statement} | ${h.periodId} | \`${h.parent}\` ` +
        `| ${h.prev} | ${h.next} | ${kids} | ${h.prev} + ${sums} = ${h.next} |`,
      );
    }
    lines.push('');
  }

  // ── S8 ────────────────────────────────────────────────────────────────────
  lines.push('---');
  lines.push('');
  lines.push('## S8 — Adjudication Ledger');
  lines.push('');
  lines.push('Every in-scope CONFLICT row excluded from the S3.3 rate, with its reason.');
  lines.push('');
  const adjudicated = sortConflicts(allEvents.filter(ev => ev.inScope && isAdjudicatedOut(ev) !== null));
  if (adjudicated.length === 0) {
    lines.push('*No adjudicated exclusions.*');
    lines.push('');
  } else {
    lines.push('| Reason | Company | FY | Stmt | Field | Previous value | New value | Prev doc | New doc |');
    lines.push('|---|---|---|---|---|---|---|---|---|');
    for (const ev of adjudicated) {
      lines.push(
        `| ${isAdjudicatedOut(ev)} | ${ev.company} | ${ev.fiscalYear} | ${ev.statement} | \`${ev.field}\` ` +
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

  const reverseHits = applyReverseGranularity(allEvents);
  console.log(`R2 reverse-granularity reclassifications (declared rules only): ${reverseHits.length}`);

  const md = buildReport(allEvents, reverseHits);

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, md, 'utf8');
  console.log(`\nOutput: ${OUTPUT_PATH}`);
}

main();
