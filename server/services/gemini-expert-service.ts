import { geminiClient } from "./gemini-client";

export class GeminiParseFailureError extends Error {
  constructor(
    message: string,
    public readonly rawText: string,
    public readonly usage: ExpertAnalysisUsage,
  ) {
    super(message);
    this.name = 'GeminiParseFailureError';
  }
}

const EXPERT_TIMEOUTS: Record<string, number> = {
  qoe: 120000,
};

export interface ExpertAnalysisUsage {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  totalTokenCount?: number;
  thoughtsTokenCount?: number;
}

export interface ExpertAnalysisResult {
  params: Record<string, unknown>;
  usage: ExpertAnalysisUsage;
}

export interface ExpertTrackingContext {
  userId?: number;
  userCompanyId?: number;
  dealId?: number;
}

export class GeminiExpertService {
  async generateExpertAnalysis(
    expertType: string,
    prompt: string,
    model?: string,
    tracking?: ExpertTrackingContext
  ): Promise<ExpertAnalysisResult> {
    const startTime = Date.now();
    console.log(`[GEMINI_EXPERT] Starting ${expertType} analysis`);

    const resolvedThinkingLevel = expertType === 'deal_structure' ? undefined : "LOW" as const;
    const HIGH_OUTPUT_EXPERTS = ['deal_structure', 'synthesis'];
    const resolvedMaxOutputTokens = HIGH_OUTPUT_EXPERTS.includes(expertType) ? 16384 : undefined;

    try {
      const response = await geminiClient.generateContent({
        prompt,
        model,
        temperature: 0,
        responseMimeType: "application/json",
        thinkingLevel: resolvedThinkingLevel,
        maxOutputTokens: resolvedMaxOutputTokens,
        timeoutMs: EXPERT_TIMEOUTS[expertType],
        service: `expert_analysis_${expertType}`,
        userId: tracking?.userId,
        userCompanyId: tracking?.userCompanyId,
        dealId: tracking?.dealId,
      });

      const processingTime = Date.now() - startTime;

      console.log(
        `[GEMINI_EXPERT] ${expertType} response received in ${processingTime}ms, ` +
          `length: ${response.text.length} chars` +
          (response.usage
            ? `, tokens: prompt=${response.usage.promptTokens}, candidates=${response.usage.candidateTokens}, total=${response.usage.totalTokens}`
            : "")
      );

      const usage: ExpertAnalysisUsage = response.usage
        ? {
            promptTokenCount: response.usage.promptTokens,
            candidatesTokenCount: response.usage.candidateTokens,
            totalTokenCount: response.usage.totalTokens,
          }
        : {};

      if (!response.json) {
        throw new GeminiParseFailureError(
          `Failed to parse ${expertType} expert response as JSON`,
          response.text,
          usage,
        );
      }

      return { params: response.json as Record<string, unknown>, usage };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error(`[GEMINI_EXPERT] ${expertType} analysis failed after ${processingTime}ms:`, error);
      throw error;
    }
  }
}
