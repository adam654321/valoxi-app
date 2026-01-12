import { GoogleGenAI } from "@google/genai";
import { buildStage1Prompt } from "./prompts/stage1-analysis-prompt";

const ai = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
  httpOptions: {
    apiVersion: "",
    baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL,
  },
});

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

    const prompt = buildStage1Prompt(request.companyName, request.sector);

    const fileParts = request.files.map((file) => ({
      file_data: {
        mime_type: file.mimeType,
        file_uri: file.fileUrl,
      },
    }));

    const contentParts = [
      ...fileParts,
      { text: prompt },
    ];

    console.log(`[GEMINI_STAGE1] Sending request to Gemini with ${fileParts.length} files`);

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          role: "user",
          parts: contentParts as any,
        },
      ],
      config: {
        temperature: 0,
      },
    });

    const processingTime = Date.now() - startTime;
    const markdown = response.text || "";

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
