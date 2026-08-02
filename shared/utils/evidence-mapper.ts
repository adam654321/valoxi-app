/**
 * Slice 1b: pure mapper — no DB access, no side effects.
 * Converts a raw Gemini extraction payload into the row shapes
 * for document_evidence, document_evidence_period, and document_evidence_figure.
 *
 * Values are preserved exactly as extracted. No abs(), no rounding,
 * no sign normalisation.
 */

export interface EvidenceFigure {
  statementType: string;
  fieldKey: string;
  value: number;
  labelTextAsPrinted: null;
  pageNumber: null;
  payloadPath: string;
  isModelDerived: boolean;
}

export interface EvidenceAnomaly {
  type: string;
  detail: Record<string, unknown>;
}

export interface EvidencePeriod {
  fiscalYearStated: number;
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
  contentHash: null;
  extractor: null;
  companyNamesFound: null;
  registeredNumbersFound: null;
  yearEndStated: null;
  directorsNamed: null;
  accountantName: null;
  isDraft: null;
  isAbridged: null;
  isSigned: null;
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
        labelTextAsPrinted: null,
        pageNumber: null,
        payloadPath: childPath,
        isModelDerived: childPath.includes('.financial_ratios.'),
      });
    } else if (
      childVal !== null &&
      childVal !== undefined &&
      !Array.isArray(childVal) &&
      typeof childVal === 'object'
    ) {
      walkForFigures(childVal, childPath, figures);
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

export function mapPayloadToEvidence(input: MapPayloadInput): MapPayloadOutput {
  const {
    targetCompanyId,
    documentId,
    documentAnalysisResultId,
    documentType,
    extractionVersion,
    payload,
  } = input;

  const reportDate = resolveReportDate(payload);

  const evidence: EvidenceRow = {
    targetCompanyId,
    documentId,
    documentAnalysisResultId,
    documentType,
    extractionVersion,
    contentHash: null,
    extractor: null,
    companyNamesFound: null,
    registeredNumbersFound: null,
    yearEndStated: null,
    directorsNamed: null,
    accountantName: null,
    isDraft: null,
    isAbridged: null,
    isSigned: null,
    reportDate,
    identityVerdict: null,
  };

  const containers = collectYearContainers(payload);
  const periodMap = new Map<string, EvidencePeriod>();
  const periodOrder: string[] = [];
  const periodEndSource = new Map<string, string>();
  const monthsSource = new Map<string, string>();

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

    for (const yearKey of Object.keys(yearsObj)) {
      let period = periodMap.get(yearKey);
      if (!period) {
        period = {
          fiscalYearStated: parseInt(yearKey, 10),
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

      const yearData = yearsObj[yearKey];
      const basePath = pathPrefix ? `${pathPrefix}.years.${yearKey}` : `years.${yearKey}`;
      walkForFigures(yearData, basePath, period.figures);
    }
  }

  const periods: EvidencePeriod[] = periodOrder.map(k => periodMap.get(k)!);

  return { evidence, periods };
}
