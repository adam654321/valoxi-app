/**
 * Prompt generation identifier written to document_evidence.extractor alongside
 * the model name. Bump this constant whenever the step-2 prompts change, so
 * evidence rows can be attributed to the prompt generation that produced them.
 *
 * Current value: '1c-noanchor' — slice 1c minus figure anchors, which were
 * proven to perturb extraction (see claude/DECISION-anchors-must-be-a-second-pass.md).
 */
export const PROMPT_VERSION = '1c-noanchor';
