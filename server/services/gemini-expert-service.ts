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

  cleaned = cleaned.replace(/[\x00-\x1F\x7F]/g, (ch) => {
    if (ch === '\n' || ch === '\r' || ch === '\t') return ch;
    return '';
  });

  cleaned = cleaned.replace(/,\s*([\]}])/g, '$1');

  cleaned = cleaned.replace(/(["\d\]}\w])\s*\n\s*"/g, '$1,\n"');

  return cleaned.trim();
}

function repairTruncatedJson(text: string): string {
  let repaired = text.trim();

  let openBraces = 0;
  let openBrackets = 0;
  let inString = false;
  let escaped = false;

  for (let i = 0; i < repaired.length; i++) {
    const ch = repaired[i];
    if (escaped) { escaped = false; continue; }
    if (ch === '\\') { escaped = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') openBraces++;
    if (ch === '}') openBraces--;
    if (ch === '[') openBrackets++;
    if (ch === ']') openBrackets--;
  }

  if (inString) repaired += '"';

  const lastValid = repaired.search(/[,:\s{[\]}"0-9a-zA-Z]\s*$/);
  if (lastValid !== -1) {
    const trailing = repaired.substring(lastValid + 1).trim();
    if (trailing === '' || trailing === ',') {
      repaired = repaired.substring(0, lastValid + 1);
    }
  }

  repaired = repaired.replace(/,\s*$/, '');

  while (openBrackets > 0) { repaired += ']'; openBrackets--; }
  while (openBraces > 0) { repaired += '}'; openBraces--; }

  return repaired;
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
        } catch {
          console.log(`[EXPERT:${expertType}] Cleanup parse failed, attempting truncation repair`);
          const repaired = repairTruncatedJson(cleaned);
          try {
            parsedJson = JSON.parse(repaired);
            console.log(`[EXPERT:${expertType}] JSON parsed successfully after truncation repair`);
          } catch (repairError) {
            console.error(
              `[EXPERT:${expertType}] JSON parse failed even after repair. ` +
              `First 500 chars: ${repaired.substring(0, 500)}`
            );
            throw new Error(
              `Failed to parse ${expertType} expert response as JSON: ${repairError instanceof Error ? repairError.message : "Unknown parse error"}`
            );
          }
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
