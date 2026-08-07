import { buildAssetRegisterAnalysisPrompt } from "../prompts/step2-asset-register-prompt";
import { buildBalanceSheetAnalysisPrompt } from "../prompts/step2-balance-sheet-prompt";
import { buildProfitAndLossAnalysisPrompt } from "../prompts/step2-profit-and-loss-prompt";
import { buildSalesLedgerAnalysisPrompt } from "../prompts/step2-sales-ledger-prompt";
import { buildStaffMatrixAnalysisPrompt } from "../prompts/step2-staff-matrix-prompt";
// Uses the app's geminiClient (GOOGLE_GEMINI_API_KEY) — never swap for replit_integrations/
import { geminiClient } from "./gemini-client";
import type { DocumentTrackingContext } from "./gemini-document-classification-service";
import { fileStorageService } from './file-storage.service';
import { isSpreadsheetMimeType, convertSpreadsheetToText } from '../utils/spreadsheet-to-text';

export type DocumentType = 'asset_register' | 'balance_sheet' | 'profit_and_loss' | 'sales_ledger' | 'staff_matrix';

export interface Step2AnalysisRequest {
  fileUrl?: string;
  filePath: string;
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
  /** Resolved Gemini model string, e.g. 'gemini-2.5-flash'. Present only when an API call was made. */
  model?: string;
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

async function readFileBuffer(filePath: string): Promise<Buffer | null> {
  try {
    if (fileStorageService.isObjectStorageKey(filePath)) {
      return await fileStorageService.download(filePath);
    }
    const fs = await import('fs/promises');
    return await fs.readFile(filePath);
  } catch (error) {
    console.error(`[GEMINI] Failed to read file: ${filePath}`, error);
    return null;
  }
}

async function readFileContent(filePath: string): Promise<string | null> {
  try {
    const buffer = await readFileBuffer(filePath);
    if (!buffer) return null;
    const content = buffer.toString('utf-8');
    const maxChars = 50000;
    return content.length > maxChars ? content.substring(0, maxChars) : content.trim() || null;
  } catch (error) {
    console.error(`[GEMINI] Failed to read file content: ${filePath}`, error);
    return null;
  }
}

async function readFileAsBase64(filePath: string): Promise<string | null> {
  try {
    const buffer = await readFileBuffer(filePath);
    if (!buffer) return null;
    return buffer.toString('base64');
  } catch (error) {
    console.error(`[GEMINI] Failed to read file as base64: ${filePath}`, error);
    return null;
  }
}

const TEXT_MIME_TYPES = ['text/csv', 'text/tab-separated-values', 'text/plain'];

export async function analyzeDocumentWithGemini(
  request: Step2AnalysisRequest,
  tracking?: DocumentTrackingContext
): Promise<Step2AnalysisResult> {
  const startTime = Date.now();

  try {
    console.log(`[GEMINI_STEP2] Starting ${request.documentType} analysis for ${request.fileName}`);
    console.log(`[GEMINI_STEP2] File path: ${request.filePath}`);

    let prompt = getPromptForDocumentType(request.documentType);
    let inlineData: { mimeType: string; data: string } | undefined;

    const isTextFile = TEXT_MIME_TYPES.includes(request.mimeType);
    const isSpreadsheet = isSpreadsheetMimeType(request.mimeType);

    if (isSpreadsheet) {
      const buffer = await readFileBuffer(request.filePath);
      if (buffer) {
        const textContent = convertSpreadsheetToText(buffer, request.fileName);
        prompt = `${prompt}\n\n--- DOCUMENT CONTENT (${request.fileName}) ---\n${textContent}\n--- END OF DOCUMENT ---`;
        console.log(`[GEMINI_STEP2] Converted spreadsheet to ${textContent.length} chars of text inline`);
      } else {
        console.error(`[GEMINI_STEP2] Failed to read spreadsheet buffer for ${request.fileName}`);
      }
    } else if (isTextFile) {
      const textContent = await readFileContent(request.filePath);
      if (textContent) {
        prompt = `${prompt}\n\n--- DOCUMENT CONTENT (${request.fileName}) ---\n${textContent}\n--- END OF DOCUMENT ---`;
        console.log(`[GEMINI_STEP2] Embedded ${textContent.length} chars of text content inline for ${request.fileName} (read from disk)`);
      } else {
        const base64Data = await readFileAsBase64(request.filePath);
        if (base64Data) {
          inlineData = { mimeType: request.mimeType, data: base64Data };
        }
        console.log(`[GEMINI_STEP2] Falling back to base64 inline for ${request.fileName}`);
      }
    } else {
      const base64Data = await readFileAsBase64(request.filePath);
      if (base64Data) {
        inlineData = { mimeType: request.mimeType, data: base64Data };
      }
    }

    console.log(`[GEMINI_STEP2] Sending request to Gemini API for ${request.documentType}${isTextFile && !inlineData ? ' (inline text)' : ' (base64 inline)'}`);

    const response = await geminiClient.generateContent({
      prompt,
      temperature: 0,
      responseMimeType: "application/json",
      thinkingLevel: "MINIMAL",
      ...(inlineData ? { inlineData } : {}),
      service: `document_step2_${request.documentType}`,
      userId: tracking?.userId,
      userCompanyId: tracking?.userCompanyId,
      dealId: tracking?.dealId,
      documentId: tracking?.documentId,
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
      model: response.model,
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
  filePath: string,
  mimeType: string,
  fileName: string,
  documentTypes: string[],
  documentId?: number,
  tracking?: DocumentTrackingContext
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
      filePath,
      mimeType,
      fileName,
      documentType: docType,
    }, tracking ? { ...tracking, documentId } : undefined);
    results.push(result);
  }

  return results;
}
