import { storage } from "../storage";
import { runStage1GeminiAnalysis, getMimeTypeForFile, type FileInfo } from "../gemini-stage1-service";
import { runDetailedGeminiAnalysis, type FileInfo as DetailedFileInfo } from "../gemini-detailed-analysis-service";
import { classifyDocumentWithGemini } from "../gemini-document-classification-service";
import { runStep2AnalysisForTypes } from "../gemini-step2-analysis-service";

declare global {
  var documentUpdateListeners: Array<{ targetCompanyId: number; res: any }> | undefined;
}

function getBaseUrl(): string {
  return process.env.REPLIT_DEV_DOMAIN 
    ? `https://${process.env.REPLIT_DEV_DOMAIN}`
    : process.env.REPL_SLUG && process.env.REPL_OWNER
      ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`
      : 'http://localhost:5000';
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

export async function analyzeUploadedFileWithGemini(eventId: number) {
  try {
    const event = await storage.getFileUploadEvent(eventId);
    if (!event) {
      console.error(`[FILE_ANALYSIS] Event ${eventId} not found`);
      return;
    }

    console.log(`[FILE_ANALYSIS] Starting Gemini analysis for event ${eventId}, file: ${event.fileName}`);

    const baseUrl = getBaseUrl();
    const fileUrl = `${baseUrl}/api/public/documents/${event.documentId}/download`;
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
      
      await storage.updateFileUploadEventWebhookStatus(
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

    await storage.updateFileUploadEventWebhookStatus(
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
          await storage.createDocumentAnalysisResult({
            documentId: event.documentId,
            fileUploadEventId: eventId,
            documentType: result.documentType,
            analysisData: result.analysisData,
            processingTime: result.processingTime || 0,
            usageMetadata: result.usageMetadata || null,
          });
          console.log(`[FILE_ANALYSIS] Successfully stored ${result.documentType} analysis for document ${event.documentId}`);
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

    await storage.updateFileUploadEventWebhookStatus(
      eventId, 
      'complete', 
      JSON.stringify(completeData, null, 2), 
      new Date()
    );
    
    if (global.documentUpdateListeners) {
      global.documentUpdateListeners.forEach((listener) => {
        if (listener.targetCompanyId === event.targetCompanyId) {
          listener.res.write(`data: ${JSON.stringify({ 
            type: 'analysis_completed', 
            targetCompanyId: event.targetCompanyId,
            documentId: event.documentId,
            documentTypes: classificationResult.documentTypes,
            confidence: classificationResult.confidence,
            step2Results: step2Results.map(r => ({ type: r.documentType, success: r.success })),
            timestamp: new Date().toISOString()
          })}\n\n`);
        }
      });
    }

    await checkAndTriggerStage1Analysis(event.targetCompanyId, event.uploadedBy);

  } catch (error) {
    console.error(`[FILE_ANALYSIS] Failed to analyze file for event ${eventId}:`, error);
    
    await storage.updateFileUploadEventWebhookStatus(
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

export async function checkStage1RequirementsByCategory(targetCompanyId: number): Promise<{shouldTrigger: boolean, status: string}> {
  try {
    const companyAccountsCount = await storage.getDocumentCountByCategory(targetCompanyId, 'Company Accounts');
    
    const requiredCategories = ['Profit & Loss', 'Balance Sheet', 'Staff Matrix', 'Sales Ledger', 'Asset Register'];
    const categoryCounts: {[key: string]: number} = {};
    
    for (const category of requiredCategories) {
      categoryCounts[category] = await storage.getDocumentCountByCategory(targetCompanyId, category);
    }
    
    console.log(`[STAGE1_ANALYSIS] Debug - Initial category counts:`, categoryCounts);
    
    if (categoryCounts['Balance Sheet'] === 0) {
      const balanceSheetAnalysis = await storage.getDocumentAnalysisResultsByTypeForCompany('balance_sheet', targetCompanyId);
      if (balanceSheetAnalysis.length > 0) {
        categoryCounts['Balance Sheet'] = balanceSheetAnalysis.length;
      }
    }
    
    const hasCompanyAccounts = companyAccountsCount >= 5;
    
    const hasAllCategories = requiredCategories.every(category => categoryCounts[category] > 0);
    
    const status = `Company Accounts: ${companyAccountsCount}/5, ` + 
      requiredCategories.map(cat => `${cat}: ${categoryCounts[cat]}`).join(', ');
    
    console.log(`[STAGE1_ANALYSIS] Document category status for company ${targetCompanyId}: ${status}`);
    
    return {
      shouldTrigger: hasCompanyAccounts && hasAllCategories,
      status
    };
    
  } catch (error) {
    console.error(`[STAGE1_ANALYSIS] Error checking category requirements:`, error);
    return { shouldTrigger: false, status: 'Error checking requirements' };
  }
}

export async function checkAndTriggerStage1Analysis(targetCompanyId: number, triggeredBy: number, bypassRequirements = false) {
  try {
    console.log(`[STAGE1_ANALYSIS] Checking completion status for company ${targetCompanyId}${bypassRequirements ? ' (bypassing requirements)' : ''}`);
    
    const targetCompany = await storage.getTargetCompany(targetCompanyId, 0);
    if (!targetCompany) {
      console.error(`[STAGE1_ANALYSIS] Company ${targetCompanyId} not found`);
      return;
    }

    const existingEvent = await storage.getLatestStage1AnalysisEvent(targetCompanyId);
    if (existingEvent && existingEvent.webhookStatus === 'success' && !bypassRequirements) {
      const latestDocumentUpload = await storage.getLatestDocumentUploadTime(targetCompanyId);
      
      if (latestDocumentUpload && existingEvent.createdAt) {
        const docUploadTime = new Date(latestDocumentUpload).getTime();
        const eventCreatedTime = new Date(existingEvent.createdAt).getTime();
        
        if (docUploadTime > eventCreatedTime) {
          console.log(`[STAGE1_ANALYSIS] Documents modified after last successful analysis for company ${targetCompanyId}. Latest doc: ${latestDocumentUpload}, Last analysis: ${existingEvent.createdAt}. Re-triggering webhooks.`);
        } else {
          console.log(`[STAGE1_ANALYSIS] Stage 1 analysis already completed successfully for company ${targetCompanyId} (Event ID: ${existingEvent.id}). No new documents since then.`);
          return;
        }
      } else {
        console.log(`[STAGE1_ANALYSIS] Stage 1 analysis already completed successfully for company ${targetCompanyId} (Event ID: ${existingEvent.id})`);
        return;
      }
    }

    if (!bypassRequirements) {
      const categoryCheck = await checkStage1RequirementsByCategory(targetCompanyId);
      
      if (!categoryCheck.shouldTrigger) {
        console.log(`[STAGE1_ANALYSIS] Stage 1 requirements not met for company ${targetCompanyId}. Status: ${categoryCheck.status}`);
        return;
      }

      console.log(`[STAGE1_ANALYSIS] All Stage 1 requirements met for company ${targetCompanyId}. Triggering stage 1 webhook.`);
    } else {
      console.log(`[STAGE1_ANALYSIS] Bypassing requirements check for company ${targetCompanyId}. Triggering stage 1 webhook with available documents.`);
    }

    const companyAccountsData = await storage.getDocumentAnalysisResultsByTypeForCompany('company_accounts', targetCompanyId);
    const analysisData = await storage.getDocumentAnalysisResultsByTypeForCompany('asset_register', targetCompanyId);
    const salesLedgerData = await storage.getDocumentAnalysisResultsByTypeForCompany('sales_ledger', targetCompanyId);
    const staffMatrixData = await storage.getDocumentAnalysisResultsByTypeForCompany('staff_matrix', targetCompanyId);
    const profitLossData = await storage.getDocumentAnalysisResultsByTypeForCompany('profit_and_loss', targetCompanyId);
    const balanceSheetData = await storage.getDocumentAnalysisResultsByTypeForCompany('balance_sheet', targetCompanyId);

    console.log(`[STAGE1_ANALYSIS] Debug - Retrieved analysis data counts:`, {
      company_accounts: companyAccountsData.length,
      asset_register: analysisData.length,
      sales_ledger: salesLedgerData.length, 
      staff_matrix: staffMatrixData.length,
      profit_and_loss: profitLossData.length,
      balance_sheet: balanceSheetData.length
    });

    if (companyAccountsData.length > 0) {
      console.log(`[STAGE1_ANALYSIS] Debug - Sample company_accounts data:`, JSON.stringify(companyAccountsData[0].analysisData, null, 2));
    }

    const enhanceProfitLossData = (analysisData: any) => {
      if (!analysisData) return analysisData;

      try {
        const enhanced = JSON.parse(JSON.stringify(analysisData));
        
        if (enhanced.years && typeof enhanced.years === 'object') {
          Object.keys(enhanced.years).forEach(year => {
            const yearData = enhanced.years[year];
            
            if (yearData.profit_and_loss) {
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
            }
          });
        }
        
        if (enhanced.profit_and_loss) {
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
        
        return enhanced;
      } catch (error) {
        console.error('Error enhancing profit & loss data for aggregated JSON:', error);
        return analysisData;
      }
    };

    const sector = targetCompany.industry || '';
    const subSector = targetCompany.subSector || '';
    const industry = subSector ? `${sector}- ${subSector}` : sector;
    
    const concatenatedData = {
      company_name: targetCompany.companyName,
      sector: sector,
      sub_sector: subSector || null,
      industry: industry || null,
      company_accounts: companyAccountsData.map(d => d.analysisData).filter(data => data),
      asset_register: analysisData.map(d => d.analysisData).filter(data => data),
      sales_ledger: salesLedgerData.map(d => d.analysisData).filter(data => data),
      staff_matrix: staffMatrixData.map(d => d.analysisData).filter(data => data),
      profit_and_loss: profitLossData.map(d => enhanceProfitLossData(d.analysisData)).filter(data => data),
      balance_sheet: balanceSheetData.map(d => d.analysisData).filter(data => data),
      timestamp: new Date().toISOString(),
      company_id: targetCompanyId
    };

    const stage1Event = await storage.createStage1AnalysisEvent({
      targetCompanyId,
      triggeredBy,
      concatenatedData
    });

    console.log(`[STAGE1_ANALYSIS] Created stage 1 analysis event ${stage1Event.id} for company ${targetCompanyId}`);

    setTimeout(() => {
      runGeminiStage1Analysis(stage1Event.id, targetCompanyId, targetCompany.companyName, sector);
    }, 100);

  } catch (error) {
    console.error(`[STAGE1_ANALYSIS] Failed to check and trigger stage 1 analysis for company ${targetCompanyId}:`, error);
  }
}

export async function runGeminiStage1Analysis(eventId: number, targetCompanyId: number, companyName: string, sector: string) {
  console.log(`[GEMINI_STAGE1_ANALYSIS] Starting Gemini analysis for event ${eventId}, company ${companyName}`);

  try {
    const documentFiles = await storage.getStage1DocumentFiles(targetCompanyId);
    
    if (documentFiles.length === 0) {
      console.error(`[GEMINI_STAGE1_ANALYSIS] No documents found for company ${targetCompanyId}`);
      await storage.updateStage1AnalysisEventWebhookStatus(
        eventId, 
        'failed', 
        'No documents found for analysis', 
        new Date()
      );
      return;
    }

    console.log(`[GEMINI_STAGE1_ANALYSIS] Found ${documentFiles.length} documents for analysis`);

    const baseUrl = getBaseUrl();
    console.log(`[GEMINI_STAGE1_ANALYSIS] Using base URL: ${baseUrl}`);

    const files: FileInfo[] = documentFiles.map(doc => ({
      fileUrl: `${baseUrl}/api/public/documents/${doc.documentId}/download`,
      mimeType: getMimeTypeForFile(doc.mimeType),
      category: doc.category,
    }));

    console.log(`[GEMINI_STAGE1_ANALYSIS] File URLs:`, files.map(f => f.fileUrl));

    const result = await runStage1GeminiAnalysis({
      companyName,
      sector,
      files,
    });

    if (result.success && result.markdown) {
      await storage.updateStage1AnalysisEventWebhookStatus(
        eventId, 
        'success', 
        result.markdown, 
        new Date(),
        result.processingTime,
        result.usageMetadata
      );

      console.log(`[GEMINI_STAGE1_ANALYSIS] Analysis completed successfully for event ${eventId}, length: ${result.markdown.length} characters`);

      const event = await storage.getStage1AnalysisEvent(eventId);
      
      if (global.documentUpdateListeners && event) {
        global.documentUpdateListeners.forEach((listener) => {
          if (listener.targetCompanyId === targetCompanyId) {
            listener.res.write(`data: ${JSON.stringify({ 
              type: 'stage1_analysis_completed', 
              targetCompanyId: targetCompanyId,
              eventId: eventId,
              timestamp: new Date().toISOString()
            })}\n\n`);
          }
        });
      }
      console.log(`[GEMINI_STAGE1_ANALYSIS] SSE notification sent for Stage 1 analysis completion of company ${targetCompanyId}`);
    } else {
      await storage.updateStage1AnalysisEventWebhookStatus(
        eventId, 
        'failed', 
        JSON.stringify({ error: result.error || 'Unknown error' }), 
        new Date(),
        result.processingTime
      );

      console.error(`[GEMINI_STAGE1_ANALYSIS] Analysis failed for event ${eventId}: ${result.error}`);
    }
  } catch (error) {
    console.error(`[GEMINI_STAGE1_ANALYSIS] Error running analysis for event ${eventId}:`, error);
    
    await storage.updateStage1AnalysisEventWebhookStatus(
      eventId, 
      'failed', 
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), 
      new Date()
    );
  }
}

export async function runGeminiDetailedAnalysis(eventId: number, targetCompanyId: number) {
  console.log(`[GEMINI_DETAILED_ANALYSIS] Starting Gemini detailed analysis for event ${eventId}, company ${targetCompanyId}`);

  try {
    const documentFiles = await storage.getStage1DocumentFiles(targetCompanyId);
    
    if (documentFiles.length === 0) {
      console.error(`[GEMINI_DETAILED_ANALYSIS] No documents found for company ${targetCompanyId}`);
      await storage.updateDetailedAnalysisStatus(
        eventId, 
        'failed', 
        'No documents found for analysis'
      );
      return;
    }

    console.log(`[GEMINI_DETAILED_ANALYSIS] Found ${documentFiles.length} documents for analysis`);

    const baseUrl = getBaseUrl();
    console.log(`[GEMINI_DETAILED_ANALYSIS] Using base URL: ${baseUrl}`);

    const files: DetailedFileInfo[] = documentFiles.map(doc => ({
      fileUrl: `${baseUrl}/api/public/documents/${doc.documentId}/download`,
      mimeType: getMimeTypeForFile(doc.mimeType),
      category: doc.category,
    }));

    console.log(`[GEMINI_DETAILED_ANALYSIS] File URLs:`, files.map(f => f.fileUrl));

    const result = await runDetailedGeminiAnalysis({
      files,
    });

    if (result.success && result.markdown) {
      await storage.updateDetailedAnalysisStatus(
        eventId, 
        'success', 
        result.markdown, 
        result.processingTime,
        result.usageMetadata
      );

      console.log(`[GEMINI_DETAILED_ANALYSIS] Analysis completed successfully for event ${eventId}, length: ${result.markdown.length} characters`);

      const event = await storage.getStage1AnalysisEvent(eventId);
      if (global.documentUpdateListeners && event) {
        global.documentUpdateListeners.forEach((listener) => {
          if (listener.targetCompanyId === targetCompanyId) {
            listener.res.write(`data: ${JSON.stringify({ 
              type: 'detailed_analysis_completed', 
              targetCompanyId: targetCompanyId,
              eventId: eventId,
              timestamp: new Date().toISOString()
            })}\n\n`);
          }
        });
      }
      console.log(`[GEMINI_DETAILED_ANALYSIS] SSE notification sent for detailed analysis completion of company ${targetCompanyId}`);
    } else {
      await storage.updateDetailedAnalysisStatus(
        eventId, 
        'failed', 
        result.error || 'Unknown error', 
        result.processingTime
      );

      console.error(`[GEMINI_DETAILED_ANALYSIS] Analysis failed for event ${eventId}: ${result.error}`);
    }
  } catch (error) {
    console.error(`[GEMINI_DETAILED_ANALYSIS] Error running analysis for event ${eventId}:`, error);
    
    await storage.updateDetailedAnalysisStatus(
      eventId, 
      'failed', 
      error instanceof Error ? error.message : 'Unknown error'
    );
  }
}

export async function sendStage1AnalysisWebhook(eventId: number) {
  const webhookUrl = process.env.STAGE1_JSON_ANALYSER_WEBHOOK_URL;
  if (!webhookUrl) {
    console.log(`[STAGE1_ANALYSIS_WEBHOOK] No webhook URL configured for event ${eventId}`);
    return;
  }

  try {
    const event = await storage.getStage1AnalysisEvent(eventId);
    if (!event) {
      console.error(`[STAGE1_ANALYSIS_WEBHOOK] Event ${eventId} not found`);
      return;
    }

    const startTime = Date.now();
    
    const webhookPayload = {
      event_type: "stage1_analysis_complete",
      timestamp: new Date().toISOString(),
      id: event.targetCompanyId,
      triggered_by: event.triggeredBy,
      ...(event.concatenatedData as Record<string, unknown> || {}),
    };

    console.log(`[STAGE1_ANALYSIS_WEBHOOK] Sending webhook for event ${eventId}:`, JSON.stringify(webhookPayload, null, 2));

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(webhookPayload),
    });

    const processingTime = Date.now() - startTime;
    const responseText = await response.text();

    const webhookStatus = response.ok ? 'success' : 'failed';

    await storage.updateStage1AnalysisEventWebhookStatus(
      eventId, 
      webhookStatus, 
      responseText,
      new Date(),
      processingTime
    );

    console.log(`[STAGE1_ANALYSIS_WEBHOOK] Webhook sent for event ${eventId}, status: ${webhookStatus}, time: ${processingTime}ms`);

    if (response.ok) {
      console.log(`[STAGE1_ANALYSIS_WEBHOOK] Received markdown analysis response for event ${eventId}, length: ${responseText.length} characters`);
      
      if (global.documentUpdateListeners) {
        global.documentUpdateListeners.forEach((listener) => {
          if (listener.targetCompanyId === event.targetCompanyId) {
            listener.res.write(`data: ${JSON.stringify({ 
              type: 'stage1_analysis_completed', 
              targetCompanyId: event.targetCompanyId,
              eventId: eventId,
              timestamp: new Date().toISOString()
            })}\n\n`);
          }
        });
      }
      console.log(`[STAGE1_ANALYSIS_WEBHOOK] SSE notification sent for Stage 1 analysis completion of company ${event.targetCompanyId}`);
    }

  } catch (error) {
    console.error(`[STAGE1_ANALYSIS_WEBHOOK] Failed to send webhook for event ${eventId}:`, error);
    
    await storage.updateStage1AnalysisEventWebhookStatus(
      eventId, 
      'failed', 
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), 
      new Date()
    );
  }
}

export async function sendDetailedAnalysisWebhook(eventId: number) {
  const webhookUrl = process.env.STAGE1_Detailed_Analysis_URL;
  if (!webhookUrl) {
    console.log(`[DETAILED_ANALYSIS_WEBHOOK] No webhook URL configured for event ${eventId}`);
    return;
  }

  try {
    const event = await storage.getStage1AnalysisEvent(eventId);
    if (!event) {
      console.error(`[DETAILED_ANALYSIS_WEBHOOK] Event ${eventId} not found`);
      return;
    }

    const startTime = Date.now();
    
    const webhookPayload = {
      event_type: "stage1_analysis_complete",
      timestamp: new Date().toISOString(),
      id: event.targetCompanyId,
      triggered_by: event.triggeredBy,
      ...(event.concatenatedData as Record<string, unknown> || {}),
    };

    console.log(`[DETAILED_ANALYSIS_WEBHOOK] Sending webhook for event ${eventId}:`, JSON.stringify(webhookPayload, null, 2));

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 300000);
    
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(webhookPayload),
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);

    const processingTime = Date.now() - startTime;
    const responseText = await response.text();

    if (response.ok) {
      console.log(`[DETAILED_ANALYSIS_WEBHOOK] Webhook sent successfully for event ${eventId}, time: ${processingTime}ms`);
      
      try {
        const detailedData = JSON.parse(responseText);
        
        await storage.updateStage1AnalysisEventDetailedData(eventId, detailedData);
        
        console.log(`[DETAILED_ANALYSIS_WEBHOOK] Stored detailed analysis data for event ${eventId}, length: ${responseText.length} characters`);
        
        if (global.documentUpdateListeners) {
          global.documentUpdateListeners.forEach((listener) => {
            if (listener.targetCompanyId === event.targetCompanyId) {
              listener.res.write(`data: ${JSON.stringify({ 
                type: 'detailed_analysis_completed', 
                targetCompanyId: event.targetCompanyId,
                eventId: eventId,
                timestamp: new Date().toISOString()
              })}\n\n`);
            }
          });
        }
        console.log(`[DETAILED_ANALYSIS_WEBHOOK] SSE notification sent for detailed analysis completion of company ${event.targetCompanyId}`);
      } catch (parseError) {
        console.error(`[DETAILED_ANALYSIS_WEBHOOK] Failed to parse response as JSON for event ${eventId}:`, parseError);
        console.log(`[DETAILED_ANALYSIS_WEBHOOK] Response text:`, responseText);
      }
    } else {
      console.error(`[DETAILED_ANALYSIS_WEBHOOK] Webhook failed for event ${eventId}, status: ${response.status}, response: ${responseText}`);
    }

  } catch (error) {
    console.error(`[DETAILED_ANALYSIS_WEBHOOK] Failed to send webhook for event ${eventId}:`, error);
  }
}

export async function processFileUploadWebhookResponse(webhookResponse: any, eventId: number) {
  try {
    console.log(`[FILE_UPLOAD_WEBHOOK] Processing analysis response for event ${eventId}`);
    
    const event = await storage.getFileUploadEvent(eventId);
    if (!event) {
      console.error(`[FILE_UPLOAD_WEBHOOK] Event ${eventId} not found for processing`);
      return;
    }

    let analysisItems: Array<{documentType: string, analysisData: any}> = [];
    
    if (Array.isArray(webhookResponse)) {
      for (const item of webhookResponse) {
        if (item.document === 'company_accounts' && item.data) {
          analysisItems.push({
            documentType: item.data.document_type,
            analysisData: {
              document: 'company_accounts',
              data: item.data
            }
          });
        } else if (item.document_type && item.data) {
          analysisItems.push({
            documentType: item.document_type,
            analysisData: {
              ...item.data,
              ...(item.summary && { summary: item.summary })
            }
          });
        }
      }
    } else if (webhookResponse.data && webhookResponse.data.document_type) {
      analysisItems.push({
        documentType: webhookResponse.data.document_type,
        analysisData: {
          ...webhookResponse.data.data,
          ...(webhookResponse.data.summary && { summary: webhookResponse.data.summary })
        }
      });
    } else if (webhookResponse.document_type && webhookResponse.data) {
      analysisItems.push({
        documentType: webhookResponse.document_type,
        analysisData: {
          ...webhookResponse.data,
          ...(webhookResponse.summary && { summary: webhookResponse.summary })
        }
      });
    } else {
      console.error(`[FILE_UPLOAD_WEBHOOK] Invalid webhook response structure for event ${eventId}:`, webhookResponse);
      return;
    }

    if (analysisItems.length === 0) {
      console.error(`[FILE_UPLOAD_WEBHOOK] No valid analysis items found in webhook response for event ${eventId}`);
      return;
    }

    const results = [];
    for (const item of analysisItems) {
      let enhancedAnalysisData = item.analysisData;
      if (item.documentType === 'profit_and_loss') {
        enhancedAnalysisData = enhanceProfitLossWithCalculations(item.analysisData);
      }

      const analysisResult = {
        documentId: event.documentId,
        fileUploadEventId: eventId,
        documentType: item.documentType,
        analysisData: enhancedAnalysisData,
        processingTime: webhookResponse.processingTime || null,
      };

      const result = await storage.createDocumentAnalysisResult(analysisResult);
      results.push(result);
      
      if (global.documentUpdateListeners) {
        global.documentUpdateListeners.forEach((listener) => {
          if (listener.targetCompanyId === event.targetCompanyId) {
            listener.res.write(`data: ${JSON.stringify({ 
              type: 'analysis_completed', 
              targetCompanyId: event.targetCompanyId,
              documentId: event.documentId,
              documentType: item.documentType,
              timestamp: new Date().toISOString()
            })}\n\n`);
          }
        });
      }
      console.log(`[FILE_UPLOAD_WEBHOOK] Analysis results stored for document ${event.documentId}, type: ${item.documentType}, result ID: ${result.id}`);
    }

    console.log(`[FILE_UPLOAD_WEBHOOK] Successfully processed ${results.length} analysis result(s) for event ${eventId}`);

    await checkAndTriggerStage1Analysis(event.targetCompanyId, event.uploadedBy);

  } catch (error) {
    console.error(`[FILE_UPLOAD_WEBHOOK] Failed to process webhook response for event ${eventId}:`, error);
  }
}

export const fileAnalysisService = {
  analyzeUploadedFileWithGemini,
  sendFileUploadWebhook,
  checkStage1RequirementsByCategory,
  checkAndTriggerStage1Analysis,
  runGeminiStage1Analysis,
  runGeminiDetailedAnalysis,
  sendStage1AnalysisWebhook,
  sendDetailedAnalysisWebhook,
  processFileUploadWebhookResponse,
};
