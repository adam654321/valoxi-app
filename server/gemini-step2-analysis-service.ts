import { buildAssetRegisterAnalysisPrompt } from "./prompts/step2-asset-register-prompt";
import { buildBalanceSheetAnalysisPrompt } from "./prompts/step2-balance-sheet-prompt";
import { buildProfitAndLossAnalysisPrompt } from "./prompts/step2-profit-and-loss-prompt";
import { buildSalesLedgerAnalysisPrompt } from "./prompts/step2-sales-ledger-prompt";
import { buildStaffMatrixAnalysisPrompt } from "./prompts/step2-staff-matrix-prompt";
import { fetchWithRetry } from "./gemini-retry-utils";

export type DocumentType = 'asset_register' | 'balance_sheet' | 'profit_and_loss' | 'sales_ledger' | 'staff_matrix';

export interface Step2AnalysisRequest {
  fileUrl: string;
  mimeType: string;
  fileName: string;
  documentType: DocumentType;
}

export interface Step2AnalysisResult {
  success: boolean;
  documentType: DocumentType;
  analysisData?: any;
  error?: string;
  processingTime?: number;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
}

function getPromptForDocumentType(documentType: DocumentType): string {
  switch (documentType) {
    case 'asset_register':
      return buildAssetRegisterAnalysisPrompt();
    case 'balance_sheet':
      return buildBalanceSheetAnalysisPrompt();
    case 'profit_and_loss':
      return buildProfitAndLossAnalysisPrompt();
    case 'sales_ledger':
      return buildSalesLedgerAnalysisPrompt();
    case 'staff_matrix':
      const dateToday = new Date().toISOString().split('T')[0];
      return buildStaffMatrixAnalysisPrompt(dateToday);
    default:
      throw new Error(`Unknown document type: ${documentType}`);
  }
}

export async function analyzeDocumentWithGemini(
  request: Step2AnalysisRequest
): Promise<Step2AnalysisResult> {
  const startTime = Date.now();

  try {
    console.log(`[GEMINI_STEP2] Starting ${request.documentType} analysis for ${request.fileName}`);
    console.log(`[GEMINI_STEP2] File URL: ${request.fileUrl.substring(0, 80)}...`);

    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GOOGLE_GEMINI_API_KEY is not configured");
    }

    const prompt = getPromptForDocumentType(request.documentType);

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

    console.log(`[GEMINI_STEP2] Sending request to Gemini API for ${request.documentType}`);

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
      console.error(`[GEMINI_STEP2] API error response:`, errorText);
      throw new Error(`Gemini API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const responseData = await response.json();
    
    const responseText = responseData?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    
    const usageMetadata = responseData?.usageMetadata ? {
      promptTokenCount: responseData.usageMetadata.promptTokenCount,
      candidatesTokenCount: responseData.usageMetadata.candidatesTokenCount,
      totalTokenCount: responseData.usageMetadata.totalTokenCount,
    } : undefined;

    console.log(`[GEMINI_STEP2] Raw response length: ${responseText.length} chars`);

    let parsedResponse: any;
    try {
      parsedResponse = JSON.parse(responseText);
    } catch (parseError) {
      console.error(`[GEMINI_STEP2] Failed to parse JSON response:`, responseText.substring(0, 500));
      throw new Error(`Failed to parse Gemini response as JSON`);
    }

    console.log(`[GEMINI_STEP2] ${request.documentType} analysis completed in ${processingTime}ms`);
    if (usageMetadata) {
      console.log(`[GEMINI_STEP2] Token usage: prompt=${usageMetadata.promptTokenCount}, candidates=${usageMetadata.candidatesTokenCount}, total=${usageMetadata.totalTokenCount}`);
    }

    return {
      success: true,
      documentType: request.documentType,
      analysisData: parsedResponse,
      processingTime,
      usageMetadata,
    };

  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error(`[GEMINI_STEP2] ${request.documentType} analysis failed:`, error);
    
    return {
      success: false,
      documentType: request.documentType,
      error: error instanceof Error ? error.message : "Unknown error",
      processingTime,
    };
  }
}

export async function runStep2AnalysisForTypes(
  fileUrl: string,
  mimeType: string,
  fileName: string,
  documentTypes: string[]
): Promise<Step2AnalysisResult[]> {
  const validTypes: DocumentType[] = ['asset_register', 'balance_sheet', 'profit_and_loss', 'sales_ledger', 'staff_matrix'];
  
  const typesToAnalyze = documentTypes.filter(t => validTypes.includes(t as DocumentType)) as DocumentType[];
  
  if (typesToAnalyze.length === 0) {
    console.log(`[GEMINI_STEP2] No valid document types to analyze`);
    return [];
  }

  console.log(`[GEMINI_STEP2] Running Step 2 analysis for types: ${typesToAnalyze.join(', ')}`);

  const results: Step2AnalysisResult[] = [];
  
  for (const docType of typesToAnalyze) {
    const result = await analyzeDocumentWithGemini({
      fileUrl,
      mimeType,
      fileName,
      documentType: docType,
    });
    results.push(result);
  }

  return results;
}
