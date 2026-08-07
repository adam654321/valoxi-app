/**
 * Prompt generation identifier written to document_evidence.extractor alongside
 * the model name. Bump this constant whenever the step-2 prompts change, so
 * evidence rows can be attributed to the prompt generation that produced them.
 *
 * Current value: 'pre-1c' — the prompt generation before slice 1c changes.
 */
export const PROMPT_VERSION = 'pre-1c';
