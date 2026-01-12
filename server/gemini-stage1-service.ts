import { buildStage1Prompt } from "./prompts/stage1-analysis-prompt";

export interface FileInfo {
  fileUrl: string;
  mimeType: string;
  category: string;
}

export interface Stage1AnalysisRequest {
  companyName: string;
  sector: string;
  files: FileInfo[];
}

export interface Stage1AnalysisResult {
  success: boolean;
  markdown?: string;
  error?: string;
  processingTime?: number;
}

export async function runStage1GeminiAnalysis(
  request: Stage1AnalysisRequest
): Promise<Stage1AnalysisResult> {
  const startTime = Date.now();

  try {
    console.log(`[GEMINI_STAGE1] Starting analysis for ${request.companyName}`);
    console.log(`[GEMINI_STAGE1] Processing ${request.files.length} files`);

    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GOOGLE_GEMINI_API_KEY is not configured");
    }

    const prompt = buildStage1Prompt(request.companyName, request.sector);

    // Build file_data parts for each document
    const fileParts = request.files.map((file) => ({
      file_data: {
        mime_type: file.mimeType,
        file_uri: file.fileUrl,
      },
    }));

    // Build the request body matching the exact CURL structure
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

    console.log(`[GEMINI_STAGE1] Sending request to Gemini with ${fileParts.length} files`);
    console.log(`[GEMINI_STAGE1] Request body structure:`, JSON.stringify({
      generationConfig: requestBody.generationConfig,
      contents: [{
        parts: [
          ...fileParts.map(f => ({ file_data: { mime_type: f.file_data.mime_type, file_uri: f.file_data.file_uri.substring(0, 50) + '...' } })),
          { text: `<prompt length: ${prompt.length} chars>` }
        ]
      }]
    }, null, 2));

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent",
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
      console.error(`[GEMINI_STAGE1] API error response:`, errorText);
      throw new Error(`Gemini API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const responseData = await response.json();
    
    // Extract text from the response
    const markdown = responseData?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    console.log(`[GEMINI_STAGE1] Analysis completed in ${processingTime}ms, response length: ${markdown.length} characters`);

    return {
      success: true,
      markdown,
      processingTime,
    };
  } catch (error) {
    const processingTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`[GEMINI_STAGE1] Analysis failed after ${processingTime}ms:`, error);

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
