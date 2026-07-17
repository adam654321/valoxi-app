/**
 * Deterministic Information Memorandum (IM) detector.
 *
 * A document is an IM / marketing summary if it contains ANY ONE STRONG signal.
 *
 * Returns reasons[] for full auditability — log them alongside every decision.
 *
 * Strong signals (any one is sufficient):
 *   1. Raw text contains "information memorandum"
 *   2. Raw text contains "adjusted ebitda"
 *   3. Marketing-narrative headers present together (exec summary + growth/products)
 *   4. Document spans >=4 distinct fiscal years AND mixes statutory + management data
 *   5. LLM/classifier explicitly identified the document as an Information Memorandum
 *
 * Weak signals (kept for auditability but do not affect the decision):
 *   - Mixed "Stat"/"Mgt" year labels in raw text (MEDIUM)
 *
 * Rules:
 *   - Pure function: no I/O, no Date.now().
 *   - isIM = strongReasons.length > 0
 */

export interface IMDetectorInput {
  rawText?: string | null;
  extractedYears?: number[];
  documentSource?: string | null;
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

  // ── STRONG: raw-text signals ────────────────────────────────────────────────

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

  // ── STRONG: multi-year span with mixed statutory + management data ──────────
  //
  // A genuine statutory filing covers at most 2 years (current + comparative).
  // A document spanning >=4 fiscal years that also mixes statutory and management
  // figures is structurally an IM / broker summary pack, not a statutory filing.

  const years = (input.extractedYears ?? []).map(Number).filter(y => !isNaN(y));
  const hasMixedSource =
    typeof input.documentSource === 'string' &&
    input.documentSource.toLowerCase().includes('management');

  if (years.length >= 4 && hasMixedSource) {
    strongReasons.push(
      `STRONG: document spans ${years.length} fiscal years with mixed statutory/management data` +
        ` (source: "${input.documentSource}")`,
    );
  }

  // ── STRONG: LLM / classifier identification (promoted from advisory) ────────
  //
  // The classifier reads the full PDF including title, branding, and narrative
  // headers that the deterministic signals cannot see without rawText.
  // A confident "yes" from the LLM is treated as a strong signal on its own.

  if (input.llmIsIM) {
    strongReasons.push(
      `STRONG: classifier identified an Information Memorandum` +
        (input.llmReason ? ` — ${input.llmReason}` : ''),
    );
  }

  // ── MEDIUM signal (auditability only — does not affect decision) ────────────

  const rawForLabels = input.rawText ?? '';
  const hasStat = /\bstat\b/i.test(rawForLabels);
  const hasMgt = /\bmgt\b/i.test(rawForLabels);
  if (hasStat && hasMgt) {
    weakReasons.push('MEDIUM: mixed "Stat"/"Mgt" year labelling in a single summary table');
  }

  // ── Decision: any STRONG signal => IM ───────────────────────────────────────

  const isIM = strongReasons.length > 0;
  const reasons = [...strongReasons, ...weakReasons];

  return { isIM, reasons };
}
