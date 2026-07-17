/**
 * Deterministic Information Memorandum (IM) detector.
 *
 * A document is an IM / marketing summary if it contains ANY single STRONG
 * signal, or 2+ weak (medium + advisory) signals combined.
 *
 * Returns reasons[] for full auditability — log them alongside every decision.
 *
 * Rules:
 *   - Pure function: no I/O, no Date.now(). Pass currentFiscalYear in.
 *   - The LLM flag is additive / advisory. It can be the tipping weak signal
 *     but is never the sole decider.
 */

export interface IMDetectorInput {
  rawText?: string | null;
  extractedYears?: number[];
  currentFiscalYear: number;
  llmIsIM?: boolean;
  llmReason?: string;
}

export interface IMDetectorResult {
  isIM: boolean;
  reasons: string[];
}

export function detectInformationMemorandum(input: IMDetectorInput): IMDetectorResult {
  const strongReasons: string[] = [];
  const weakReasons: string[] = [];

  const text = (input.rawText ?? '').toLowerCase();

  // ── STRONG signals ─────────────────────────────────────────────────────────

  if (text.includes('information memorandum')) {
    strongReasons.push('STRONG: text contains "information memorandum"');
  }

  if (text.includes('adjusted ebitda')) {
    strongReasons.push('STRONG: text contains "adjusted ebitda" (not a statutory accounts line item)');
  }

  const hasExecSummary = text.includes('executive summary');
  const hasGrowth = text.includes('growth opportunities');
  const hasProducts = text.includes('products and services');
  if (hasExecSummary && (hasGrowth || hasProducts)) {
    strongReasons.push(
      'STRONG: marketing-narrative section headers present together' +
        ' ("executive summary" + "' + (hasGrowth ? 'growth opportunities' : 'products and services') + '")',
    );
  }

  const years = (input.extractedYears ?? []).map(Number).filter(y => !isNaN(y));
  if (years.length >= 5) {
    const maxYear = Math.max(...years);
    if (maxYear > input.currentFiscalYear) {
      strongReasons.push(
        `STRONG: financial footprint spans ${years.length} fiscal years including a forecast year` +
          ` (${maxYear} > current ${input.currentFiscalYear})`,
      );
    }
  }

  // ── MEDIUM signal ──────────────────────────────────────────────────────────

  const rawForLabels = input.rawText ?? '';
  const hasStat = /\bstat\b/i.test(rawForLabels);
  const hasMgt = /\bmgt\b/i.test(rawForLabels);
  if (hasStat && hasMgt) {
    weakReasons.push('MEDIUM: mixed "Stat"/"Mgt" year labelling in a single summary table');
  }

  // ── ADVISORY signal (LLM, additive only) ───────────────────────────────────

  if (input.llmIsIM) {
    weakReasons.push(
      `ADVISORY: LLM classified as information memorandum` +
        (input.llmReason ? ` — ${input.llmReason}` : ''),
    );
  }

  // ── Decision ────────────────────────────────────────────────────────────────
  // Any STRONG signal => IM.
  // 2+ weak signals combined => IM.

  const isIM = strongReasons.length > 0 || weakReasons.length >= 2;

  const reasons = [...strongReasons, ...weakReasons];

  return { isIM, reasons };
}
