import { config } from '../config';

export function calculateTokenCost(
  model: string,
  promptTokens: number,
  candidateTokens: number,
): number {
  const pricing = config.geminiPricing[model] ?? config.geminiPricing['default'];
  const cost =
    (promptTokens / 1_000_000) * pricing.inputCostPerMillionTokens +
    (candidateTokens / 1_000_000) * pricing.outputCostPerMillionTokens;
  return parseFloat(cost.toFixed(6));
}
