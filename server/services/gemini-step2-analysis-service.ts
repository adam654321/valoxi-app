import { buildAssetRegisterAnalysisPrompt } from "../prompts/step2-asset-register-prompt";
import { buildBalanceSheetAnalysisPrompt } from "../prompts/step2-balance-sheet-prompt";
import { buildProfitAndLossAnalysisPrompt } from "../prompts/step2-profit-and-loss-prompt";
import { buildSalesLedgerAnalysisPrompt } from "../prompts/step2-sales-ledger-prompt";
import { buildStaffMatrixAnalysisPrompt } from "../prompts/step2-staff-matrix-prompt";
import { geminiClient } from "./gemini-client";

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
    thoughtsTokenCount?: number;
    promptTokensDetails?: Array<{ modality: string; tokenCount: number }>;
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

    const prompt = getPromptForDocumentType(request.documentType);

    console.log(`[GEMINI_STEP2] Sending request to Gemini API for ${request.documentType}`);

    const response = await geminiClient.generateContent({
      prompt,
      temperature: 0,
      responseMimeType: "application/json",
      fileData: {
        fileUri: request.fileUrl,
        mimeType: request.mimeType,
      },
    });

    const processingTime = Date.now() - startTime;

    console.log(`[GEMINI_STEP2] Raw response length: ${response.text.length} chars`);

    if (!response.json) {
      throw new Error(`Failed to parse Gemini response as JSON`);
    }

    const usageMetadata = response.usage ? {
      promptTokenCount: response.usage.promptTokens,
      candidatesTokenCount: response.usage.candidateTokens,
      totalTokenCount: response.usage.totalTokens,
    } : undefined;

    console.log(`[GEMINI_STEP2] ${request.documentType} analysis completed in ${processingTime}ms`);
    if (usageMetadata) {
      console.log(`[GEMINI_STEP2] Token usage: prompt=${usageMetadata.promptTokenCount}, candidates=${usageMetadata.candidatesTokenCount}, total=${usageMetadata.totalTokenCount}`);
    }

    return {
      success: true,
      documentType: request.documentType,
      analysisData: response.json,
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
  documentTypes: string[],
  documentId?: number
): Promise<Step2AnalysisResult[]> {
  const validTypes: DocumentType[] = ['asset_register', 'balance_sheet', 'profit_and_loss', 'sales_ledger', 'staff_matrix'];
  
  const typesToAnalyze = documentTypes.filter(t => validTypes.includes(t as DocumentType)) as DocumentType[];
  
  if (typesToAnalyze.length === 0) {
    console.log(`[GEMINI_STEP2] No valid document types to analyze`);
    return [];
  }

  console.log(`[GEMINI_STEP2] Running Step 2 analysis for types: ${typesToAnalyze.join(', ')}`);

  const results: Step2AnalysisResult[] = [];
  
  for (let i = 0; i < typesToAnalyze.length; i++) {
    const docType = typesToAnalyze[i];

    if (documentId) {
      try {
        const { documentAnalysisRepository } = await import('../repositories/document-analysis.repository');
        const existing = await documentAnalysisRepository.getAnalysisResultByDocumentIdAndType(documentId, docType);
        if (existing) {
          console.log(`[GEMINI_STEP2] Skipping ${docType} for document ${documentId} — result already exists (id: ${existing.id})`);
          results.push({
            success: true,
            documentType: docType,
            analysisData: existing.analysisData,
            processingTime: 0,
          });
          continue;
        }
      } catch (checkError) {
        console.warn(`[GEMINI_STEP2] Could not check existing results for ${docType}, proceeding with API call`);
      }
    }
    
    if (i > 0) {
      console.log(`[GEMINI_STEP2] Waiting 300ms before next analysis...`);
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    
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
