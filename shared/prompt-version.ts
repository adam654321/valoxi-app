/**
 * Prompt generation identifier written to document_evidence.extractor alongside
 * the model name. Bump this constant whenever the step-2 prompts change, so
 * evidence rows can be attributed to the prompt generation that produced them.
 *
 * Current value: '1c' — the slice 1c generation: anchors, period_start, identity, report_date_basis.
 */
export const PROMPT_VERSION = '1c';
