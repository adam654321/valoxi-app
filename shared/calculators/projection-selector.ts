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
    const winner = bucket.reduce((best, candidate) => {
      const rankDiff = tierRank(candidate.sourceTier) - tierRank(best.sourceTier);
      if (rankDiff < 0) return candidate;
      if (rankDiff > 0) return best;

      // Primary year beats comparative: null/undefined treated as true (legacy rows)
      const candidatePrimary = candidate.isPrimaryYear !== false;
      const bestPrimary = best.isPrimaryYear !== false;
      if (candidatePrimary && !bestPrimary) return candidate;
      if (!candidatePrimary && bestPrimary) return best;

      const tsDiff = createdAtMs(candidate) - createdAtMs(best);
      if (tsDiff > 0) return candidate;
      if (tsDiff < 0) return best;

      const docA = candidate.sourceDocumentId ?? 0;
      const docB = best.sourceDocumentId ?? 0;
      return docA > docB ? candidate : best;
    });

    winners.push({ ...winner, _groupKey: key });
  }

  return winners;
}
