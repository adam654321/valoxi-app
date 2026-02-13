import { documentAnalysisRepository } from "../repositories/document-analysis.repository";
import { documentsRepository } from "../repositories/documents.repository";
import { targetCompaniesRepository } from "../repositories/target-companies.repository";
function getMimeTypeForFile(fileType: string): string {
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
import { classifyDocumentWithGemini } from "./gemini-document-classification-service";
import { runStep2AnalysisForTypes } from "./gemini-step2-analysis-service";
import { eventBus, type DocumentUpdateEvent } from "./event-bus.service";
import { financialDataService } from "./financial-data.service";

import { config } from "../config";

function emitDocumentUpdate(event: DocumentUpdateEvent): void {
  eventBus.emit('document:update', event);
}

function enhanceProfitLossWithCalculations(analysisData: any): any {
  try {
    const enhanced = JSON.parse(JSON.stringify(analysisData));
    
    if (enhanced.years && typeof enhanced.years === 'object') {
      Object.keys(enhanced.years).forEach(year => {
        const yearData = enhanced.years[year];
        
        if (!yearData.profit_and_loss) {
          yearData.profit_and_loss = {};
        }
        
        const pl = yearData.profit_and_loss;
        
        if (pl.revenue && pl.gross_profit && pl.revenue > 0) {
          pl.gross_margin_percentage = Number(((pl.gross_profit / pl.revenue) * 100).toFixed(2));
        }
        
        if (pl.revenue && pl.net_profit && pl.revenue > 0) {
          pl.net_margin_percentage = Number(((pl.net_profit / pl.revenue) * 100).toFixed(2));
        }
        
        if (pl.operating_profit && pl.interest_payable && pl.interest_payable > 0) {
          pl.interest_coverage_ratio = Number((pl.operating_profit / pl.interest_payable).toFixed(2));
        }
      });
    }
    
    if (enhanced.profit_and_loss && typeof enhanced.profit_and_loss === 'object') {
      const pl = enhanced.profit_and_loss;
      
      if (pl.revenue && pl.gross_profit && pl.revenue > 0) {
        pl.gross_margin_percentage = Number(((pl.gross_profit / pl.revenue) * 100).toFixed(2));
      }
      
      if (pl.revenue && pl.net_profit && pl.revenue > 0) {
        pl.net_margin_percentage = Number(((pl.net_profit / pl.revenue) * 100).toFixed(2));
      }
      
      if (pl.operating_profit && pl.interest_payable && pl.interest_payable > 0) {
        pl.interest_coverage_ratio = Number((pl.operating_profit / pl.interest_payable).toFixed(2));
      }
    }
    
    console.log(`[PROFIT_LOSS_ENHANCEMENT] Added calculated ratios to profit & loss data`);
    return enhanced;
    
  } catch (error) {
    console.error(`[PROFIT_LOSS_ENHANCEMENT] Error enhancing profit & loss data:`, error);
    return analysisData;
  }
}

const ANALYSIS_LOCK_TIMEOUT_MS = 10 * 60 * 1000;

export async function analyzeUploadedFileWithGemini(eventId: number) {
  try {
    const event = await documentsRepository.getFileUploadEvent(eventId);
    if (!event) {
      console.error(`[FILE_ANALYSIS] Event ${eventId} not found`);
      return;
    }

    if (event.webhookStatus === 'analysis_complete') {
      console.log(`[FILE_ANALYSIS] Skipping event ${eventId} - analysis already complete`);
      return;
    }

    if (event.webhookStatus === 'processing') {
      const processingStartTime = event.webhookSentAt ? new Date(event.webhookSentAt).getTime() : 0;
      const now = Date.now();
      const elapsed = now - processingStartTime;
      
      if (elapsed < ANALYSIS_LOCK_TIMEOUT_MS) {
        console.log(`[FILE_ANALYSIS] Skipping event ${eventId} - already processing (started ${Math.round(elapsed / 1000)}s ago)`);
        return;
      }
      console.log(`[FILE_ANALYSIS] Processing lock expired for event ${eventId} (${Math.round(elapsed / 1000)}s old) - retrying`);
    }

    const existingResults = await documentAnalysisRepository.getAnalysisResultsByDocumentId(event.documentId);
    if (existingResults && existingResults.length > 0) {
      console.log(`[FILE_ANALYSIS] Skipping event ${eventId} - ${existingResults.length} analysis result(s) already exist for document ${event.documentId}`);
      await documentsRepository.updateFileUploadEventWebhookStatus(eventId, 'analysis_complete', undefined, new Date());
      return;
    }

    await documentsRepository.updateFileUploadEventWebhookStatus(eventId, 'processing', undefined, new Date());

    console.log(`[FILE_ANALYSIS] Starting Gemini analysis for event ${eventId}, file: ${event.fileName}`);

    const baseUrl = config.baseUrl;
    const fileUrl = `${baseUrl}/api/v2/public/documents/${event.documentId}/download`;
    console.log(`[FILE_ANALYSIS] Using HTTPS URL: ${fileUrl}`);

    const fileExtension = event.fileName.split('.').pop()?.toLowerCase() || 'pdf';
    const mimeType = getMimeTypeForFile(fileExtension);
    console.log(`[FILE_ANALYSIS] File extension: ${fileExtension}, MIME type: ${mimeType}`);
    
    const classificationResult = await classifyDocumentWithGemini({
      fileUrl: fileUrl,
      mimeType: mimeType,
      fileName: event.fileName,
    });

    if (!classificationResult.success) {
      console.error(`[FILE_ANALYSIS] Classification failed for event ${eventId}:`, classificationResult.error);
      
      await documentsRepository.updateFileUploadEventWebhookStatus(
        eventId, 
        'classification_failed', 
        JSON.stringify({ 
          error: classificationResult.error,
          processingTime: classificationResult.processingTime 
        }), 
        new Date()
      );
      return;
    }

    console.log(`[FILE_ANALYSIS] Classification successful for event ${eventId}`);
    console.log(`[FILE_ANALYSIS] Document types: ${classificationResult.documentTypes.join(', ')}`);
    console.log(`[FILE_ANALYSIS] Confidence: ${classificationResult.confidence}`);
    console.log(`[FILE_ANALYSIS] Reasoning: ${classificationResult.reasoning}`);

    const classificationData = {
      step: 'classification',
      documentTypes: classificationResult.documentTypes,
      confidence: classificationResult.confidence,
      reasoning: classificationResult.reasoning,
      processingTime: classificationResult.processingTime,
      usageMetadata: classificationResult.usageMetadata,
    };

    await documentsRepository.updateFileUploadEventWebhookStatus(
      eventId, 
      'classification_complete', 
      JSON.stringify(classificationData, null, 2), 
      new Date()
    );

    if (classificationResult.documentTypes.length === 0 || 
        (classificationResult.documentTypes.length === 1 && classificationResult.documentTypes[0] === 'none')) {
      console.log(`[FILE_ANALYSIS] No matching document type for event ${eventId}, skipping Step 2 analysis`);
      return;
    }

    console.log(`[FILE_ANALYSIS] Starting Step 2 analysis for types: ${classificationResult.documentTypes.join(', ')}`);
    
    const step2Results = await runStep2AnalysisForTypes(
      fileUrl,
      mimeType,
      event.fileName,
      classificationResult.documentTypes
    );

    for (const result of step2Results) {
      if (result.success && result.analysisData) {
        console.log(`[FILE_ANALYSIS] Storing ${result.documentType} analysis result for document ${event.documentId}`);
        
        try {
          await documentAnalysisRepository.createAnalysisResult({
            documentId: event.documentId,
            fileUploadEventId: eventId,
            documentType: result.documentType,
            analysisData: result.analysisData,
            processingTime: result.processingTime || 0,
            usageMetadata: result.usageMetadata || null,
          });
          console.log(`[FILE_ANALYSIS] Successfully stored ${result.documentType} analysis for document ${event.documentId}`);
          
          try {
            const normalizationResult = await financialDataService.processExtractedData(
              result.documentType,
              result.analysisData,
              event.targetCompanyId,
              event.documentId
            );
            console.log(`[FILE_ANALYSIS] Financial data normalization for ${result.documentType}: ${normalizationResult.message}`);
            if (normalizationResult.errors && normalizationResult.errors.length > 0) {
              console.warn(`[FILE_ANALYSIS] Normalization warnings:`, normalizationResult.errors);
            }
          } catch (normalizationError) {
            console.error(`[FILE_ANALYSIS] Financial data normalization failed for ${result.documentType}:`, normalizationError);
          }
        } catch (storeError) {
          console.error(`[FILE_ANALYSIS] Failed to store ${result.documentType} analysis:`, storeError);
        }
      } else {
        console.error(`[FILE_ANALYSIS] Step 2 analysis failed for ${result.documentType}:`, result.error);
      }
    }

    const completeData = {
      step: 'complete',
      classification: {
        documentTypes: classificationResult.documentTypes,
        confidence: classificationResult.confidence,
        reasoning: classificationResult.reasoning,
      },
      step2Results: step2Results.map(r => ({
        documentType: r.documentType,
        success: r.success,
        processingTime: r.processingTime,
        error: r.error,
      })),
    };

    await documentsRepository.updateFileUploadEventWebhookStatus(
      eventId, 
      'analysis_complete', 
      JSON.stringify(completeData, null, 2), 
      new Date()
    );
    
    emitDocumentUpdate({
      type: 'analysis_completed',
      targetCompanyId: event.targetCompanyId,
      documentId: event.documentId,
      data: {
        documentTypes: classificationResult.documentTypes,
        confidence: classificationResult.confidence,
        step2Results: step2Results.map(r => ({ type: r.documentType, success: r.success })),
      },
      timestamp: new Date(),
    });

    // Expert pipeline auto-trigger has been moved to analysis-queue.service.ts
    // It now only fires when all 10 documents are analysed (queue empty + completion check)
    console.log(`[FILE_ANALYSIS] Analysis complete for event ${eventId}. Expert trigger deferred to queue completion check.`);

  } catch (error) {
    console.error(`[FILE_ANALYSIS] Failed to analyze file for event ${eventId}:`, error);
    
    await documentsRepository.updateFileUploadEventWebhookStatus(
      eventId, 
      'failed', 
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), 
      new Date()
    );
  }
}

export async function sendFileUploadWebhook(eventId: number) {
  return analyzeUploadedFileWithGemini(eventId);
}

export async function retriggerAnalysisForDocument(documentId: number): Promise<void> {
  const events = await documentsRepository.getFileUploadEventsByDocumentId(documentId);
  if (!events || events.length === 0) {
    throw new Error(`No upload events found for document ${documentId}`);
  }

  const latestEvent = events[0];
  console.log(`[FILE_ANALYSIS] Retriggering analysis for document ${documentId}, event ${latestEvent.id}`);

  await documentAnalysisRepository.deleteByDocumentId(documentId);
  try {
    const { financialDataRepository } = await import('../repositories/financial-data.repository');
    await financialDataRepository.deleteByDocumentId(documentId);
  } catch (err) {
    console.error(`[FILE_ANALYSIS] Error clearing financial data for document ${documentId}:`, err);
  }

  await documentsRepository.updateFileUploadEventWebhookStatus(latestEvent.id, 'pending', undefined, undefined);

  const { analysisQueue } = await import('./analysis-queue.service');
  analysisQueue.enqueue({
    eventId: latestEvent.id,
    targetCompanyId: latestEvent.targetCompanyId,
  });
}

export const fileAnalysisService = {
  analyzeUploadedFileWithGemini,
  sendFileUploadWebhook,
  retriggerAnalysisForDocument,
};
