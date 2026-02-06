import { GoogleGenAI } from "@google/genai";

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

function cleanJsonResponse(text: string): string {
  let cleaned = text.trim();

  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, "");
    cleaned = cleaned.replace(/\n?\s*```\s*$/, "");
  }

  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }

  return cleaned.trim();
}

export class GeminiExpertService {
  private ai: GoogleGenAI;

  constructor() {
    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GOOGLE_GEMINI_API_KEY is not configured");
    }
    this.ai = new GoogleGenAI({ apiKey });
  }

  async generateExpertAnalysis(
    expertType: string,
    prompt: string,
    model: string = "gemini-2.5-flash"
  ): Promise<ExpertAnalysisResult> {
    const startTime = Date.now();
    console.log(`[EXPERT:${expertType}] Starting analysis using model ${model}`);

    try {
      const response = await this.ai.models.generateContent({
        model,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          temperature: 0,
        },
      });

      const processingTime = Date.now() - startTime;
      const rawText = response.text || "";

      const usage: ExpertAnalysisUsage = {
        promptTokenCount: response.usageMetadata?.promptTokenCount ?? undefined,
        candidatesTokenCount: response.usageMetadata?.candidatesTokenCount ?? undefined,
        totalTokenCount: response.usageMetadata?.totalTokenCount ?? undefined,
        thoughtsTokenCount: response.usageMetadata?.thoughtsTokenCount ?? undefined,
      };

      console.log(
        `[EXPERT:${expertType}] Response received in ${processingTime}ms, ` +
        `length: ${rawText.length} chars, ` +
        `tokens: prompt=${usage.promptTokenCount ?? "?"}, candidates=${usage.candidatesTokenCount ?? "?"}, total=${usage.totalTokenCount ?? "?"}`
      );

      let parsedJson: Record<string, unknown>;

      try {
        parsedJson = JSON.parse(rawText);
      } catch {
        console.log(`[EXPERT:${expertType}] Raw JSON parse failed, attempting cleanup`);
        const cleaned = cleanJsonResponse(rawText);
        try {
          parsedJson = JSON.parse(cleaned);
          console.log(`[EXPERT:${expertType}] JSON parsed successfully after cleanup`);
        } catch (cleanError) {
          console.error(
            `[EXPERT:${expertType}] JSON parse failed even after cleanup. ` +
            `First 500 chars: ${cleaned.substring(0, 500)}`
          );
          throw new Error(
            `Failed to parse ${expertType} expert response as JSON: ${cleanError instanceof Error ? cleanError.message : "Unknown parse error"}`
          );
        }
      }

      return { params: parsedJson, usage };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error(`[EXPERT:${expertType}] Analysis failed after ${processingTime}ms:`, error);
      throw error;
    }
  }
}
