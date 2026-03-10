import { GoogleGenAI } from "@google/genai";
import { db } from '../db';
import { tokenUsage } from '@shared/schema';
import { calculateTokenCost } from '../utils/token-cost';
import { config as appConfig } from '../config';

export interface GeminiClientConfig {
  apiKey?: string;
  model?: string;
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  timeoutMs?: number;
  userId?: number;
  userCompanyId?: number;
  dealId?: number;
  documentId?: number;
  service?: string;
}

export interface GeminiResponse {
  text: string;
  json: any | null;
  usage: {
    promptTokens: number;
    candidateTokens: number;
    totalTokens: number;
  } | null;
}

export type ThinkingLevel = "MINIMAL" | "LOW" | "MEDIUM" | "HIGH";

export interface GenerateContentOptions {
  prompt: string;
  model?: string;
  temperature?: number;
  responseMimeType?: string;
  inlineData?: { mimeType: string; data: string };
  thinkingLevel?: ThinkingLevel;
  userId?: number;
  userCompanyId?: number;
  dealId?: number;
  documentId?: number;
  service?: string;
}

const DEFAULT_RETRY: Required<Pick<GeminiClientConfig, "maxRetries" | "baseDelayMs" | "maxDelayMs" | "timeoutMs">> = {
  maxRetries: 2,
  baseDelayMs: 15000,
  maxDelayMs: 45000,
  timeoutMs: 90000,
};

/**
 * Unified Gemini API client that consolidates all Gemini access patterns.
 * Uses the @google/genai SDK with built-in retry logic (exponential backoff
 * on 429/503), 3-stage JSON recovery, and configurable model defaults.
 */
export class GeminiClient {
  private ai: GoogleGenAI;
  private defaultModel: string;
  private maxRetries: number;
  private baseDelayMs: number;
  private maxDelayMs: number;
  private timeoutMs: number;
  private userId?: number;
  private userCompanyId?: number;
  private dealId?: number;
  private documentId?: number;
  private service?: string;

  constructor(config: GeminiClientConfig = {}) {
    const apiKey = config.apiKey || process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GOOGLE_GEMINI_API_KEY is not configured");
    }
    this.ai = new GoogleGenAI({ apiKey, httpOptions: { baseUrl: 'https://generativelanguage.googleapis.com/' } });
    this.defaultModel = config.model || appConfig.gemini.model;
    this.maxRetries = config.maxRetries ?? DEFAULT_RETRY.maxRetries;
    this.baseDelayMs = config.baseDelayMs ?? DEFAULT_RETRY.baseDelayMs;
    this.maxDelayMs = config.maxDelayMs ?? DEFAULT_RETRY.maxDelayMs;
    this.timeoutMs = config.timeoutMs ?? DEFAULT_RETRY.timeoutMs;
    this.userId = config.userId;
    this.userCompanyId = config.userCompanyId;
    this.dealId = config.dealId;
    this.documentId = config.documentId;
    this.service = config.service;
  }

  /**
   * Generate content from the Gemini API with automatic retry and JSON recovery.
   *
   * @param options.prompt - The text prompt to send
   * @param options.model - Override the default model for this call
   * @param options.temperature - Sampling temperature (default 0)
   * @param options.responseMimeType - e.g. 'application/json' for structured output
   * @param options.fileData - Optional file attachment (for document analysis)
   * @returns GeminiResponse with text, parsed JSON (if applicable), and token usage
   */
  async generateContent(options: GenerateContentOptions): Promise<GeminiResponse> {
    const model = options.model || this.defaultModel;
    const temperature = options.temperature ?? 0;

    const parts: any[] = [];
    if (options.inlineData) {
      parts.push({
        inlineData: {
          mimeType: options.inlineData.mimeType,
          data: options.inlineData.data,
        },
      });
    }
    parts.push({ text: options.prompt });

    const generateFn = async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const response = await this.ai.models.generateContent({
          model,
          contents: [{ role: "user", parts }],
          config: {
            temperature,
            ...(options.responseMimeType ? { responseMimeType: options.responseMimeType } : {}),
            ...(options.thinkingLevel ? { thinkingConfig: { thinkingBudget: options.thinkingLevel === "MINIMAL" ? 128 : options.thinkingLevel === "LOW" ? 1024 : options.thinkingLevel === "MEDIUM" ? 4096 : 8192 } } : {}),
            abortSignal: controller.signal,
          },
        });
        return response;
      } finally {
        clearTimeout(timeoutId);
      }
    };

    const response = await this.withRetry(generateFn);

    const text = response.text || "";

    const usage = response.usageMetadata
      ? {
          promptTokens: response.usageMetadata.promptTokenCount ?? 0,
          candidateTokens: response.usageMetadata.candidatesTokenCount ?? 0,
          totalTokens: response.usageMetadata.totalTokenCount ?? 0,
        }
      : null;

    let json: any | null = null;
    if (options.responseMimeType === "application/json" || text.trimStart().startsWith("{")) {
      json = this.parseJsonWithRecovery(text);
    }

    const resolvedUserId = options.userId ?? this.userId;
    if (usage && resolvedUserId) {
      try {
        const resolvedService = options.service ?? this.service ?? 'gemini-unknown';
        const costBreakdown = calculateTokenCost(model, usage.promptTokens, usage.candidateTokens);
        await db.insert(tokenUsage).values({
          userId: resolvedUserId,
          userCompanyId: options.userCompanyId ?? this.userCompanyId ?? null,
          dealId: options.dealId ?? this.dealId ?? null,
          documentId: options.documentId ?? this.documentId ?? null,
          service: resolvedService,
          model,
          promptTokens: usage.promptTokens,
          candidateTokens: usage.candidateTokens,
          totalTokens: usage.totalTokens,
          estimatedCostUsd: costBreakdown.totalCostUsd.toFixed(6),
          inputCostUsd: costBreakdown.inputCostUsd.toFixed(6),
          outputCostUsd: costBreakdown.outputCostUsd.toFixed(6),
        });
      } catch (err) {
        console.warn('[GEMINI_CLIENT] Failed to persist token usage:', err);
      }
    }

    return { text, json, usage };
  }

  private async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (lastError.name === "AbortError" || lastError.message.includes("aborted")) {
          console.log(
            `[GEMINI_CLIENT] Request timed out (attempt ${attempt + 1}/${this.maxRetries + 1}). Retrying...`
          );
          if (attempt < this.maxRetries) continue;
          throw new Error(`Gemini API request timed out after ${this.maxRetries + 1} attempts`);
        }

        const statusCode = this.extractStatusCode(lastError);
        const isRetryable = statusCode === 429 || statusCode === 503;

        if (isRetryable && attempt < this.maxRetries) {
          const suggestedDelay = this.parseRetryDelay(lastError.message);
          const delay = Math.min(
            suggestedDelay || this.baseDelayMs * Math.pow(2, attempt),
            this.maxDelayMs
          );
          const errorType = statusCode === 429 ? "Rate limited" : "Model overloaded (503)";

          console.log(
            `[GEMINI_CLIENT] ${errorType} (attempt ${attempt + 1}/${this.maxRetries + 1}). ` +
              `Waiting ${Math.round(delay / 1000)}s before retry...`
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }

        throw lastError;
      }
    }

    throw lastError || new Error("Gemini API call failed after retries");
  }

  private extractStatusCode(error: Error): number | null {
    const match = error.message.match(/(\d{3})/);
    if (match) {
      const code = parseInt(match[1], 10);
      if (code >= 400 && code <= 599) return code;
    }
    if (error.message.toLowerCase().includes("rate limit")) return 429;
    if (error.message.toLowerCase().includes("overloaded") || error.message.toLowerCase().includes("unavailable")) return 503;
    return null;
  }

  private parseRetryDelay(errorMessage: string): number | null {
    try {
      const jsonMatch = errorMessage.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const retryInfo = parsed?.error?.details?.find(
          (d: any) => d["@type"] === "type.googleapis.com/google.rpc.RetryInfo"
        );
        if (retryInfo?.retryDelay) {
          const delayStr = retryInfo.retryDelay.replace("s", "");
          return Math.ceil(parseFloat(delayStr) * 1000);
        }
      }
    } catch {
      // Ignore parsing errors
    }
    return null;
  }

  private parseJsonWithRecovery(text: string): any | null {
    try {
      return JSON.parse(text);
    } catch {
      // Stage 1 failed
    }

    console.log("[GEMINI_CLIENT] Raw JSON parse failed, attempting cleanup");
    const cleaned = this.cleanJsonResponse(text);
    try {
      const result = JSON.parse(cleaned);
      console.log("[GEMINI_CLIENT] JSON parsed successfully after cleanup");
      return result;
    } catch {
      // Stage 2 failed
    }

    console.log("[GEMINI_CLIENT] Cleanup parse failed, attempting truncation repair");
    const repaired = this.repairTruncatedJson(cleaned);
    try {
      const result = JSON.parse(repaired);
      console.log("[GEMINI_CLIENT] JSON parsed successfully after truncation repair");
      return result;
    } catch (repairError) {
      console.error(
        `[GEMINI_CLIENT] JSON parse failed even after repair. ` +
          `First 500 chars: ${repaired.substring(0, 500)}`
      );
      return null;
    }
  }

  private cleanJsonResponse(text: string): string {
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

    cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, "");

    let sanitized = "";
    let inStr = false;
    let esc = false;
    for (let i = 0; i < cleaned.length; i++) {
      const ch = cleaned[i];
      if (esc) { sanitized += ch; esc = false; continue; }
      if (ch === "\\" && inStr) { sanitized += ch; esc = true; continue; }
      if (ch === '"') { inStr = !inStr; sanitized += ch; continue; }
      if (inStr) {
        if (ch === "\n") { sanitized += "\\n"; continue; }
        if (ch === "\r") { sanitized += "\\r"; continue; }
        if (ch === "\t") { sanitized += "\\t"; continue; }
      }
      sanitized += ch;
    }
    cleaned = sanitized;

    cleaned = cleaned.replace(/,\s*([\]}])/g, "$1");
    cleaned = cleaned.replace(/(["\d\]}\w])\s*\n\s*"/g, '$1,\n"');

    return cleaned.trim();
  }

  private repairTruncatedJson(text: string): string {
    let repaired = text.trim();

    let openBraces = 0;
    let openBrackets = 0;
    let inString = false;
    let escaped = false;

    for (let i = 0; i < repaired.length; i++) {
      const ch = repaired[i];
      if (escaped) { escaped = false; continue; }
      if (ch === "\\") { escaped = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (ch === "{") openBraces++;
      if (ch === "}") openBraces--;
      if (ch === "[") openBrackets++;
      if (ch === "]") openBrackets--;
    }

    if (inString) repaired += '"';

    const lastValid = repaired.search(/[,:\s{[\]}"0-9a-zA-Z]\s*$/);
    if (lastValid !== -1) {
      const trailing = repaired.substring(lastValid + 1).trim();
      if (trailing === "" || trailing === ",") {
        repaired = repaired.substring(0, lastValid + 1);
      }
    }

    repaired = repaired.replace(/,\s*$/, "");

    while (openBrackets > 0) { repaired += "]"; openBrackets--; }
    while (openBraces > 0) { repaired += "}"; openBraces--; }

    return repaired;
  }
}

export const geminiClient = new GeminiClient();

/**
 * Create a new GeminiClient instance with a specific API key.
 * Used by the analysis queue to support per-job key resolution.
 * Falls back to the default singleton behaviour if no key provided.
 */
export function createGeminiClient(apiKey?: string, config?: Partial<GeminiClientConfig>): GeminiClient {
  return new GeminiClient({ ...config, ...(apiKey ? { apiKey } : {}) });
}
