import { geminiClient } from "./gemini-client";

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

    try {
      const response = await geminiClient.generateContent({
        prompt,
        model,
        temperature: 0,
        responseMimeType: "application/json",
        thinkingLevel: "LOW",
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

      if (!response.json) {
        throw new Error(`Failed to parse ${expertType} expert response as JSON`);
      }

      const usage: ExpertAnalysisUsage = response.usage
        ? {
            promptTokenCount: response.usage.promptTokens,
            candidatesTokenCount: response.usage.candidateTokens,
            totalTokenCount: response.usage.totalTokens,
          }
        : {};

      return { params: response.json as Record<string, unknown>, usage };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error(`[GEMINI_EXPERT] ${expertType} analysis failed after ${processingTime}ms:`, error);
      throw error;
    }
  }
}
