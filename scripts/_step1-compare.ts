/**
 * STEP 1 comparison: VARIANT C (reconstructed) vs current live prompt.
 * Read-only. No DB access. No API calls.
 */
import { execSync } from 'child_process';
import { buildProfitAndLossAnalysisPrompt } from '../server/prompts/step2-profit-and-loss-prompt';

// ── Reconstruct VARIANT C from git at 35f5d38 (pre-revert state) ──────────────
// Extract the return value by calling the function from the git version written
// to a temp file, avoiding template-literal regex fragility.
const gitSrc = execSync(
  'git show 35f5d38:server/prompts/step2-profit-and-loss-prompt.ts',
).toString();

// The file starts with: export function buildProfitAndLossAnalysisPrompt(): string {
//   return `ROLE\n...`;
// }
// We extract the content between the first `return ` + backtick and the last backtick + `;\n}`
// Strategy: split on the known opening sequence, then find the closing sequence.

const OPEN_MARKER = 'return `';
const openIdx = gitSrc.indexOf(OPEN_MARKER);
if (openIdx === -1) {
  console.error('ABORT: opening marker not found in git source');
  process.exit(1);
}

// Content starts right after the backtick
const contentStart = openIdx + OPEN_MARKER.length;

// The file ends with:  \n}`;
// Find the last occurrence of that closing pattern
const CLOSE_MARKER = '`;\n}';
const closeIdx = gitSrc.lastIndexOf(CLOSE_MARKER);
if (closeIdx === -1 || closeIdx <= contentStart) {
  console.error('ABORT: closing marker not found in git source');
  process.exit(1);
}

const variantB_atTestTime = gitSrc.slice(contentStart, closeIdx);

// Verify the extracted content starts with ROLE and ends correctly
if (!variantB_atTestTime.startsWith('ROLE')) {
  console.error('ABORT: extracted content does not start with ROLE — wrong slice');
  console.error('First 80 chars: ' + JSON.stringify(variantB_atTestTime.slice(0, 80)));
  process.exit(1);
}

console.log(`Git (1c) prompt extracted: ${variantB_atTestTime.length} chars`);
if (!variantB_atTestTime.includes('FIGURE ANCHORS')) {
  console.error('ABORT: git prompt does not contain FIGURE ANCHORS — wrong commit or wrong extraction');
  process.exit(1);
}

// Exact FIGURE_ANCHORS_BLOCK as defined in anchor-hypothesis-test.ts (lines 276-284)
const FIGURE_ANCHORS_BLOCK =
  'FIGURE ANCHORS\n' +
  'For every figure you extract in the years object (not calculated ratios), add an entry to a top-level anchors object.\n' +
  'The key is the figure\'s exact path in the output JSON, e.g. years.2024.profit_and_loss.revenue.\n' +
  'The value is: { "page": <1-based page number where the figure is printed>, "label": "<the row label exactly as printed, e.g. Turnover>" }\n' +
  'If the page cannot be determined, set page to null. If the label cannot be determined, set label to null.\n' +
  'Do NOT create anchors for financial_ratios entries or for any value you calculated rather than read.\n' +
  'Never invent a page number or a label.\n' +
  '\n';

const variantC = variantB_atTestTime.replace(FIGURE_ANCHORS_BLOCK, '');
if (variantC.includes('FIGURE ANCHORS')) {
  console.error('ABORT: VARIANT C still contains "FIGURE ANCHORS" — FIGURE_ANCHORS_BLOCK mismatch');
  process.exit(1);
}

console.log(`VARIANT C length after block removal: ${variantC.length}`);
console.log();

// ── Current live prompt ───────────────────────────────────────────────────────
const live = buildProfitAndLossAnalysisPrompt();

// ── Compare ───────────────────────────────────────────────────────────────────
console.log('=== STEP 1 — CHARACTER-LEVEL COMPARISON ===');
console.log(`VARIANT C length : ${variantC.length}`);
console.log(`Live prompt length: ${live.length}`);
console.log(`Identical         : ${variantC === live}`);
console.log();

if (variantC !== live) {
  // Find all contiguous differing regions
  const maxLen = Math.max(variantC.length, live.length);
  const regions: { start: number; end: number }[] = [];
  let inDiff = false;
  let diffStart = -1;

  for (let i = 0; i <= maxLen; i++) {
    const same = i < variantC.length && i < live.length && variantC[i] === live[i];
    if (!same && !inDiff) {
      inDiff = true;
      diffStart = i;
    } else if (same && inDiff) {
      inDiff = false;
      regions.push({ start: diffStart, end: i - 1 });
    }
  }
  if (inDiff) regions.push({ start: diffStart, end: maxLen - 1 });

  console.log(`Number of differing regions: ${regions.length}`);
  console.log();

  for (let r = 0; r < regions.length; r++) {
    const { start, end } = regions[r];
    const ctxStart = Math.max(0, start - 200);
    const ctxEndC  = Math.min(variantC.length, end + 201);
    const ctxEndL  = Math.min(live.length,     end + 201);

    console.log(`--- REGION ${r + 1} ---`);
    console.log(`Character offset: ${start} to ${end}  (span ${end - start + 1})`);
    console.log();
    console.log(`VARIANT C [ctx ${ctxStart}–${ctxEndC}]:`);
    console.log(JSON.stringify(variantC.slice(ctxStart, ctxEndC)));
    console.log();
    console.log(`LIVE      [ctx ${ctxStart}–${ctxEndL}]:`);
    console.log(JSON.stringify(live.slice(ctxStart, ctxEndL)));
    console.log();
  }

  console.log(`The live prompt differs from VARIANT C in ${regions.length} place(s).`);
} else {
  console.log('The live prompt is byte-identical to VARIANT C. No edit needed.');
}
