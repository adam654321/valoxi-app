import { buildDocumentClassificationPrompt } from "../prompts/document-classification-prompt";
import { fetchWithRetry } from "./gemini-retry-utils";

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

    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GOOGLE_GEMINI_API_KEY is not configured");
    }

    const prompt = buildDocumentClassificationPrompt();

    const requestBody = {
      generationConfig: {
        temperature: 0,
        responseMimeType: "application/json",
      },
      contents: [
        {
          parts: [
            {
              file_data: {
                mime_type: request.mimeType,
                file_uri: request.fileUrl,
              },
            },
            { text: prompt },
          ],
        },
      ],
    };

    console.log(`[GEMINI_CLASSIFICATION] Sending request to Gemini API`);

    const response = await fetchWithRetry(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify(requestBody),
      }
    );

    const processingTime = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[GEMINI_CLASSIFICATION] API error response:`, errorText);
      throw new Error(`Gemini API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const responseData = await response.json();
    
    const responseText = responseData?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    
    const usageMetadata = responseData?.usageMetadata ? {
      promptTokenCount: responseData.usageMetadata.promptTokenCount,
      candidatesTokenCount: responseData.usageMetadata.candidatesTokenCount,
      totalTokenCount: responseData.usageMetadata.totalTokenCount,
      thoughtsTokenCount: responseData.usageMetadata.thoughtsTokenCount,
      promptTokensDetails: responseData.usageMetadata.promptTokensDetails,
    } : undefined;

    console.log(`[GEMINI_CLASSIFICATION] Raw response: ${responseText}`);

    let parsedResponse: { document_types: string[]; confidence?: string; reasoning?: string };
    try {
      parsedResponse = JSON.parse(responseText);
    } catch (parseError) {
      console.error(`[GEMINI_CLASSIFICATION] Failed to parse JSON response:`, responseText);
      throw new Error(`Failed to parse Gemini response as JSON: ${responseText}`);
    }

    if (!parsedResponse.document_types || !Array.isArray(parsedResponse.document_types)) {
      throw new Error(`Invalid response structure: missing document_types array`);
    }

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
