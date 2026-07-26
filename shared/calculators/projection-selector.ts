import { hasCoreIncomeValue, hasCoreBalanceValue } from '../utils/has-any-value';

export type SourceTier =
  | 'user_override'
  | 'statutory'
  | 'management'
  | 'information_memorandum';

const TIER_RANK: Record<SourceTier, number> = {
  user_override: 0,
  statutory: 1,
  management: 2,
  information_memorandum: 3,
};

export interface Contribution {
  id: number;
  targetCompanyId: number;
  fiscalYear: number | null;
  statementType: string;
  sourceTier: string;
  isFullYear: boolean;
  isPrimaryYear?: boolean | null;
  monthsCovered?: number | null;
  periodEnd?: string | null;
  asAtDate?: string | null;
  figures: unknown;
  createdAt: Date | string | null;
  sourceDocumentId?: number | null;
}

export interface Winner extends Contribution {
  _groupKey: string;
}

function groupKey(c: Contribution): string {
  return `${c.fiscalYear ?? 'null'}|${c.statementType}|${c.isFullYear ? '1' : '0'}`;
}

function tierRank(tier: string): number {
  return (TIER_RANK as Record<string, number>)[tier] ?? 99;
}

function createdAtMs(c: Contribution): number {
  if (!c.createdAt) return 0;
  const d = c.createdAt instanceof Date ? c.createdAt : new Date(c.createdAt);
  return isNaN(d.getTime()) ? 0 : d.getTime();
}

/**
 * Comparison function for sorting contributions by precedence (ascending = best first).
 *
 * Precedence (lower rank wins):
 *   1. Tier rank: user_override=0, statutory=1, management=2, information_memorandum=3
 *   2. is_primary_year: true beats false
 *   3. Most recent createdAt
 *   4. Highest sourceDocumentId
 */
function compareByRank(a: Contribution, b: Contribution): number {
  const rankDiff = tierRank(a.sourceTier) - tierRank(b.sourceTier);
  if (rankDiff !== 0) return rankDiff;

  const aPrimary = a.isPrimaryYear !== false;
  const bPrimary = b.isPrimaryYear !== false;
  if (aPrimary !== bPrimary) return aPrimary ? -1 : 1;

  const tsDiff = createdAtMs(b) - createdAtMs(a); // descending: more recent first
  if (tsDiff !== 0) return tsDiff;

  return (b.sourceDocumentId ?? 0) - (a.sourceDocumentId ?? 0); // descending: higher id first
}

/**
 * Pure, deterministic function: given an array of financial contributions for
 * ONE company, returns exactly one winner per (fiscalYear, statementType, isFullYear)
 * slot.
 *
 * Precedence (lower rank wins):
 *   1. Tier rank: user_override=0, statutory=1, management=2, information_memorandum=3
 *   2. is_primary_year: true beats false (primary filing beats a comparative year from another doc)
 *   3. Most recent createdAt
 *   4. Highest sourceDocumentId
 *
 * Income fall-through (Slice 22):
 *   For income contributions, a candidate with no core P&L figures (null/absent
 *   turnover, grossProfit, operatingProfit, costOfSales, profitBeforeTax) is
 *   skipped in favour of the next-ranked candidate that does have figures.
 *   Numeric 0 counts as present — only null/undefined/absent triggers the skip.
 *   If NO candidate has core figures, the top-ranked is returned as-is (£0 is
 *   correct when no real figures exist for that year).
 *   Balance-sheet winner selection is untouched.
 *
 * Part-year (isFullYear=false) and full-year (isFullYear=true) are independent
 * groups and both survive.
 */
export function selectProjectionWinners(contribs: Contribution[]): Winner[] {
  const groups = new Map<string, Contribution[]>();

  for (const c of contribs) {
    const key = groupKey(c);
    const bucket = groups.get(key);
    if (bucket) {
      bucket.push(c);
    } else {
      groups.set(key, [c]);
    }
  }

  const winners: Winner[] = [];

  for (const [key, bucket] of groups) {
    const sorted = [...bucket].sort(compareByRank);

    let winner: Contribution;

    if (sorted[0]?.statementType === 'income') {
      // Fall-through: skip candidates whose figures contain no core P&L value.
      // A lower-ranked candidate with real figures beats a higher-ranked one with none.
      winner =
        sorted.find(c =>
          hasCoreIncomeValue((c.figures ?? {}) as Record<string, unknown>),
        ) ?? sorted[0]; // fall back to top-ranked when ALL are empty (£0/absent is correct)
    } else {
      // Balance fall-through, mirror of the income guard above: skip
      // candidates whose figures contain no core balance value. Legacy
      // backfilled contributions can be all-null (the ingestion guard
      // postdates them). Fall back to top-ranked when ALL are empty.
      winner =
        sorted.find(c =>
          hasCoreBalanceValue((c.figures ?? {}) as Record<string, unknown>),
        ) ?? sorted[0];
    }

    winners.push({ ...winner, _groupKey: key });
  }

  return winners;
}
