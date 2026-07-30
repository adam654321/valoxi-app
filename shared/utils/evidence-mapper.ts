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

export interface EvidencePeriod {
  fiscalYearStated: number;
  periodEnd: string | null;
  monthsCoveredStated: number | null;
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

export function mapPayloadToEvidence(input: MapPayloadInput): MapPayloadOutput {
  const {
    targetCompanyId,
    documentId,
    documentAnalysisResultId,
    documentType,
    extractionVersion,
    payload,
  } = input;

  const reportDate =
    typeof payload.report_date === 'string' ? payload.report_date : null;

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

  const yearsObj = payload.years;
  const periodEnds = (
    typeof payload.period_ends === 'object' && payload.period_ends !== null
      ? payload.period_ends
      : {}
  ) as Record<string, string | null>;
  const monthsCoveredMap = (
    typeof payload.months_covered === 'object' && payload.months_covered !== null
      ? payload.months_covered
      : {}
  ) as Record<string, number | null>;

  const periods: EvidencePeriod[] = [];

  if (
    yearsObj !== null &&
    yearsObj !== undefined &&
    !Array.isArray(yearsObj) &&
    typeof yearsObj === 'object'
  ) {
    for (const yearKey of Object.keys(yearsObj as Record<string, unknown>)) {
      const fiscalYearStated = parseInt(yearKey, 10);

      const rawPeriodEnd = periodEnds[yearKey];
      const periodEnd = typeof rawPeriodEnd === 'string' ? rawPeriodEnd : null;

      const rawMonths = monthsCoveredMap[yearKey];
      const monthsCoveredStated = typeof rawMonths === 'number' ? rawMonths : null;

      const figures: EvidenceFigure[] = [];
      const yearData = (yearsObj as Record<string, unknown>)[yearKey];
      walkForFigures(yearData, `years.${yearKey}`, figures);

      periods.push({ fiscalYearStated, periodEnd, monthsCoveredStated, figures });
    }
  }

  return { evidence, periods };
}
