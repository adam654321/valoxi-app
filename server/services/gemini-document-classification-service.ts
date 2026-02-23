import { buildDocumentClassificationPrompt } from "../prompts/document-classification-prompt";
import { geminiClient } from "./gemini-client";

const TEXT_MIME_TYPES = ['text/csv', 'text/tab-separated-values', 'text/plain'];

async function fetchTextContent(fileUrl: string): Promise<string | null> {
  try {
    const response = await fetch(fileUrl);
    if (!response.ok) return null;
    const text = await response.text();
    const maxChars = 50000;
    if (text.length > maxChars) {
      return text.substring(0, maxChars);
    }
    return text;
  } catch {
    return null;
  }
}

export interface DocumentClassificationRequest {
  fileUrl: string;
  mimeType: string;
  fileName: string;
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
  request: DocumentClassificationRequest
): Promise<DocumentClassificationResult> {
  const startTime = Date.now();

  try {
    console.log(`[GEMINI_CLASSIFICATION] Starting classification for ${request.fileName}`);
    console.log(`[GEMINI_CLASSIFICATION] File URL: ${request.fileUrl.substring(0, 80)}...`);

    let prompt = buildDocumentClassificationPrompt();
    let fileData: { fileUri: string; mimeType: string } | undefined;
    const isTextFile = TEXT_MIME_TYPES.includes(request.mimeType);

    if (isTextFile) {
      const textContent = await fetchTextContent(request.fileUrl);
      if (textContent) {
        prompt = `${prompt}\n\n--- DOCUMENT CONTENT (${request.fileName}) ---\n${textContent}\n--- END OF DOCUMENT ---`;
        console.log(`[GEMINI_CLASSIFICATION] Embedded ${textContent.length} chars inline`);
      } else {
        fileData = { fileUri: request.fileUrl, mimeType: request.mimeType };
      }
    } else {
      fileData = { fileUri: request.fileUrl, mimeType: request.mimeType };
    }

    console.log(`[GEMINI_CLASSIFICATION] Sending request to Gemini API${isTextFile && !fileData ? ' (inline text)' : ' (file attachment)'}`);

    const response = await geminiClient.generateContent({
      prompt,
      temperature: 0,
      responseMimeType: "application/json",
      thinkingLevel: "MINIMAL",
      ...(fileData ? { fileData } : {}),
    });

    const processingTime = Date.now() - startTime;

    console.log(`[GEMINI_CLASSIFICATION] Raw response: ${response.text}`);

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
