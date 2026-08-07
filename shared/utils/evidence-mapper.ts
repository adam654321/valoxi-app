/**
 * Slice 1b: pure mapper — no DB access, no side effects.
 * Converts a raw Gemini extraction payload into the row shapes
 * for document_evidence, document_evidence_period, and document_evidence_figure.
 *
 * Values are preserved exactly as extracted. No abs(), no rounding,
 * no sign normalisation.
 */
import { createHash } from 'node:crypto';

export interface EvidenceFigure {
  statementType: string;
  fieldKey: string;
  value: number;
  labelTextAsPrinted: string | null;
  pageNumber: number | null;
  payloadPath: string;
  isModelDerived: boolean;
}

export type AnomalySeverity = 'trust_blocking' | 'informational';

export interface EvidenceAnomaly {
  type: string;
  severity: AnomalySeverity;
  detail: Record<string, unknown>;
}

export interface EvidencePeriod {
  fiscalYearStated: number;
  periodStart: string | null;
  periodEnd: string | null;
  monthsCoveredStated: number | null;
  anomalies: EvidenceAnomaly[];
  figures: EvidenceFigure[];
}

export interface EvidenceRow {
  targetCompanyId: number;
  documentId: number;
  documentAnalysisResultId: number | null;
  documentType: string;
  extractionVersion: number;
  contentHash: string | null;
  extractor: string | null;
  companyNamesFound: string[] | null;
  registeredNumbersFound: string[] | null;
  yearEndStated: string | null;
  directorsNamed: string[] | null;
  accountantName: string | null;
  isDraft: boolean | null;
  isAbridged: boolean | null;
  isSigned: boolean | null;
  reportDate: string | null;
  identityVerdict: null;
}

export interface MapPayloadInput {
  targetCompanyId: number;
  documentId: number;
  documentAnalysisResultId: number | null;
  documentType: string;
  extractionVersion: number;
  payload: Record<string, unknown>;
  /** Resolved Gemini model string, e.g. 'gemini-2.5-flash'. */
  model?: string;
  /** Prompt generation identifier from shared/prompt-version.ts. */
  promptVersion?: string;
}

export interface MapPayloadOutput {
  evidence: EvidenceRow;
  periods: EvidencePeriod[];
}

/**
 * Walk an arbitrary nested object, collecting leaf nodes whose values are
 * finite numbers. Rules:
 *   - null/undefined → skip
 *   - arrays → skip entirely (produce nothing)
 *   - key named exactly "year" → skip
 *   - finite number → emit a figure
 *   - object (including empty) → recurse; empty objects yield nothing naturally
 */
function walkForFigures(
  obj: unknown,
  path: string,
  figures: EvidenceFigure[],
  anchors: Record<string, unknown>,
): void {
  if (obj === null || obj === undefined) return;
  if (Array.isArray(obj)) return;
  if (typeof obj !== 'object') return;

  for (const key of Object.keys(obj as Record<string, unknown>)) {
    if (key === 'year') continue;

    const childPath = `${path}.${key}`;
    const childVal = (obj as Record<string, unknown>)[key];

    if (typeof childVal === 'number' && isFinite(childVal)) {
      figures.push({
        statementType: childPath.includes('.balance_sheet.') ? 'balance' : 'income',
        fieldKey: key,
        value: childVal,
        labelTextAsPrinted: readAnchorLabel(anchors, childPath),
        pageNumber: readAnchorPage(anchors, childPath),
        payloadPath: childPath,
        isModelDerived: childPath.includes('.financial_ratios.'),
      });
    } else if (
      childVal !== null &&
      childVal !== undefined &&
      !Array.isArray(childVal) &&
      typeof childVal === 'object'
    ) {
      walkForFigures(childVal, childPath, figures, anchors);
    }
    // null, array, non-finite number → skip
  }
}

interface YearContainer {
  pathPrefix: string;
  container: Record<string, unknown>;
}

/**
 * #339: locate the object(s) that hold years / period_ends / months_covered.
 * The root years-keyed shape (profit_and_loss / balance_sheet documents) wins
 * outright and preserves pre-#339 behaviour exactly. Otherwise the wrapped
 * company_accounts shape contributes one container per sub-object,
 * balance_sheet first, so its period_end wins the first-non-null merge.
 */
function collectYearContainers(payload: Record<string, unknown>): YearContainer[] {
  const rootYears = payload.years;
  if (
    rootYears !== null &&
    rootYears !== undefined &&
    !Array.isArray(rootYears) &&
    typeof rootYears === 'object'
  ) {
    return [{ pathPrefix: '', container: payload }];
  }
  const containers: YearContainer[] = [];
  for (const key of ['balance_sheet', 'profit_and_loss']) {
    const sub = payload[key];
    if (
      sub !== null &&
      sub !== undefined &&
      !Array.isArray(sub) &&
      typeof sub === 'object'
    ) {
      const subYears = (sub as Record<string, unknown>).years;
      if (
        subYears !== null &&
        subYears !== undefined &&
        !Array.isArray(subYears) &&
        typeof subYears === 'object'
      ) {
        containers.push({ pathPrefix: key, container: sub as Record<string, unknown> });
      }
    }
  }
  return containers;
}

/**
 * #339 follow-on: company_accounts payloads carry no top-level report_date,
 * but their nested balance_sheet and profit_and_loss sub-objects do (51 and 52
 * of 152 on dev). Same precedence order as collectYearContainers: root wins,
 * then balance_sheet, then profit_and_loss.
 */
function resolveReportDate(payload: Record<string, unknown>): string | null {
  if (typeof payload.report_date === 'string') return payload.report_date;
  for (const key of ['balance_sheet', 'profit_and_loss']) {
    const sub = payload[key];
    if (sub !== null && sub !== undefined && !Array.isArray(sub) && typeof sub === 'object') {
      const rd = (sub as Record<string, unknown>).report_date;
      if (typeof rd === 'string') return rd;
    }
  }
  return null;
}

/**
 * Slice 1c.2b: read a figure anchor from the merged anchor map.
 * A missing or malformed anchor resolves to null (spec P5): no coercion,
 * no invention.
 */
function readAnchorLabel(anchors: Record<string, unknown>, path: string): string | null {
  const a = anchors[path];
  if (a === null || a === undefined || Array.isArray(a) || typeof a !== 'object') return null;
  const label = (a as Record<string, unknown>).label;
  return typeof label === 'string' && label.length > 0 ? label : null;
}

function readAnchorPage(anchors: Record<string, unknown>, path: string): number | null {
  const a = anchors[path];
  if (a === null || a === undefined || Array.isArray(a) || typeof a !== 'object') return null;
  const page = (a as Record<string, unknown>).page;
  return typeof page === 'number' && isFinite(page) ? page : null;
}

/**
 * Slice 1c.2b: resolve the identity block (spec 2.1). Field-level first
 * non-null merge in the order root, balance_sheet, profit_and_loss, the same
 * precedence as resolveReportDate. Empty arrays and empty strings carry no
 * information and resolve to null.
 */
interface ResolvedIdentity {
  companyNamesFound: string[] | null;
  registeredNumbersFound: string[] | null;
  yearEndStated: string | null;
  directorsNamed: string[] | null;
  accountantName: string | null;
  isDraft: boolean | null;
  isAbridged: boolean | null;
  isSigned: boolean | null;
}

function readStringArray(v: unknown): string[] | null {
  if (!Array.isArray(v)) return null;
  const out = v.filter((x): x is string => typeof x === 'string' && x.length > 0);
  return out.length > 0 ? out : null;
}

function readString(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null;
}

function readBoolean(v: unknown): boolean | null {
  return typeof v === 'boolean' ? v : null;
}

function resolveIdentity(payload: Record<string, unknown>): ResolvedIdentity {
  const out: ResolvedIdentity = {
    companyNamesFound: null,
    registeredNumbersFound: null,
    yearEndStated: null,
    directorsNamed: null,
    accountantName: null,
    isDraft: null,
    isAbridged: null,
    isSigned: null,
  };
  const sources: unknown[] = [payload.identity];
  for (const key of ['balance_sheet', 'profit_and_loss']) {
    const sub = payload[key];
    if (sub !== null && sub !== undefined && !Array.isArray(sub) && typeof sub === 'object') {
      sources.push((sub as Record<string, unknown>).identity);
    }
  }
  for (const src of sources) {
    if (src === null || src === undefined || Array.isArray(src) || typeof src !== 'object') continue;
    const s = src as Record<string, unknown>;
    if (out.companyNamesFound === null) out.companyNamesFound = readStringArray(s.company_names_found);
    if (out.registeredNumbersFound === null) out.registeredNumbersFound = readStringArray(s.registered_numbers_found);
    if (out.yearEndStated === null) out.yearEndStated = readString(s.year_end_stated);
    if (out.directorsNamed === null) out.directorsNamed = readStringArray(s.directors_named);
    if (out.accountantName === null) out.accountantName = readString(s.accountant_name);
    if (out.isDraft === null) out.isDraft = readBoolean(s.is_draft);
    if (out.isAbridged === null) out.isAbridged = readBoolean(s.is_abridged);
    if (out.isSigned === null) out.isSigned = readBoolean(s.is_signed);
  }
  return out;
}

// --- Slice 2b.2: cast checks (spec 2.3) ------------------------------------
// Calibrated 2/3 August 2026 over 514 deduplicated dev figure sets.
// Severity split is evidence-based, not argued. Full record in
// claude/CALIBRATION-2b.2-cast-checks.md.
//
// This file deliberately contains no absolute-value function calls. #295 and
// #331 are both abs()-on-financial-values defects, and the grep invariant for
// that function name in the evidence layer must keep returning zero, which is
// why the name does not appear even in this comment. Magnitudes below are
// written out longhand instead.

type FigureLookup = {
  get(path: string): number | null;
  sum(prefix: string, exclude: string[]): number | null;
};

/**
 * Relative payload path: everything after the FIRST `years.<n>.` segment.
 *   root    'years.2024.profit_and_loss.revenue'                  -> 'profit_and_loss.revenue'
 *   wrapped 'profit_and_loss.years.2024.profit_and_loss.revenue'  -> 'profit_and_loss.revenue'
 * Taking everything after the first segment is what normalises the two shapes.
 */
function toRelativePath(payloadPath: string): string {
  const m = payloadPath.match(/years\.[0-9]+\./);
  if (!m || m.index === undefined) return payloadPath;
  return payloadPath.slice(m.index + m[0].length);
}

function buildFigureLookup(figures: EvidenceFigure[]): FigureLookup {
  const byPath = new Map<string, number>();
  for (const f of figures) {
    if (f.isModelDerived) continue;
    const rel = toRelativePath(f.payloadPath);
    if (!byPath.has(rel)) byPath.set(rel, f.value);
  }
  return {
    get(path: string): number | null {
      const v = byPath.get(path);
      return v === undefined ? null : v;
    },
    sum(prefix: string, exclude: string[]): number | null {
      let total = 0;
      let found = false;
      byPath.forEach((v, k) => {
        if (k.indexOf(prefix) !== 0) return;
        if (exclude.indexOf(k) !== -1) return;
        total += v;
        found = true;
      });
      return found ? total : null;
    },
  };
}

function sumOfPaths(g: FigureLookup, paths: string[]): number | null {
  let total = 0;
  let found = false;
  for (const p of paths) {
    const v = g.get(p);
    if (v === null) continue;
    total += v;
    found = true;
  }
  return found ? total : null;
}

const nz = (v: number | null): number => (v === null ? 0 : v);

interface CastDefinition {
  check: string;
  type: string;
  severity: AnomalySeverity;
  sides: (g: FigureLookup) => [number | null, number | null];
}

const CA_PREFIX = 'balance_sheet.current_assets.';
const CL_PREFIX = 'balance_sheet.current_liabilities.';
const LTL_PREFIX = 'balance_sheet.long_term_liabilities.';

// tangible_assets is the PARENT of these six, measured 148 testable / 123 equal.
// Summing all fixed-asset components together would double count it.
const TANGIBLE_COMPONENTS = [
  'balance_sheet.fixed_assets.plant_machinery',
  'balance_sheet.fixed_assets.computer_equipment',
  'balance_sheet.fixed_assets.fixtures_fittings',
  'balance_sheet.fixed_assets.motor_vehicles',
  'balance_sheet.fixed_assets.leasehold_property',
  'balance_sheet.fixed_assets.freehold_property',
];

const CAST_CHECKS: CastDefinition[] = [
  {
    check: 'PL1',
    type: 'cast_failure',
    severity: 'trust_blocking',
    sides: g => {
      const rev = g.get('profit_and_loss.revenue');
      const cos = g.get('profit_and_loss.cost_of_sales');
      return [
        g.get('profit_and_loss.gross_profit'),
        rev === null || cos === null ? null : rev - cos,
      ];
    },
  },
  {
    check: 'PL2',
    type: 'cast_failure',
    severity: 'informational',
    sides: g => {
      const gp = g.get('profit_and_loss.gross_profit');
      const admin = g.get('profit_and_loss.administrative_expenses');
      return [
        g.get('profit_and_loss.operating_profit'),
        gp === null || admin === null
          ? null
          : gp - admin + nz(g.get('profit_and_loss.other_operating_income')),
      ];
    },
  },
  {
    check: 'PL3',
    type: 'cast_failure',
    severity: 'informational',
    sides: g => {
      const op = g.get('profit_and_loss.operating_profit');
      const ip = g.get('profit_and_loss.interest_payable');
      return [
        g.get('profit_and_loss.profit_before_tax'),
        op === null || ip === null
          ? null
          : op - ip + nz(g.get('profit_and_loss.interest_receivable')),
      ];
    },
  },
  {
    check: 'PL4',
    type: 'cast_failure',
    severity: 'informational',
    sides: g => {
      const pbt = g.get('profit_and_loss.profit_before_tax');
      const tax = g.get('profit_and_loss.corporation_tax');
      return [
        g.get('profit_and_loss.net_profit'),
        pbt === null || tax === null ? null : pbt - tax,
      ];
    },
  },
  {
    check: 'PL6',
    type: 'cast_failure',
    severity: 'informational',
    sides: g => [
      g.get('profit_and_loss.cost_of_sales'),
      g.sum('cost_of_sales_breakdown.', []),
    ],
  },
  {
    check: 'PL7',
    type: 'cast_failure',
    severity: 'trust_blocking',
    sides: g => [
      g.get('profit_and_loss.revenue'),
      g.sum('revenue_breakdown.by_product.', []),
    ],
  },
  {
    check: 'BS1',
    type: 'cast_failure',
    severity: 'informational',
    sides: g => {
      const sc = g.get('balance_sheet.equity.share_capital');
      const re = g.get('balance_sheet.equity.retained_earnings');
      return [
        g.get('balance_sheet.equity.total'),
        sc === null || re === null ? null : sc + re,
      ];
    },
  },
  {
    check: 'BS2',
    type: 'cast_failure',
    severity: 'informational',
    sides: g => [
      g.get(CA_PREFIX + 'total'),
      g.sum(CA_PREFIX, [CA_PREFIX + 'total', CA_PREFIX + 'directors_current_account']),
    ],
  },
  {
    check: 'BS3',
    type: 'cast_failure',
    severity: 'informational',
    sides: g => [
      g.get(CL_PREFIX + 'total'),
      g.sum(CL_PREFIX, [
        CL_PREFIX + 'total',
        CL_PREFIX + 'other_debt',
        CL_PREFIX + 'other_debtors',
      ]),
    ],
  },
  {
    check: 'BS4',
    type: 'cast_failure',
    severity: 'trust_blocking',
    sides: g => [
      g.get(LTL_PREFIX + 'total'),
      g.sum(LTL_PREFIX, [LTL_PREFIX + 'total']),
    ],
  },
  {
    check: 'BS5',
    type: 'cast_failure',
    severity: 'informational',
    sides: g => {
      const eq = g.get('balance_sheet.equity.total');
      const tang = g.get('balance_sheet.fixed_assets.tangible_assets');
      const ca = g.get(CA_PREFIX + 'total');
      const cl = g.get(CL_PREFIX + 'total');
      const ltl = g.get(LTL_PREFIX + 'total');
      if (tang === null || ca === null || cl === null || ltl === null) return [eq, null];
      const fa =
        tang +
        nz(g.get('balance_sheet.fixed_assets.intangible_assets')) +
        nz(g.get('balance_sheet.fixed_assets.investments'));
      return [eq, fa + ca - cl - ltl];
    },
  },
  {
    check: 'DUP1',
    type: 'duplicate_path_conflict',
    severity: 'trust_blocking',
    sides: g => [
      g.get('profit_and_loss.depreciation_amortisation'),
      g.get('overheads_breakdown.depreciation'),
    ],
  },
  {
    // Renamed from DUP2 and demoted to informational, 3 August 2026.
    // This compares a PARENT to a SUM OF CHILDREN, so it only holds when the
    // children are exhaustive. A document listing only some tangible asset
    // categories fails it legitimately. That makes it a completeness cast like
    // BS2 and BS4, not a contradiction like DUP1, which compares two paths
    // holding the same concept. dar 1151 (Midland) exposed this on the first
    // real fixture: 502,332.22 against 325,584.72. The 83% measured rate
    // (148 testable, 123 equal) already said so.
    check: 'BS6',
    type: 'cast_failure',
    severity: 'informational',
    sides: g => [
      g.get('balance_sheet.fixed_assets.tangible_assets'),
      sumOfPaths(g, TANGIBLE_COMPONENTS),
    ],
  },
];

/**
 * One basis point of the left-hand side, floored at one pound. Derived from the
 * eight inspected clone-cohort failures: it absorbs both observed rounding
 * artefacts (2 on 6,591,524 and 219 on 4,508,976) and keeps every real signal,
 * including a 200 column bleed at a 36 threshold.
 */
function castTolerance(lhs: number): number {
  const scale = lhs < 0 ? -lhs : lhs;
  const bp = scale * 0.0001;
  return bp > 1 ? bp : 1;
}

function runCastChecks(figures: EvidenceFigure[]): EvidenceAnomaly[] {
  if (figures.length === 0) return [];
  const g = buildFigureLookup(figures);
  const out: EvidenceAnomaly[] = [];
  for (const c of CAST_CHECKS) {
    const sides = c.sides(g);
    const lhs = sides[0];
    const rhs = sides[1];
    if (lhs === null || rhs === null) continue;
    const diff = lhs - rhs;
    const gap = diff < 0 ? -diff : diff;
    const tol = castTolerance(lhs);
    if (gap <= tol) continue;
    out.push({
      type: c.type,
      severity: c.severity,
      detail: { check: c.check, lhs, rhs, diff, tolerance: tol },
    });
  }
  return out;
}

/**
 * Build the extractor string: '<model>/<promptVersion>' truncated to 100 chars.
 * If only one component is present, use it alone. Returns null if both are absent.
 */
function buildExtractor(model: string | undefined, promptVersion: string | undefined): string | null {
  const m = model?.trim() || null;
  const p = promptVersion?.trim() || null;
  if (!m && !p) return null;
  const raw = m && p ? `${m}/${p}` : (m ?? p)!;
  return raw.length > 100 ? raw.slice(0, 100) : raw;
}

/**
 * Compute a SHA-256 hex digest of the payload serialised with object keys sorted
 * recursively, so that key ordering never changes the hash.
 * Returns null (never throws) if the payload cannot be serialised.
 */
function sortedStringify(val: unknown): string {
  if (val === null || typeof val !== 'object') return JSON.stringify(val);
  if (Array.isArray(val)) return '[' + val.map(sortedStringify).join(',') + ']';
  const sorted = Object.keys(val as object).sort();
  return '{' + sorted.map((k) => JSON.stringify(k) + ':' + sortedStringify((val as Record<string, unknown>)[k])).join(',') + '}';
}

function computeContentHash(payload: Record<string, unknown>): string | null {
  try {
    const serialised = sortedStringify(payload);
    return createHash('sha256').update(serialised, 'utf8').digest('hex');
  } catch {
    return null;
  }
}

export function mapPayloadToEvidence(input: MapPayloadInput): MapPayloadOutput {
  const {
    targetCompanyId,
    documentId,
    documentAnalysisResultId,
    documentType,
    extractionVersion,
    payload,
    model,
    promptVersion,
  } = input;

  const reportDate = resolveReportDate(payload);
  const identity = resolveIdentity(payload);

  const evidence: EvidenceRow = {
    targetCompanyId,
    documentId,
    documentAnalysisResultId,
    documentType,
    extractionVersion,
    contentHash: computeContentHash(payload),
    extractor: buildExtractor(model, promptVersion),
    companyNamesFound: identity.companyNamesFound,
    registeredNumbersFound: identity.registeredNumbersFound,
    yearEndStated: identity.yearEndStated,
    directorsNamed: identity.directorsNamed,
    accountantName: identity.accountantName,
    isDraft: identity.isDraft,
    isAbridged: identity.isAbridged,
    isSigned: identity.isSigned,
    reportDate,
    identityVerdict: null,
  };

  const containers = collectYearContainers(payload);
  // Slice 1c.2b: merge per-container anchor maps under full payload path keys,
  // so a wrapped sub-object's anchor entries align with the prefixed payload
  // paths its figures are written under. Root shape keys pass through unchanged.
  const anchorMap: Record<string, unknown> = {};
  for (const { pathPrefix, container } of containers) {
    const rawAnchors = container.anchors;
    if (rawAnchors === null || rawAnchors === undefined || Array.isArray(rawAnchors) || typeof rawAnchors !== 'object') continue;
    for (const key of Object.keys(rawAnchors as Record<string, unknown>)) {
      const fullKey = pathPrefix ? `${pathPrefix}.${key}` : key;
      anchorMap[fullKey] = (rawAnchors as Record<string, unknown>)[key];
    }
  }
  const periodMap = new Map<string, EvidencePeriod>();
  const periodOrder: string[] = [];
  const periodEndSource = new Map<string, string>();
  const monthsSource = new Map<string, string>();
  const periodStartSource = new Map<string, string>();

  for (const { pathPrefix, container } of containers) {
    const yearsObj = container.years as Record<string, unknown>;
    const periodEnds = (
      typeof container.period_ends === 'object' && container.period_ends !== null
        ? container.period_ends
        : {}
    ) as Record<string, string | null>;
    const monthsCoveredMap = (
      typeof container.months_covered === 'object' && container.months_covered !== null
        ? container.months_covered
        : {}
    ) as Record<string, number | null>;
    const periodStarts = (
      typeof container.period_starts === 'object' && container.period_starts !== null
        ? container.period_starts
        : {}
    ) as Record<string, string | null>;

    for (const yearKey of Object.keys(yearsObj)) {
      let period = periodMap.get(yearKey);
      if (!period) {
        period = {
          fiscalYearStated: parseInt(yearKey, 10),
          periodStart: null,
          periodEnd: null,
          monthsCoveredStated: null,
          anomalies: [],
          figures: [],
        };
        periodMap.set(yearKey, period);
        periodOrder.push(yearKey);
      }

      // spec 2.7: a disagreement is recorded, never silently resolved.
      // Container order is balance_sheet then profit_and_loss, so the first
      // non-null value wins and the later one is recorded as discarded.
      const sourceLabel = pathPrefix || 'root';
      const rawPeriodEnd = periodEnds[yearKey];
      if (typeof rawPeriodEnd === 'string') {
        if (period.periodEnd === null) {
          period.periodEnd = rawPeriodEnd;
          periodEndSource.set(yearKey, sourceLabel);
        } else if (period.periodEnd !== rawPeriodEnd) {
          period.anomalies.push({
            type: 'period_end_conflict',
            severity: 'trust_blocking',
            detail: {
              fiscalYear: yearKey,
              used: period.periodEnd,
              usedSource: periodEndSource.get(yearKey) ?? null,
              discarded: rawPeriodEnd,
              discardedSource: sourceLabel,
            },
          });
        }
      }
      const rawMonths = monthsCoveredMap[yearKey];
      if (typeof rawMonths === 'number') {
        if (period.monthsCoveredStated === null) {
          period.monthsCoveredStated = rawMonths;
          monthsSource.set(yearKey, sourceLabel);
        } else if (period.monthsCoveredStated !== rawMonths) {
          period.anomalies.push({
            type: 'months_covered_conflict',
            severity: 'trust_blocking',
            detail: {
              fiscalYear: yearKey,
              used: period.monthsCoveredStated,
              usedSource: monthsSource.get(yearKey) ?? null,
              discarded: rawMonths,
              discardedSource: sourceLabel,
            },
          });
        }
      }
      const rawPeriodStart = periodStarts[yearKey];
      if (typeof rawPeriodStart === 'string') {
        if (period.periodStart === null) {
          period.periodStart = rawPeriodStart;
          periodStartSource.set(yearKey, sourceLabel);
        } else if (period.periodStart !== rawPeriodStart) {
          period.anomalies.push({
            type: 'period_start_conflict',
            severity: 'trust_blocking',
            detail: {
              fiscalYear: yearKey,
              used: period.periodStart,
              usedSource: periodStartSource.get(yearKey) ?? null,
              discarded: rawPeriodStart,
              discardedSource: sourceLabel,
            },
          });
        }
      }

      const yearData = yearsObj[yearKey];
      const basePath = pathPrefix ? `${pathPrefix}.years.${yearKey}` : `years.${yearKey}`;
      walkForFigures(yearData, basePath, period.figures, anchorMap);
    }
  }

  const periods: EvidencePeriod[] = periodOrder.map(k => periodMap.get(k)!);

  // Slice 2b.2: casts run AFTER all containers are merged, so a wrapped payload
  // is checked once against the combined figure set rather than once per
  // sub-object. Merge anomalies from spec 2.7 are already on the period.
  for (const period of periods) {
    const castAnomalies = runCastChecks(period.figures);
    if (castAnomalies.length > 0) {
      period.anomalies.push(...castAnomalies);
    }
  }

  return { evidence, periods };
}
