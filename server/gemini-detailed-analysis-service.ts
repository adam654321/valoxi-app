import { buildDetailedAnalysisPrompt } from "./prompts/detailed-analysis-prompt";

export interface FileInfo {
  fileUrl: string;
  mimeType: string;
  category: string;
}

export interface DetailedAnalysisRequest {
  files: FileInfo[];
}

export interface UsageMetadata {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  totalTokenCount?: number;
  promptTokensDetails?: Array<{
    modality: string;
    tokenCount: number;
  }>;
  thoughtsTokenCount?: number;
}

export interface DetailedAnalysisResult {
  success: boolean;
  markdown?: string;
  error?: string;
  processingTime?: number;
  usageMetadata?: UsageMetadata;
}

export async function runDetailedGeminiAnalysis(
  request: DetailedAnalysisRequest
): Promise<DetailedAnalysisResult> {
  const startTime = Date.now();

  try {
    console.log(`[GEMINI_DETAILED] Starting detailed analysis`);
    console.log(`[GEMINI_DETAILED] Processing ${request.files.length} files`);

    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GOOGLE_GEMINI_API_KEY is not configured");
    }

    const prompt = buildDetailedAnalysisPrompt();

    const fileParts = request.files.map((file) => ({
      file_data: {
        mime_type: file.mimeType,
        file_uri: file.fileUrl,
      },
    }));

    const requestBody = {
      generationConfig: {
        temperature: 0,
      },
      contents: [
        {
          parts: [
            ...fileParts,
            { text: prompt },
          ],
        },
      ],
    };

    console.log(`[GEMINI_DETAILED] Sending request to Gemini with ${fileParts.length} files`);

    const response = await fetch(
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
      console.error(`[GEMINI_DETAILED] API error response:`, errorText);
      throw new Error(`Gemini API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const responseData = await response.json();
    
    const markdown = responseData?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    
    const usageMetadata: UsageMetadata | undefined = responseData?.usageMetadata ? {
      promptTokenCount: responseData.usageMetadata.promptTokenCount,
      candidatesTokenCount: responseData.usageMetadata.candidatesTokenCount,
      totalTokenCount: responseData.usageMetadata.totalTokenCount,
      promptTokensDetails: responseData.usageMetadata.promptTokensDetails,
      thoughtsTokenCount: responseData.usageMetadata.thoughtsTokenCount,
    } : undefined;

    console.log(`[GEMINI_DETAILED] Analysis completed in ${processingTime}ms, response length: ${markdown.length} characters`);
    if (usageMetadata) {
      console.log(`[GEMINI_DETAILED] Token usage: prompt=${usageMetadata.promptTokenCount}, candidates=${usageMetadata.candidatesTokenCount}, total=${usageMetadata.totalTokenCount}`);
    }

    return {
      success: true,
      markdown,
      processingTime,
      usageMetadata,
    };
  } catch (error) {
    const processingTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`[GEMINI_DETAILED] Analysis failed after ${processingTime}ms:`, error);

    return {
      success: false,
      error: errorMessage,
      processingTime,
    };
  }
}

export function getMimeTypeForFile(fileType: string): string {
  const mimeMap: Record<string, string> = {
    "application/pdf": "application/pdf",
    "pdf": "application/pdf",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel": "application/vnd.ms-excel",
    "xls": "application/vnd.ms-excel",
    "text/csv": "text/csv",
    "csv": "text/csv",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "image/png": "image/png",
    "png": "image/png",
    "image/jpeg": "image/jpeg",
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
  };

  const normalized = fileType.toLowerCase();
  return mimeMap[normalized] || fileType;
}
