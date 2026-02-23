import { documentAnalysisRepository } from "../repositories/document-analysis.repository";
import { documentsRepository } from "../repositories/documents.repository";
import { targetCompaniesRepository } from "../repositories/target-companies.repository";

const retriggerCounts = new Map<number, number>();

function getMimeTypeForFile(fileType: string): string {
  const mimeMap: Record<string, string> = {
    "pdf": "application/pdf",
    "doc": "application/msword",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "xls": "application/vnd.ms-excel",
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "xlsm": "application/vnd.ms-excel.sheet.macroEnabled.12",
    "ppt": "application/vnd.ms-powerpoint",
    "pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "csv": "text/csv",
    "tsv": "text/tab-separated-values",
    "txt": "text/plain",
    "rtf": "application/rtf",
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "png": "image/png",
    "gif": "image/gif",
    "bmp": "image/bmp",
    "tiff": "image/tiff",
    "tif": "image/tiff",
    "webp": "image/webp",
    "numbers": "application/vnd.apple.numbers",
    "pages": "application/vnd.apple.pages",
    "key": "application/vnd.apple.keynote",
    "odt": "application/vnd.oasis.opendocument.text",
    "ods": "application/vnd.oasis.opendocument.spreadsheet",
    "odp": "application/vnd.oasis.opendocument.presentation",
    "application/pdf": "application/pdf",
    "application/msword": "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel": "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/csv": "text/csv",
    "image/png": "image/png",
    "image/jpeg": "image/jpeg",
  };
  const normalized = fileType.toLowerCase();
  return mimeMap[normalized] || "application/octet-stream";
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
      classificationResult.documentTypes,
      event.documentId
    );

    for (const result of step2Results) {
      if (result.success && result.analysisData) {
        console.log(`[FILE_ANALYSIS] Storing ${result.documentType} analysis result for document ${event.documentId}`);
        
        try {
          const existingResult = await documentAnalysisRepository.getAnalysisResultByDocumentIdAndType(event.documentId, result.documentType);
          if (existingResult) {
            console.log(`[FILE_ANALYSIS] ${result.documentType} analysis already stored for document ${event.documentId} (id: ${existingResult.id}), skipping duplicate store`);
          } else {
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

    await runDocumentCompletionCheck(event.targetCompanyId, event.uploadedBy);

  } catch (error) {
    console.error(`[FILE_ANALYSIS] Failed to analyze file for event ${eventId}:`, error);
    
    await documentsRepository.updateFileUploadEventWebhookStatus(
      eventId, 
      'failed', 
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), 
      new Date()
    );

    try {
      const event = await documentsRepository.getFileUploadEvent(eventId);
      if (event) {
        await runDocumentCompletionCheck(event.targetCompanyId, event.uploadedBy);
      }
    } catch (checkError) {
      console.error(`[FILE_ANALYSIS] Post-failure completion check failed:`, checkError);
    }
  }
}

export async function runDocumentCompletionCheck(targetCompanyId: number, uploadedBy?: number | null): Promise<void> {
  try {
    const { documentAnalysisService } = await import('./document-analysis.service');
    const { expertAnalysisService } = await import('./expert-analysis.service');
    const { analysisQueue } = await import('./analysis-queue.service');

    const completionStatus = await documentAnalysisService.calculateCompletionStatusInternal(targetCompanyId);
    console.log(`[FILE_ANALYSIS] Document completion for company ${targetCompanyId}: ${completionStatus.completedCount}/${completionStatus.totalCount}`);

    if (!completionStatus.isComplete) {
      console.log(`[FILE_ANALYSIS] Only ${completionStatus.completedCount}/10 document types present for company ${targetCompanyId} — waiting for all documents before triggering expert analysis`);
      return;
    }

    const documentsMissingAnalysis = await documentAnalysisService.getDocumentsMissingAnalysis(targetCompanyId);

    if (documentsMissingAnalysis.length > 0) {
      const queueStats = analysisQueue.getStats();
      const companyQueue = queueStats.perCompany.find(c => c.targetCompanyId === targetCompanyId);
      const isAlreadyProcessing = companyQueue && (companyQueue.processing || companyQueue.pending > 0);

      if (isAlreadyProcessing) {
        console.log(`[FILE_ANALYSIS] All 10 document types present but ${documentsMissingAnalysis.length} missing analysis — queue already active for company ${targetCompanyId}, skipping retrigger`);
        return;
      }

      const MAX_RETRIGGERS = 3;
      const docsToRetrigger: number[] = [];
      for (const docId of documentsMissingAnalysis) {
        const count = retriggerCounts.get(docId) || 0;
        if (count >= MAX_RETRIGGERS) {
          console.warn(`[FILE_ANALYSIS] Document ${docId} has been retriggered ${count} times already — skipping (max ${MAX_RETRIGGERS})`);
        } else {
          retriggerCounts.set(docId, count + 1);
          docsToRetrigger.push(docId);
        }
      }

      if (docsToRetrigger.length === 0) {
        console.warn(`[FILE_ANALYSIS] All ${documentsMissingAnalysis.length} documents with missing analysis have exceeded retrigger limit for company ${targetCompanyId}`);
        return;
      }

      console.log(`[FILE_ANALYSIS] All 10 document types present but ${docsToRetrigger.length} document(s) missing analysis — re-queuing for document IDs: ${docsToRetrigger.join(', ')}`);

      for (const docId of docsToRetrigger) {
        try {
          const uploadEvent = await documentsRepository.getFileUploadEventByDocumentId(docId);
          if (uploadEvent) {
            console.log(`[FILE_ANALYSIS] Re-queuing analysis for document ${docId} (event ${uploadEvent.id}) [attempt ${retriggerCounts.get(docId)}/${MAX_RETRIGGERS}]`);
            await documentsRepository.updateFileUploadEventWebhookStatus(uploadEvent.id, 'pending', undefined, undefined);
            analysisQueue.enqueue({
              eventId: uploadEvent.id,
              targetCompanyId: targetCompanyId,
              isRetrigger: true,
            });
          } else {
            console.warn(`[FILE_ANALYSIS] No upload event found for document ${docId} — cannot re-trigger analysis`);
          }
        } catch (retriggerError) {
          console.error(`[FILE_ANALYSIS] Error re-queuing analysis for document ${docId}:`, retriggerError);
        }
      }
    } else {
      const existingExpertResults = await expertAnalysisService.getExpertResults(targetCompanyId);
      const hasRunningExperts = existingExpertResults.some(
        (r: any) => r.status === 'processing' || r.status === 'pending'
      );
      const hasCompletedScreening = existingExpertResults.some(
        (r: any) => r.expertType === 'screening' && r.status === 'success'
      );

      if (hasRunningExperts) {
        console.log(`[FILE_ANALYSIS] All 10 documents complete and analysed for company ${targetCompanyId}, but experts already running — skipping auto-trigger`);
      } else if (hasCompletedScreening) {
        console.log(`[FILE_ANALYSIS] All 10 documents complete and analysed for company ${targetCompanyId}, but screening already completed — skipping auto-trigger`);
      } else {
        console.log(`[FILE_ANALYSIS] All 10 documents uploaded and analysed for company ${targetCompanyId} — auto-triggering Stage 1 (Data Quality + Screening)`);
        expertAnalysisService.triggerNewStage1Pipeline(targetCompanyId, uploadedBy ?? undefined).catch(err => {
          console.error(`[FILE_ANALYSIS] Stage 1 auto-trigger failed for company ${targetCompanyId}:`, err.message);
        });
      }
    }
  } catch (expertError) {
    console.error(`[FILE_ANALYSIS] Error in completion check for company ${targetCompanyId}:`, expertError);
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
  runDocumentCompletionCheck,
};
