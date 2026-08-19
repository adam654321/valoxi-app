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

type Classification = 'FIRST_WRITE' | 'AGREE' | 'GRANULARITY' | 'CONFLICT';

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
  previousValue: string | null;
  previousSourceDocId: number | null;
  previousTier: string | null;
  newValue: string | null;
  newSourceDocId: number;
  classification: Classification;
}

// ─── Value normalisation ─────────────────────────────────────────────────────

/**
 * Canonical string form of a scalar value.
 * - null / undefined / '' → null
 * - Valid numeric string → String(Number(s))  so "0" == 0 and "1.0" == "1"
 * - Other strings → trimmed string
 */
function norm(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (s === '') return null;
  const n = Number(s);
  if (!isNaN(n)) return String(n);
  return s;
}

function valEq(a: unknown, b: unknown): boolean {
  return norm(a) === norm(b);
}

function toNum(v: string | null): number | null {
  if (v === null) return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

// ─── Field extraction ────────────────────────────────────────────────────────

/**
 * Extract scalar fields from an IS or BS row, recursing one level into
 * named nested objects. Returns field → normalised value.
 */
function extractFields(
  row: Record<string, unknown>,
  scalarFields: readonly string[],
  nestedFields: readonly string[],
): Map<string, string | null> {
  const out = new Map<string, string | null>();
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

  // ── Collect all raw changes for this (devDocId, statement) batch ──────────
  // We need them all before classifying so GRANULARITY can inspect siblings.

  interface RawChange {
    periodId: number;
    field: string;
    prevValue: string | null;
    prevSourceDocId: number | null;
    newValue: string | null;
    newSourceDocId: number;
  }

  const rawChanges: RawChange[] = [];

  for (const afterRow of afterRows) {
    const periodId = afterRow.financialPeriodId as number;
    const afterFields = extractFields(afterRow, scalarFields, nestedFields);
    const newSourceDocId = afterRow.sourceDocumentId as number;

    const beforeRow = beforeByPeriod.get(periodId);

    if (!beforeRow) {
      // New period — all non-null fields are FIRST_WRITE
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
      // Existing period — compare every field
      const beforeFields = extractFields(beforeRow, scalarFields, nestedFields);
      const prevSourceDocId = beforeRow.sourceDocumentId as number;

      for (const [field, newVal] of afterFields) {
        const prevVal = beforeFields.get(field) ?? null;
        if (!valEq(prevVal, newVal)) {
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

      // Sum ALL null→non-null siblings (excluding the candidate field itself)
      let sibSum = 0;
      let sibCount = 0;
      for (const sib of nullToNonNull) {
        if (sib.field === candidate.field) continue;
        const sibNum = toNum(sib.newValue);
        if (sibNum === null) continue;
        sibSum += sibNum;
        sibCount++;
      }

      if (sibCount > 0 && Math.abs(sibSum - decrease) < 0.0001) {
        granularityFields.add(`${periodId}|${candidate.field}`);
      }
    }
  }

  // ── Classify and emit ────────────────────────────────────────────────────
  for (const ch of rawChanges) {
    let classification: Classification;

    if (ch.prevValue === null) {
      classification = 'FIRST_WRITE';
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

function fmtVal(v: string | null): string {
  return v === null ? '(null)' : v;
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
  lines.push('## S3 — Counts');
  lines.push('');

  // Distinct (company, periodId, statement, field) tuples with ≥1 write
  const fieldKeys = new Map<string, WriteEvent[]>(); // key → all events for that field-slot
  for (const ev of allEvents) {
    const k = `${ev.company}|${ev.periodId}|${ev.statement}|${ev.field}`;
    if (!fieldKeys.has(k)) fieldKeys.set(k, []);
    fieldKeys.get(k)!.push(ev);
  }

  const totalFieldsWritten = fieldKeys.size;
  const multiWriteSlots = [...fieldKeys.entries()].filter(([, evs]) => evs.length > 1);
  const totalMultiWrite = multiWriteSlots.length;

  // For multi-write slots, classify the overwrite events (all events after first)
  // Actually the classification is already on each event — AGREE/GRANULARITY/CONFLICT
  // counts for events that replaced a non-null value (i.e. non-FIRST_WRITE overwrites)
  let agreeCount     = 0;
  let granCount      = 0;
  let conflictCount  = 0;

  // Count GRANULARITY events (each GRANULARITY-classified event = one bundled field)
  // Per spec: "Report as a count only, do not list individually"
  for (const ev of allEvents) {
    if (ev.classification === 'AGREE')      agreeCount++;
    if (ev.classification === 'GRANULARITY') granCount++;
    if (ev.classification === 'CONFLICT')   conflictCount++;
  }

  const totalEvents = allEvents.length;
  const firstWriteCount = allEvents.filter(e => e.classification === 'FIRST_WRITE').length;

  lines.push(`Total write events (all classifications): **${totalEvents}**`);
  lines.push('');
  lines.push(`- FIRST_WRITE: ${firstWriteCount}`);
  lines.push(`- AGREE:       ${agreeCount}`);
  lines.push(`- GRANULARITY: ${granCount}`);
  lines.push(`- CONFLICT:    ${conflictCount}`);
  lines.push(`- Sum check:   ${firstWriteCount} + ${agreeCount} + ${granCount} + ${conflictCount} = ${firstWriteCount + agreeCount + granCount + conflictCount} (expected ${totalEvents})`);
  lines.push('');
  lines.push(`Distinct (company, period, statement, field) slots written: **${totalFieldsWritten}**`);
  lines.push(`Slots written by more than one document: **${totalMultiWrite}**`);
  lines.push('');

  // Tier-pair breakdown for AGREE / GRANULARITY / CONFLICT events
  // (events where prevValue was non-null, i.e. not FIRST_WRITE)
  const overwrites = allEvents.filter(e => e.classification !== 'FIRST_WRITE' && e.previousValue !== null);

  // Count by tier pair
  const tierPairCounts = new Map<string, { agree: number; gran: number; conflict: number }>();
  for (const ev of overwrites) {
    const prevTier = ev.previousTier ?? 'n/a';
    const newTier  = ev.tier;
    const key = `${prevTier} → ${newTier}`;
    if (!tierPairCounts.has(key)) tierPairCounts.set(key, { agree: 0, gran: 0, conflict: 0 });
    const c = tierPairCounts.get(key)!;
    if (ev.classification === 'AGREE')      c.agree++;
    if (ev.classification === 'GRANULARITY') c.gran++;
    if (ev.classification === 'CONFLICT')   c.conflict++;
  }

  if (tierPairCounts.size > 0) {
    lines.push('### Breakdown by tier pair (prev tier → new tier)');
    lines.push('');
    lines.push('| Tier pair | AGREE | GRANULARITY | CONFLICT | Total |');
    lines.push('|---|---|---|---|---|');

    const sortedPairs = [...tierPairCounts.entries()].sort(([a], [b]) => a.localeCompare(b));
    for (const [pair, c] of sortedPairs) {
      const total = c.agree + c.gran + c.conflict;
      lines.push(`| ${pair} | ${c.agree} | ${c.gran} | ${c.conflict} | ${total} |`);
    }
    // Totals row
    let totAgree = 0, totGran = 0, totConf = 0;
    for (const c of tierPairCounts.values()) { totAgree += c.agree; totGran += c.gran; totConf += c.conflict; }
    lines.push(`| **Total** | **${totAgree}** | **${totGran}** | **${totConf}** | **${totAgree + totGran + totConf}** |`);
    lines.push('');
  } else {
    lines.push('*No overwrite events.*');
    lines.push('');
  }

  lines.push('---');
  lines.push('');

  // ── S4 ────────────────────────────────────────────────────────────────────
  lines.push('## S4 — CONFLICT: Higher-Tier Value Replaced by Lower-Tier');
  lines.push('');
  lines.push('Rows where the previous value came from a document of higher precedence (T1a > T1b > T2 > T3 > INT > n/a) and was overwritten by a document of lower precedence.');
  lines.push('');

  const s4Rows = conflicts.filter(ev => {
    const prevTier = ev.previousTier ?? 'n/a';
    return isHigherTier(prevTier, ev.tier);
  });

  if (s4Rows.length === 0) {
    lines.push('*No conflicts where a higher-tier value was replaced by a lower-tier one.*');
    lines.push('');
  } else {
    const sortedS4 = [...s4Rows].sort((a, b) => {
      const co = a.company.localeCompare(b.company);
      if (co !== 0) return co;
      if (a.fiscalYear !== b.fiscalYear) return a.fiscalYear - b.fiscalYear;
      const st = a.statement.localeCompare(b.statement);
      if (st !== 0) return st;
      return a.field.localeCompare(b.field);
    });

    lines.push('| Company | FY | Stmt | Period | Field | High-tier value | High-tier doc | Low-tier value | Low-tier doc |');
    lines.push('|---|---|---|---|---|---|---|---|---|');
    for (const ev of sortedS4) {
      const prevDocStr = ev.previousSourceDocId !== null
        ? `${ev.previousSourceDocId} (${ev.previousTier ?? 'n/a'})`
        : 'none';
      lines.push(
        `| ${ev.company} | ${ev.fiscalYear} | ${ev.statement} | ${ev.periodId} | \`${ev.field}\` ` +
        `| ${fmtVal(ev.previousValue)} | ${prevDocStr} | ${fmtVal(ev.newValue)} | ${ev.devDocId} (${ev.tier}) |`,
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
