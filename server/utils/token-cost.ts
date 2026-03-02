import { config } from '../config';

export interface TokenCostBreakdown {
  inputCostUsd: number;
  outputCostUsd: number;
  totalCostUsd: number;
}

export function calculateTokenCost(
  model: string,
  promptTokens: number,
  candidateTokens: number,
): TokenCostBreakdown {
  const pricing = config.geminiPricing[model] ?? config.geminiPricing['default'];
  const inputCostUsd = parseFloat(((promptTokens / 1_000_000) * pricing.inputCostPerMillionTokens).toFixed(6));
  const outputCostUsd = parseFloat(((candidateTokens / 1_000_000) * pricing.outputCostPerMillionTokens).toFixed(6));
  const totalCostUsd = parseFloat((inputCostUsd + outputCostUsd).toFixed(6));
  return { inputCostUsd, outputCostUsd, totalCostUsd };
}
