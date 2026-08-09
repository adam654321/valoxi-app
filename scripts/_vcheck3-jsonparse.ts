import { buildProfitAndLossAnalysisPrompt } from '../server/prompts/step2-profit-and-loss-prompt';
import { buildBalanceSheetAnalysisPrompt } from '../server/prompts/step2-balance-sheet-prompt';

function checkJson(prompt: string, label: string) {
  const marker = 'FINAL OUTPUT FORMAT\n';
  const idx = prompt.indexOf(marker);
  if (idx === -1) { console.log(label + ': ABORT — FINAL OUTPUT FORMAT marker not found'); return; }
  const jsonStr = prompt.slice(idx + marker.length).trim();
  try {
    JSON.parse(jsonStr);
    console.log(label + ': JSON.parse PASS');
  } catch (e: unknown) {
    console.log(label + ': JSON.parse FAIL — ' + String(e));
    // Show character at failure point if possible
    const msg = String(e);
    const posMatch = msg.match(/position (\d+)/);
    if (posMatch) {
      const pos = parseInt(posMatch[1], 10);
      console.log('  context around position ' + pos + ': ' + JSON.stringify(jsonStr.slice(Math.max(0, pos - 30), pos + 30)));
    }
  }
}

const pl = buildProfitAndLossAnalysisPrompt();
const bs = buildBalanceSheetAnalysisPrompt();
checkJson(pl, 'P&L');
checkJson(bs, 'BS');
