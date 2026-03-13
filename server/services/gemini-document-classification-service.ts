import { buildDocumentClassificationPrompt } from "../prompts/document-classification-prompt";
// Uses the app's geminiClient (GOOGLE_GEMINI_API_KEY) — never swap for replit_integrations/
import { geminiClient } from "./gemini-client";

const TEXT_MIME_TYPES = ['text/csv', 'text/tab-separated-values', 'text/plain'];

async function readFileContent(filePath: string): Promise<string | null> {
  try {
    const fs = await import('fs/promises');
    const content = await fs.readFile(filePath, 'utf-8');
    const maxChars = 50000;
    if (content.length > maxChars) {
      return content.substring(0, maxChars);
    }
    return content.trim() || null;
  } catch (error) {
    console.error(`[GEMINI_CLASSIFICATION] Failed to read file from disk: ${filePath}`, error);
    return null;
  }
}

async function readFileAsBase64(filePath: string): Promise<string | null> {
  try {
    const fs = await import('fs/promises');
    const buffer = await fs.readFile(filePath);
    return buffer.toString('base64');
  } catch (error) {
    console.error(`[GEMINI_CLASSIFICATION] Failed to read file as base64: ${filePath}`, error);
    return null;
  }
}

export interface DocumentClassificationRequest {
  fileUrl?: string;
  filePath: string;
  mimeType: string;
  fileName: string;
}

export interface DocumentTrackingContext {
  userId?: number;
  userCompanyId?: number;
  dealId?: number;
  documentId?: number;
}

export interface DocumentClassificationResult {
  success: boolean;
  documentTypes: string[];
  confidence?: "high" | "medium" | "low";
  reasoning?: string;
  error?: string;
  processingTime?: number;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
    thoughtsTokenCount?: number;
    promptTokensDetails?: Array<{ modality: string; tokenCount: number }>;
  };
}

export async function classifyDocumentWithGemini(
  request: DocumentClassificationRequest,
  tracking?: DocumentTrackingContext
): Promise<DocumentClassificationResult> {
  const startTime = Date.now();

  try {
    console.log(`[GEMINI_CLASSIFICATION] Starting classification for ${request.fileName}`);
    console.log(`[GEMINI_CLASSIFICATION] File path: ${request.filePath}`);

    let prompt = buildDocumentClassificationPrompt();
    let inlineData: { mimeType: string; data: string } | undefined;
    const isTextFile = TEXT_MIME_TYPES.includes(request.mimeType);

    if (isTextFile) {
      const textContent = await readFileContent(request.filePath);
      if (textContent) {
        prompt = `${prompt}\n\n--- DOCUMENT CONTENT (${request.fileName}) ---\n${textContent}\n--- END OF DOCUMENT ---`;
        console.log(`[GEMINI_CLASSIFICATION] Embedded ${textContent.length} chars inline (read from disk)`);
      } else {
        const base64Data = await readFileAsBase64(request.filePath);
        if (base64Data) {
          inlineData = { mimeType: request.mimeType, data: base64Data };
        }
      }
    } else {
      const base64Data = await readFileAsBase64(request.filePath);
      if (base64Data) {
        inlineData = { mimeType: request.mimeType, data: base64Data };
      }
    }

    console.log(`[GEMINI_CLASSIFICATION] Sending request to Gemini API${isTextFile && !inlineData ? ' (inline text)' : ' (base64 inline)'}`);

    const response = await geminiClient.generateContent({
      prompt,
      temperature: 0,
      responseMimeType: "application/json",
      thinkingLevel: "MINIMAL",
      ...(inlineData ? { inlineData } : {}),
      service: 'document_classification',
      userId: tracking?.userId,
      userCompanyId: tracking?.userCompanyId,
      dealId: tracking?.dealId,
      documentId: tracking?.documentId,
    });

    const processingTime = Date.now() - startTime;

    console.log(`[GEMINI_CLASSIFICATION] Raw response length: ${response.text.length} chars`);

    if (!response.json) {
      throw new Error(`Failed to parse Gemini response as JSON`);
    }

    const parsedResponse = response.json as { document_types: string[]; confidence?: string; reasoning?: string };

    if (!parsedResponse.document_types || !Array.isArray(parsedResponse.document_types)) {
      throw new Error(`Invalid response structure: missing document_types array`);
    }

    const usageMetadata = response.usage ? {
      promptTokenCount: response.usage.promptTokens,
      candidatesTokenCount: response.usage.candidateTokens,
      totalTokenCount: response.usage.totalTokens,
    } : undefined;

    console.log(`[GEMINI_CLASSIFICATION] Classification completed in ${processingTime}ms`);
    console.log(`[GEMINI_CLASSIFICATION] Document types: ${parsedResponse.document_types.join(", ")}`);
    console.log(`[GEMINI_CLASSIFICATION] Confidence: ${parsedResponse.confidence || "unknown"}`);
    if (usageMetadata) {
      console.log(`[GEMINI_CLASSIFICATION] Token usage: prompt=${usageMetadata.promptTokenCount}, candidates=${usageMetadata.candidatesTokenCount}, total=${usageMetadata.totalTokenCount}`);
    }

    return {
      success: true,
      documentTypes: parsedResponse.document_types,
      confidence: parsedResponse.confidence as "high" | "medium" | "low" | undefined,
      reasoning: parsedResponse.reasoning,
      processingTime,
      usageMetadata,
    };

  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error(`[GEMINI_CLASSIFICATION] Classification failed:`, error);
    
    return {
      success: false,
      documentTypes: [],
      error: error instanceof Error ? error.message : "Unknown error",
      processingTime,
    };
  }
}
