import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import bcrypt from "bcrypt";
import session from "express-session";
import { randomUUID } from "crypto";
import { z } from "zod";
import { insertUserSchema, insertUserCompanySchema, insertTargetCompanySchema, insertTargetContactSchema, insertUserInvitationSchema, insertUserDealAssignmentSchema, insertTeamNotificationSchema, insertActivitySchema, insertDocumentSchema, insertPortalLinkCampaignSchema, insertPortalEmailTemplateSchema, insertCompanyDocumentRequirementSchema, insertFileUploadEventSchema } from "@shared/schema";
import connectPg from "connect-pg-simple";
import { emailService } from "./email";
import multer from "multer";
import path from "path";
import fs from "fs/promises";

// Import db and schema for direct queries when needed
import { db } from "./db";
import { stage1AnalysisEvents } from "@shared/schema";
import { eq, desc } from "drizzle-orm";

// Import Gemini analysis service for Stage 1 analysis
import { runStage1GeminiAnalysis, getMimeTypeForFile, type FileInfo } from "./gemini-stage1-service";
import { runDetailedGeminiAnalysis, type FileInfo as DetailedFileInfo } from "./gemini-detailed-analysis-service";
import { classifyDocumentWithGemini, type DocumentClassificationResult } from "./gemini-document-classification-service";
import { runStep2AnalysisForTypes, type DocumentType } from "./gemini-step2-analysis-service";

// Import modular routes (new architecture)
import { registerModularRoutes } from "./routes/index";

// Import website analysis service for triggering on new company creation
import { websiteAnalysisService } from "./services/website-analysis.service";

// Function to analyze uploaded files using Gemini (Step 1: Classification, Step 2: Detailed Analysis)
async function analyzeUploadedFileWithGemini(eventId: number) {
  try {
    // Get the file upload event
    const event = await storage.getFileUploadEvent(eventId);
    if (!event) {
      console.error(`[FILE_ANALYSIS] Event ${eventId} not found`);
      return;
    }

    console.log(`[FILE_ANALYSIS] Starting Gemini analysis for event ${eventId}, file: ${event.fileName}`);

    // Construct HTTPS URL for Gemini (it requires HTTPS URLs)
    const baseUrl = process.env.REPLIT_DEV_DOMAIN 
      ? `https://${process.env.REPLIT_DEV_DOMAIN}`
      : process.env.REPL_SLUG && process.env.REPL_OWNER
        ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`
        : 'https://localhost:5000';
    
    const fileUrl = `${baseUrl}/api/public/documents/${event.documentId}/download`;
    console.log(`[FILE_ANALYSIS] Using HTTPS URL: ${fileUrl}`);

    // Step 1: Classify the document using Gemini
    // Extract file extension from filename to get proper MIME type
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
      
      // Update event with error status
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

    // Store classification result in webhook response field for now
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

    // If document types is "none", no further analysis needed
    if (classificationResult.documentTypes.length === 0 || 
        (classificationResult.documentTypes.length === 1 && classificationResult.documentTypes[0] === 'none')) {
      console.log(`[FILE_ANALYSIS] No matching document type for event ${eventId}, skipping Step 2 analysis`);
      return;
    }

    // Step 2: For each document type, call the appropriate detailed analysis
    console.log(`[FILE_ANALYSIS] Starting Step 2 analysis for types: ${classificationResult.documentTypes.join(', ')}`);
    
    const step2Results = await runStep2AnalysisForTypes(
      fileUrl,
      mimeType,
      event.fileName,
      classificationResult.documentTypes
    );

    // Store Step 2 analysis results in the database
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

    // Update file upload event with complete status
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
    
    // Notify connected clients about analysis completion
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

    // After classification and analysis, check if Stage 1 requirements are met
    await checkAndTriggerStage1Analysis(event.targetCompanyId, event.uploadedBy);

  } catch (error) {
    console.error(`[FILE_ANALYSIS] Failed to analyze file for event ${eventId}:`, error);
    
    // Update event with error status
    await storage.updateFileUploadEventWebhookStatus(
      eventId, 
      'failed', 
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), 
      new Date()
    );
  }
}

// Legacy webhook function - kept for backward compatibility if needed
// Exported for use by v2 document upload routes
export async function sendFileUploadWebhook(eventId: number) {
  // Now redirects to Gemini-based analysis
  return analyzeUploadedFileWithGemini(eventId);
}

// Function to check if Stage 1 webhook should be triggered based on document categories and analysis results
async function checkStage1RequirementsByCategory(targetCompanyId: number): Promise<{shouldTrigger: boolean, status: string}> {
  try {
    // Check for 5 Company Accounts files
    const companyAccountsCount = await storage.getDocumentCountByCategory(targetCompanyId, 'Company Accounts');
    
    // Check for at least 1 file in each of the 5 required categories
    const requiredCategories = ['Profit & Loss', 'Balance Sheet', 'Staff Matrix', 'Sales Ledger', 'Asset Register'];
    const categoryCounts: {[key: string]: number} = {};
    
    for (const category of requiredCategories) {
      categoryCounts[category] = await storage.getDocumentCountByCategory(targetCompanyId, category);
    }
    
    console.log(`[STAGE1_ANALYSIS] Debug - Initial category counts:`, categoryCounts);
    
    // For Balance Sheet, also check if we have balance_sheet analysis results (for Company Accounts uploads)
    if (categoryCounts['Balance Sheet'] === 0) {
      const balanceSheetAnalysis = await storage.getDocumentAnalysisResultsByTypeForCompany('balance_sheet', targetCompanyId);
      if (balanceSheetAnalysis.length > 0) {
        categoryCounts['Balance Sheet'] = balanceSheetAnalysis.length;
      }
    }
    
    // Check if we have 5 Company Accounts files
    const hasCompanyAccounts = companyAccountsCount >= 5;
    
    // Check if we have at least 1 file in each required category (or corresponding analysis)
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

// Function to process webhook response and store analysis results
async function checkAndTriggerStage1Analysis(targetCompanyId: number, triggeredBy: number, bypassRequirements = false) {
  try {
    console.log(`[STAGE1_ANALYSIS] Checking completion status for company ${targetCompanyId}${bypassRequirements ? ' (bypassing requirements)' : ''}`);
    
    // Get the target company to find the userCompanyId
    const targetCompany = await storage.getTargetCompany(targetCompanyId, 0);
    if (!targetCompany) {
      console.error(`[STAGE1_ANALYSIS] Company ${targetCompanyId} not found`);
      return;
    }


    // Check if we already have a successful Stage 1 analysis for this company
    const existingEvent = await storage.getLatestStage1AnalysisEvent(targetCompanyId);
    if (existingEvent && existingEvent.webhookStatus === 'success' && !bypassRequirements) {
      // Check if any documents have been uploaded/modified after the last successful analysis
      const latestDocumentUpload = await storage.getLatestDocumentUploadTime(targetCompanyId);
      
      if (latestDocumentUpload && existingEvent.createdAt) {
        const docUploadTime = new Date(latestDocumentUpload).getTime();
        const eventCreatedTime = new Date(existingEvent.createdAt).getTime();
        
        if (docUploadTime > eventCreatedTime) {
          console.log(`[STAGE1_ANALYSIS] Documents modified after last successful analysis for company ${targetCompanyId}. Latest doc: ${latestDocumentUpload}, Last analysis: ${existingEvent.createdAt}. Re-triggering webhooks.`);
          // Allow re-triggering - fall through to continue with webhook triggering
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
      // Check requirements based on document categories (not analysis results)
      const categoryCheck = await checkStage1RequirementsByCategory(targetCompanyId);
      
      if (!categoryCheck.shouldTrigger) {
        console.log(`[STAGE1_ANALYSIS] Stage 1 requirements not met for company ${targetCompanyId}. Status: ${categoryCheck.status}`);
        return;
      }

      console.log(`[STAGE1_ANALYSIS] All Stage 1 requirements met for company ${targetCompanyId}. Triggering stage 1 webhook.`);
    } else {
      console.log(`[STAGE1_ANALYSIS] Bypassing requirements check for company ${targetCompanyId}. Triggering stage 1 webhook with available documents.`);
    }

    // Get all analysis data for concatenation
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

    // Function to enhance profit & loss data with financial ratios
    const enhanceProfitLossData = (analysisData: any) => {
      if (!analysisData) return analysisData;

      try {
        // Create a deep copy to avoid modifying the original
        const enhanced = JSON.parse(JSON.stringify(analysisData));
        
        // Check if we have years data with profit and loss information
        if (enhanced.years && typeof enhanced.years === 'object') {
          Object.keys(enhanced.years).forEach(year => {
            const yearData = enhanced.years[year];
            
            // Ensure profit_and_loss object exists
            if (yearData.profit_and_loss) {
              const pl = yearData.profit_and_loss;
              
              // Calculate Gross Margin % = (Gross Profit / Revenue) * 100
              if (pl.revenue && pl.gross_profit && pl.revenue > 0) {
                pl.gross_margin_percentage = Number(((pl.gross_profit / pl.revenue) * 100).toFixed(2));
              }
              
              // Calculate Net Margin % = (Net Profit / Revenue) * 100
              if (pl.revenue && pl.net_profit && pl.revenue > 0) {
                pl.net_margin_percentage = Number(((pl.net_profit / pl.revenue) * 100).toFixed(2));
              }
              
              // Calculate Interest Coverage Ratio = Operating Profit / Interest Payable
              if (pl.operating_profit && pl.interest_payable && pl.interest_payable > 0) {
                pl.interest_coverage_ratio = Number((pl.operating_profit / pl.interest_payable).toFixed(2));
              }
            }
          });
        }
        
        // Also check for direct profit_and_loss data (without years structure)
        if (enhanced.profit_and_loss) {
          const pl = enhanced.profit_and_loss;
          
          // Calculate ratios
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

    // Concatenate all analysis data - extract analysisData field from each result
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

    // Create a stage 1 analysis event
    const stage1Event = await storage.createStage1AnalysisEvent({
      targetCompanyId,
      triggeredBy,
      concatenatedData
    });

    console.log(`[STAGE1_ANALYSIS] Created stage 1 analysis event ${stage1Event.id} for company ${targetCompanyId}`);

    // Run Gemini-based Stage 1 analysis instead of external webhooks
    setTimeout(() => {
      runGeminiStage1Analysis(stage1Event.id, targetCompanyId, targetCompany.companyName, sector);
    }, 100);

  } catch (error) {
    console.error(`[STAGE1_ANALYSIS] Failed to check and trigger stage 1 analysis for company ${targetCompanyId}:`, error);
  }
}

// New function to run Gemini-based Stage 1 analysis
async function runGeminiStage1Analysis(eventId: number, targetCompanyId: number, companyName: string, sector: string) {
  console.log(`[GEMINI_STAGE1_ANALYSIS] Starting Gemini analysis for event ${eventId}, company ${companyName}`);

  try {
    // Get the document files for this company
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

    // Construct the base URL for public document access
    const baseUrl = process.env.REPLIT_DEV_DOMAIN 
      ? `https://${process.env.REPLIT_DEV_DOMAIN}`
      : process.env.REPL_SLUG && process.env.REPL_OWNER
        ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`
        : 'http://localhost:5000';

    console.log(`[GEMINI_STAGE1_ANALYSIS] Using base URL: ${baseUrl}`);

    // Convert to FileInfo format for Gemini service with public URLs
    const files: FileInfo[] = documentFiles.map(doc => ({
      fileUrl: `${baseUrl}/api/public/documents/${doc.documentId}/download`,
      mimeType: getMimeTypeForFile(doc.mimeType),
      category: doc.category,
    }));

    console.log(`[GEMINI_STAGE1_ANALYSIS] File URLs:`, files.map(f => f.fileUrl));

    // Run Gemini analysis
    const result = await runStage1GeminiAnalysis({
      companyName,
      sector,
      files,
    });

    if (result.success && result.markdown) {
      // Update the event with success status and markdown response
      await storage.updateStage1AnalysisEventWebhookStatus(
        eventId, 
        'success', 
        result.markdown, 
        new Date(),
        result.processingTime,
        result.usageMetadata
      );

      console.log(`[GEMINI_STAGE1_ANALYSIS] Analysis completed successfully for event ${eventId}, length: ${result.markdown.length} characters`);

      // Get the event to notify clients
      const event = await storage.getStage1AnalysisEvent(eventId);
      
      // Notify connected clients about Stage 1 analysis completion (for real-time UI updates)
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
      // Update the event with failed status
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

// Function to run Gemini-based Detailed analysis
async function runGeminiDetailedAnalysis(eventId: number, targetCompanyId: number) {
  console.log(`[GEMINI_DETAILED_ANALYSIS] Starting Gemini detailed analysis for event ${eventId}, company ${targetCompanyId}`);

  try {
    // Get the document files for this company
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

    // Construct the base URL for public document access
    const baseUrl = process.env.REPLIT_DEV_DOMAIN 
      ? `https://${process.env.REPLIT_DEV_DOMAIN}`
      : process.env.REPL_SLUG && process.env.REPL_OWNER
        ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`
        : 'http://localhost:5000';

    console.log(`[GEMINI_DETAILED_ANALYSIS] Using base URL: ${baseUrl}`);

    // Convert to FileInfo format for Gemini service with public URLs
    const files: DetailedFileInfo[] = documentFiles.map(doc => ({
      fileUrl: `${baseUrl}/api/public/documents/${doc.documentId}/download`,
      mimeType: getMimeTypeForFile(doc.mimeType),
      category: doc.category,
    }));

    console.log(`[GEMINI_DETAILED_ANALYSIS] File URLs:`, files.map(f => f.fileUrl));

    // Run Gemini detailed analysis
    const result = await runDetailedGeminiAnalysis({
      files,
    });

    if (result.success && result.markdown) {
      // Update the event with success status and markdown response
      await storage.updateDetailedAnalysisStatus(
        eventId, 
        'success', 
        result.markdown, 
        result.processingTime,
        result.usageMetadata
      );

      console.log(`[GEMINI_DETAILED_ANALYSIS] Analysis completed successfully for event ${eventId}, length: ${result.markdown.length} characters`);

      // Notify connected clients about detailed analysis completion
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
      // Update the event with failed status
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

async function sendStage1AnalysisWebhook(eventId: number) {
  const webhookUrl = process.env.STAGE1_JSON_ANALYSER_WEBHOOK_URL;
  if (!webhookUrl) {
    console.log(`[STAGE1_ANALYSIS_WEBHOOK] No webhook URL configured for event ${eventId}`);
    return;
  }

  try {
    // Get the stage 1 analysis event
    const event = await storage.getStage1AnalysisEvent(eventId);
    if (!event) {
      console.error(`[STAGE1_ANALYSIS_WEBHOOK] Event ${eventId} not found`);
      return;
    }

    const startTime = Date.now();
    
    // Prepare webhook payload - flatten structure to root level
    const webhookPayload = {
      event_type: "stage1_analysis_complete",
      timestamp: new Date().toISOString(),
      id: event.targetCompanyId,
      triggered_by: event.triggeredBy,
      ...event.concatenatedData,
    };

    console.log(`[STAGE1_ANALYSIS_WEBHOOK] Sending webhook for event ${eventId}:`, JSON.stringify(webhookPayload, null, 2));

    // Send webhook
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

    // Update the event with webhook response (expecting markdown format)
    await storage.updateStage1AnalysisEventWebhookStatus(
      eventId, 
      webhookStatus, 
      responseText, // Store markdown response directly
      new Date(),
      processingTime
    );

    console.log(`[STAGE1_ANALYSIS_WEBHOOK] Webhook sent for event ${eventId}, status: ${webhookStatus}, time: ${processingTime}ms`);

    if (response.ok) {
      console.log(`[STAGE1_ANALYSIS_WEBHOOK] Received markdown analysis response for event ${eventId}, length: ${responseText.length} characters`);
      
      // Notify connected clients about Stage 1 analysis completion (for real-time UI updates)
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
    
    // Update event with error status
    await storage.updateStage1AnalysisEventWebhookStatus(
      eventId, 
      'failed', 
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), 
      new Date()
    );
  }
}

async function sendDetailedAnalysisWebhook(eventId: number) {
  const webhookUrl = process.env.STAGE1_Detailed_Analysis_URL;
  if (!webhookUrl) {
    console.log(`[DETAILED_ANALYSIS_WEBHOOK] No webhook URL configured for event ${eventId}`);
    return;
  }

  try {
    // Get the stage 1 analysis event
    const event = await storage.getStage1AnalysisEvent(eventId);
    if (!event) {
      console.error(`[DETAILED_ANALYSIS_WEBHOOK] Event ${eventId} not found`);
      return;
    }

    const startTime = Date.now();
    
    // Prepare webhook payload - same as stage1 webhook
    const webhookPayload = {
      event_type: "stage1_analysis_complete",
      timestamp: new Date().toISOString(),
      id: event.targetCompanyId,
      triggered_by: event.triggeredBy,
      ...event.concatenatedData,
    };

    console.log(`[DETAILED_ANALYSIS_WEBHOOK] Sending webhook for event ${eventId}:`, JSON.stringify(webhookPayload, null, 2));

    // Send webhook with extended timeout (5 minutes for slow external service)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 minute timeout
    
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
      
      // Try to parse response as JSON
      try {
        const detailedData = JSON.parse(responseText);
        
        // Store the detailed analysis data
        await storage.updateStage1AnalysisEventDetailedData(eventId, detailedData);
        
        console.log(`[DETAILED_ANALYSIS_WEBHOOK] Stored detailed analysis data for event ${eventId}, length: ${responseText.length} characters`);
        
        // Notify connected clients about detailed analysis completion (for real-time UI updates)
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

// Function to enhance profit & loss data with calculated financial ratios
function enhanceProfitLossWithCalculations(analysisData: any): any {
  try {
    // Create a deep copy to avoid modifying the original
    const enhanced = JSON.parse(JSON.stringify(analysisData));
    
    // Check if we have years data with profit and loss information
    if (enhanced.years && typeof enhanced.years === 'object') {
      Object.keys(enhanced.years).forEach(year => {
        const yearData = enhanced.years[year];
        
        // Ensure profit_and_loss object exists
        if (!yearData.profit_and_loss) {
          yearData.profit_and_loss = {};
        }
        
        const pl = yearData.profit_and_loss;
        
        // Calculate Gross Margin % = (Gross Profit / Revenue) * 100
        if (pl.revenue && pl.gross_profit && pl.revenue > 0) {
          pl.gross_margin_percentage = Number(((pl.gross_profit / pl.revenue) * 100).toFixed(2));
        }
        
        // Calculate Net Margin % = (Net Profit / Revenue) * 100
        if (pl.revenue && pl.net_profit && pl.revenue > 0) {
          pl.net_margin_percentage = Number(((pl.net_profit / pl.revenue) * 100).toFixed(2));
        }
        
        // Calculate Interest Coverage Ratio = Operating Profit / Interest Payable
        if (pl.operating_profit && pl.interest_payable && pl.interest_payable > 0) {
          pl.interest_coverage_ratio = Number((pl.operating_profit / pl.interest_payable).toFixed(2));
        }
      });
    }
    
    // Also check for direct profit_and_loss data (without years structure)
    if (enhanced.profit_and_loss && typeof enhanced.profit_and_loss === 'object') {
      const pl = enhanced.profit_and_loss;
      
      // Calculate Gross Margin % = (Gross Profit / Revenue) * 100
      if (pl.revenue && pl.gross_profit && pl.revenue > 0) {
        pl.gross_margin_percentage = Number(((pl.gross_profit / pl.revenue) * 100).toFixed(2));
      }
      
      // Calculate Net Margin % = (Net Profit / Revenue) * 100
      if (pl.revenue && pl.net_profit && pl.revenue > 0) {
        pl.net_margin_percentage = Number(((pl.net_profit / pl.revenue) * 100).toFixed(2));
      }
      
      // Calculate Interest Coverage Ratio = Operating Profit / Interest Payable
      if (pl.operating_profit && pl.interest_payable && pl.interest_payable > 0) {
        pl.interest_coverage_ratio = Number((pl.operating_profit / pl.interest_payable).toFixed(2));
      }
    }
    
    console.log(`[PROFIT_LOSS_ENHANCEMENT] Added calculated ratios to profit & loss data`);
    return enhanced;
    
  } catch (error) {
    console.error(`[PROFIT_LOSS_ENHANCEMENT] Error enhancing profit & loss data:`, error);
    return analysisData; // Return original data if enhancement fails
  }
}

async function processFileUploadWebhookResponse(webhookResponse: any, eventId: number) {
  try {
    console.log(`[FILE_UPLOAD_WEBHOOK] Processing analysis response for event ${eventId}`);
    
    // Get the file upload event to get document details
    const event = await storage.getFileUploadEvent(eventId);
    if (!event) {
      console.error(`[FILE_UPLOAD_WEBHOOK] Event ${eventId} not found for processing`);
      return;
    }

    // Handle multiple document analysis types in a single response
    let analysisItems: Array<{documentType: string, analysisData: any}> = [];
    
    if (Array.isArray(webhookResponse)) {
      // Direct array response format - multiple document types
      for (const item of webhookResponse) {
        if (item.document === 'company_accounts' && item.data) {
          // Special case for company_accounts format
          analysisItems.push({
            documentType: item.data.document_type,
            analysisData: {
              document: 'company_accounts', // Preserve the company_accounts indicator
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
      // Nested response format (single document type)
      analysisItems.push({
        documentType: webhookResponse.data.document_type,
        analysisData: {
          ...webhookResponse.data.data,
          ...(webhookResponse.data.summary && { summary: webhookResponse.data.summary })
        }
      });
    } else if (webhookResponse.document_type && webhookResponse.data) {
      // Direct object response format (single document type)
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

    // Store each document analysis type as a separate result
    const results = [];
    for (const item of analysisItems) {
      // Add calculated financial ratios for profit & loss documents
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
      
      // Notify connected clients about analysis completion (for real-time UI updates)
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

    // After storing analysis results, check if all 5 required types are now complete
    await checkAndTriggerStage1Analysis(event.targetCompanyId, event.uploadedBy);

  } catch (error) {
    console.error(`[FILE_UPLOAD_WEBHOOK] Failed to process webhook response for event ${eventId}:`, error);
  }
}

// Extend session type
declare module 'express-session' {
  interface SessionData {
    userId?: number;
    userCompanyId?: number;
  }
}

// Session configuration
const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
const pgStore = connectPg(session);

export async function registerRoutes(app: Express): Promise<Server> {
  // Session middleware
  app.use(session({
    store: new pgStore({
      conString: process.env.DATABASE_URL,
      createTableIfMissing: true,
      ttl: sessionTtl / 1000,
    }),
    secret: process.env.SESSION_SECRET || 'your-session-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: sessionTtl,
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
    },
  }));

  // Auth middleware
  const isAuthenticated = async (req: Request, res: Response, next: any) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    next();
  };

  // Register modular routes (new architecture - v2 API endpoints)
  registerModularRoutes(app, isAuthenticated);


  // Register modular routes (new architecture - v2 API endpoints)
  registerModularRoutes(app, isAuthenticated);

  // LEGACY AUTH ENDPOINTS REMOVED - Now using /api/v2/auth/* endpoints
  // See server/routes/auth.routes.ts for new implementation

  // LEGACY DASHBOARD ENDPOINTS REMOVED - Now using /api/v2/dashboard/* endpoints
  // See server/routes/dashboard.routes.ts for new implementation

  // Create target company
  // LEGACY TARGET COMPANY CRUD ENDPOINTS REMOVED - Now using /api/v2/target-companies/* endpoints
  // See server/routes/target-companies.routes.ts for new implementation
  // Kept: /profile, /stage, /stage-history, /initial-discussion, /portal-tokens, stage1-analysis, triggers

  // Get comprehensive company profile with enhanced data
  app.get("/api/target-companies/:id/profile", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userCompanyId = req.session.userCompanyId;
      const targetCompanyId = parseInt(req.params.id);
      const userId = req.session.userId!;
      
      if (!userCompanyId) {
        return res.status(400).json({ message: "User company not found" });
      }

      if (isNaN(targetCompanyId)) {
        return res.status(400).json({ message: "Invalid target company ID" });
      }

      const profile = await storage.getCompanyProfile(targetCompanyId, userCompanyId, userId);
      
      if (!profile) {
        return res.status(404).json({ message: "Target company not found" });
      }

      // Log when website analysis is available
      if (profile.websiteAnalysis) {
        console.log(`Website analysis found for company ${targetCompanyId}:`, {
          analysisLength: profile.websiteAnalysis?.length,
          processedAt: profile.websiteAnalysisProcessedAt
        });
      }

      // Disable caching to ensure fresh data, especially for website analysis updates
      res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });

      res.json(profile);
    } catch (error) {
      console.error("Get company profile error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // PUT /api/target-companies/:id - REMOVED, now using /api/v2/target-companies/:id
  // DELETE /api/target-companies/:id - REMOVED, now using /api/v2/target-companies/:id

  // LEGACY CONTACT ENDPOINTS REMOVED - Now using /api/v2/contacts/* endpoints
  // See server/routes/contacts.routes.ts for new implementation


  // LEGACY TEAM MANAGEMENT ENDPOINTS REMOVED - Now using /api/v2/team/* endpoints
  // See server/routes/team.routes.ts for new implementation


  // LEGACY DEAL ASSIGNMENT ENDPOINTS REMOVED - Now using /api/v2/deals/* endpoints
  // See server/routes/assignments.routes.ts for new implementation

  // LEGACY NOTIFICATIONS ENDPOINTS REMOVED - Now using /api/v2/notifications/* endpoints
  // See server/routes/notifications.routes.ts for new implementation

  // Pipeline stage management routes
  // Get all pipeline stages
  app.get("/api/pipeline/stages", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const stages = await storage.getPipelineStages();
      res.json(stages);
    } catch (error) {
      console.error("Get pipeline stages error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Update company stage
  app.put("/api/target-companies/:id/stage", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId;
      const userCompanyId = req.session.userCompanyId;
      const companyId = parseInt(req.params.id);
      const { stage, notes = '' } = req.body;

      if (!userId || !userCompanyId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      if (isNaN(companyId)) {
        return res.status(400).json({ message: "Invalid company ID" });
      }

      if (!stage) {
        return res.status(400).json({ message: "Stage is required" });
      }

      // Verify user has access to this company
      const company = await storage.getTargetCompany(companyId, userCompanyId);
      if (!company) {
        return res.status(404).json({ message: "Company not found or access denied" });
      }

      const result = await storage.updateCompanyStage(companyId, stage, userId, notes);
      res.json(result);
    } catch (error) {
      console.error("Update company stage error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get stage history for a company
  app.get("/api/target-companies/:id/stage-history", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userCompanyId = req.session.userCompanyId;
      const companyId = parseInt(req.params.id);

      if (!userCompanyId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      if (isNaN(companyId)) {
        return res.status(400).json({ message: "Invalid company ID" });
      }

      // Verify user has access to this company
      const company = await storage.getTargetCompany(companyId, userCompanyId);
      if (!company) {
        return res.status(404).json({ message: "Company not found or access denied" });
      }

      const history = await storage.getStageHistory(companyId);
      res.json(history);
    } catch (error) {
      console.error("Get stage history error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Toggle initial discussion status for a company (simple checkbox)
  app.put("/api/target-companies/:id/initial-discussion", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId;
      const userCompanyId = req.session.userCompanyId;
      const companyId = parseInt(req.params.id);
      const { completed } = req.body;

      if (!userId || !userCompanyId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      if (isNaN(companyId)) {
        return res.status(400).json({ message: "Invalid company ID" });
      }

      // Verify user has access to this company
      const company = await storage.getTargetCompany(companyId, userCompanyId);
      if (!company) {
        return res.status(404).json({ message: "Company not found or access denied" });
      }

      const result = await storage.toggleInitialDiscussion(companyId, completed, userId);
      res.json({ success: true, message: "Initial discussion updated", data: result });
    } catch (error) {
      console.error("Update initial discussion error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // LEGACY NOTES ENDPOINTS REMOVED - Now using /api/v2/notes/* endpoints
  // See server/routes/notes.routes.ts for new implementation

  // Get pipeline overview
  app.get("/api/pipeline/overview", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userCompanyId = req.session.userCompanyId;

      if (!userCompanyId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const overview = await storage.getPipelineOverview(userCompanyId);
      res.json(overview);
    } catch (error) {
      console.error("Get pipeline overview error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // LEGACY ACTIVITY ENDPOINTS REMOVED - Now using /api/v2/activities/* endpoints
  // See server/routes/activities.routes.ts for new implementation

  // LEGACY REPORTS ENDPOINTS REMOVED - Now using /api/v2/reports/* endpoints
  // See server/routes/reports.routes.ts for new implementation

  // Configure multer for file uploads
  const uploadStorage = multer.diskStorage({
    destination: async (req, file, cb) => {
      const companyId = req.params.id;
      
      if (!companyId) {
        return cb(new Error('Company ID is required for file upload'), '');
      }
      
      const uploadPath = path.join(process.cwd(), 'uploads', 'companies', companyId);
      
      try {
        await fs.mkdir(uploadPath, { recursive: true });
        cb(null, uploadPath);
      } catch (error) {
        cb(error as Error, '');
      }
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const extension = path.extname(file.originalname);
      cb(null, `doc-${uniqueSuffix}${extension}`);
    }
  });

  const fileFilter = (req: any, file: any, cb: any) => {
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain',
      'image/jpeg',
      'image/png'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('File type not supported'), false);
    }
  };

  const upload = multer({
    storage: uploadStorage,
    fileFilter: fileFilter,
    limits: {
      fileSize: 10 * 1024 * 1024 // 10MB limit
    }
  });

  // Document Categories endpoint
  app.get("/api/document-categories", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const categories = await storage.getDocumentCategories();
      res.json(categories);
    } catch (error) {
      console.error("Get document categories error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get active portal tokens for a target company (for cache invalidation)
  app.get("/api/target-companies/:id/portal-tokens", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const targetCompanyId = parseInt(req.params.id);
      const userCompanyId = req.session.userCompanyId!;
      
      // Verify user has access to this target company
      const targetCompany = await storage.getTargetCompany(targetCompanyId, userCompanyId);
      if (!targetCompany) {
        return res.status(404).json({ message: "Target company not found" });
      }
      
      // Get active portal tokens for this target company
      const tokens = await storage.getActivePortalTokensForTargetCompany(targetCompanyId);
      
      res.json({ tokens: tokens.map(token => token.accessToken) });
    } catch (error) {
      console.error("Error getting portal tokens:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // LEGACY DOCUMENT ENDPOINTS REMOVED - Now using /api/v2/files/* and /api/v2/document-analysis/* endpoints
  // See server/routes/documents-files.routes.ts and server/routes/document-analysis.routes.ts for new implementation
  // Note: Some legacy endpoints kept for backwards compatibility (stage1-analysis, triggers, clear-all, etc.)

  // Get Stage 1 analysis events for a company
  app.get("/api/target-companies/:id/stage1-analysis", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const targetCompanyId = parseInt(req.params.id);
      const userCompanyId = req.session.userCompanyId!;

      // Verify access to company
      const company = await storage.getTargetCompany(targetCompanyId, userCompanyId);
      if (!company) {
        return res.status(404).json({ error: 'Company not found' });
      }

      // Get all Stage 1 analysis events for this company
      const events = await storage.getStage1AnalysisEventsByCompany(targetCompanyId, userCompanyId);
      
      res.json(events);
    } catch (error) {
      console.error('Error fetching Stage 1 analysis events:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Check Stage 1 webhook requirements status
  app.get("/api/target-companies/:id/stage1-status", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const targetCompanyId = parseInt(req.params.id);
      const userCompanyId = req.session.userCompanyId!;

      // Verify access to company
      const company = await storage.getTargetCompany(targetCompanyId, userCompanyId);
      if (!company) {
        return res.status(404).json({ error: 'Company not found' });
      }

      // Check Stage 1 requirements
      const categoryCheck = await checkStage1RequirementsByCategory(targetCompanyId);
      
      // Check for existing successful Stage 1 analysis
      const existingEvent = await storage.getLatestStage1AnalysisEvent(targetCompanyId);
      
      res.json({
        shouldTrigger: categoryCheck.shouldTrigger,
        status: categoryCheck.status,
        hasExistingAnalysis: existingEvent?.webhookStatus === 'success',
        existingEventId: existingEvent?.id || null,
        lastAnalysisDate: existingEvent?.createdAt || null
      });
    } catch (error) {
      console.error('Error checking Stage 1 status:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Note: Debug endpoints moved to /api/v2/debug/* - see server/routes/debug.routes.ts

  // Original authenticated trigger
  app.post("/api/target-companies/:id/trigger-stage1", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const targetCompanyId = parseInt(req.params.id);
      const userCompanyId = req.session.userCompanyId!;
      const userId = req.session.userId!;

      // Verify access to company
      const company = await storage.getTargetCompany(targetCompanyId, userCompanyId);
      if (!company) {
        return res.status(404).json({ error: 'Company not found' });
      }

      // Manually trigger Stage 1 analysis check with bypass
      console.log(`[MANUAL_TRIGGER] Checking Stage 1 analysis for company ${targetCompanyId} (bypassing requirements)`);
      await checkAndTriggerStage1Analysis(targetCompanyId, userId, true);
      
      res.json({ success: true, message: 'Stage 1 analysis triggered with available documents (bypassed requirements)' });
    } catch (error) {
      console.error('Error triggering Stage 1 analysis:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Trigger detailed analysis for a target company
  app.post("/api/target-companies/:id/trigger-detailed-analysis", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const targetCompanyId = parseInt(req.params.id);
      const userCompanyId = req.session.userCompanyId!;
      const userId = req.session.userId!;

      // Verify access to company
      const company = await storage.getTargetCompany(targetCompanyId, userCompanyId);
      if (!company) {
        return res.status(404).json({ error: 'Company not found' });
      }

      // Get the latest stage 1 analysis event to update with detailed analysis
      const latestEvent = await storage.getLatestStage1AnalysisEvent(targetCompanyId);
      if (!latestEvent) {
        return res.status(400).json({ error: 'No basic analysis found. Please complete basic analysis first.' });
      }

      if (latestEvent.webhookStatus !== 'success') {
        return res.status(400).json({ error: 'Basic analysis is not complete. Please wait for it to finish.' });
      }

      // Check if detailed analysis is already in progress
      if (latestEvent.detailedAnalysisStatus === 'processing') {
        return res.status(400).json({ error: 'Detailed analysis is already in progress.' });
      }

      // Mark as processing
      await storage.updateDetailedAnalysisStatus(latestEvent.id, 'processing', undefined, undefined, undefined, userId);

      console.log(`[DETAILED_ANALYSIS] Triggering detailed analysis for company ${targetCompanyId}, event ${latestEvent.id}`);
      
      // Run detailed analysis in background
      setTimeout(() => {
        runGeminiDetailedAnalysis(latestEvent.id, targetCompanyId);
      }, 100);
      
      res.json({ 
        success: true, 
        message: 'Detailed analysis started',
        eventId: latestEvent.id
      });
    } catch (error) {
      console.error('Error triggering detailed analysis:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // DELETE /api/documents/:id - REMOVED, now using /api/v2/files/:id

  // Clear all company documents (admin function)
  app.delete("/api/documents/clear-all", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userCompanyId = req.session.userCompanyId!;
      const userId = req.session.userId!;
      
      console.log(`[API] Clearing all documents for user company ${userCompanyId}, requested by user ${userId}`);
      
      const result = await storage.clearAllCompanyDocuments(userCompanyId);
      
      console.log(`[API] Document clearing completed:`, result);
      
      res.json({
        success: true,
        message: 'All company documents have been cleared successfully',
        details: result
      });
    } catch (error) {
      console.error("Clear all documents error:", error);
      res.status(500).json({ 
        message: "Internal server error",
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });


  // ========================================
  // LEGACY PORTAL ENDPOINTS REMOVED
  // ========================================
  // Portal functionality now uses /api/v2/portal/* and /api/v2/portal-submit/* endpoints
  // See server/routes/portal.routes.ts, portal-submissions.routes.ts, and portal-requirements.routes.ts

  // ========================================
  // COMPANY ACCOUNT MANAGEMENT SYSTEM
  // ========================================

  // Get all companies for current user
  app.get("/api/user/companies", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      
      // Get user's current companies
      const companies = await storage.getUserCompanies(userId);
      
      // Get full company details
      const companiesWithDetails = await Promise.all(
        companies.map(async (membership) => {
          const company = await storage.getUserCompany(membership.userCompanyId);
          return {
            id: membership.id,
            companyId: membership.userCompanyId,
            companyName: company?.companyName || 'Unknown Company',
            email: company?.email,
            phone: company?.phone,
            address: company?.address,
            isAdmin: membership.isCompanyAdmin,
            role: membership.membershipRole,
            joinedAt: membership.joinedAt,
            isActive: membership.isActive,
            isCurrent: membership.userCompanyId === req.session.userCompanyId
          };
        })
      );
      
      res.json(companiesWithDetails);
    } catch (error) {
      console.error("Failed to get user companies:", error);
      res.status(500).json({ error: "Failed to get user companies" });
    }
  });

  // Create new company account
  app.post("/api/user/companies", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const { companyName, email, phone, address } = req.body;
      
      // Check if user already has 5 companies (max limit)
      const existingCompanies = await storage.getUserCompanies(userId);
      if (existingCompanies.length >= 5) {
        return res.status(400).json({ error: "Maximum of 5 companies allowed per user" });
      }
      
      // Create new company
      const newCompany = await storage.createUserCompany({
        companyName,
        email: email || null,
        phone: phone || null,
        address: address || null
      });
      
      // Create membership for user as admin
      const membership = await storage.createUserCompanyMembership({
        userId,
        userCompanyId: newCompany.id,
        isCompanyAdmin: true,
        membershipRole: 'admin',
        isActive: true
      });
      
      // If this is the user's first company, set it as current
      if (existingCompanies.length === 0) {
        await storage.switchUserActiveCompany(userId, newCompany.id);
      }
      
      res.json({
        id: membership.id,
        companyId: newCompany.id,
        companyName: newCompany.companyName,
        email: newCompany.email,
        phone: newCompany.phone,
        address: newCompany.address,
        isAdmin: true,
        role: 'admin',
        joinedAt: membership.joinedAt,
        isActive: true,
        isCurrent: existingCompanies.length === 0
      });
    } catch (error) {
      console.error("Failed to create company:", error);
      res.status(500).json({ error: "Failed to create company" });
    }
  });

  // Switch active company
  app.post("/api/user/companies/:companyId/switch", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const companyId = parseInt(req.params.companyId);
      
      // Verify user has access to this company
      const companies = await storage.getUserCompanies(userId);
      const hasAccess = companies.some(c => c.userCompanyId === companyId && c.isActive);
      
      if (!hasAccess) {
        return res.status(403).json({ error: "Access denied to this company" });
      }
      
      // Switch active company
      await storage.switchUserActiveCompany(userId, companyId);
      
      // Update session
      req.session.userCompanyId = companyId;
      
      res.json({ success: true, currentCompanyId: companyId });
    } catch (error) {
      console.error("Failed to switch company:", error);
      res.status(500).json({ error: "Failed to switch company" });
    }
  });

  // Test endpoint to manually trigger Stage 1 webhook
  app.post("/api/test/stage1-webhook/:eventId", async (req: Request, res: Response) => {
    try {
      const eventId = parseInt(req.params.eventId);
      
      if (isNaN(eventId)) {
        return res.status(400).json({ message: "Invalid event ID" });
      }

      console.log(`[TEST] Manually triggering Stage 1 webhook for event ${eventId}`);
      
      // Trigger webhook asynchronously
      setTimeout(() => {
        sendStage1AnalysisWebhook(eventId);
      }, 100);

      res.json({ 
        success: true, 
        message: `Stage 1 webhook triggered for event ${eventId}` 
      });
    } catch (error) {
      console.error("Manual webhook trigger error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Test endpoint to manually trigger ONLY Detailed Analysis webhook
  app.post("/api/test/detailed-analysis-webhook/:eventId", async (req: Request, res: Response) => {
    try {
      const eventId = parseInt(req.params.eventId);
      
      if (isNaN(eventId)) {
        return res.status(400).json({ message: "Invalid event ID" });
      }

      console.log(`[TEST] Manually triggering Detailed Analysis webhook ONLY for event ${eventId}`);
      
      // Trigger detailed analysis webhook asynchronously
      setTimeout(() => {
        sendDetailedAnalysisWebhook(eventId);
      }, 100);

      res.json({ 
        success: true, 
        message: `Detailed Analysis webhook triggered for event ${eventId}`
      });
    } catch (error) {
      console.error("Failed to trigger Detailed Analysis webhook:", error);
      res.status(500).json({ error: "Failed to trigger webhook" });
    }
  });

  app.post("/api/test/fresh-stage1-analysis/:companyId", async (req: Request, res: Response) => {
    try {
      const companyId = parseInt(req.params.companyId);
      
      if (isNaN(companyId)) {
        return res.status(400).json({ message: "Invalid company ID" });
      }

      console.log(`[TEST] Manually triggering fresh Stage 1 analysis for company ${companyId}`);
      
      // Trigger fresh analysis asynchronously
      setTimeout(() => {
        checkAndTriggerStage1Analysis(companyId, 1); // Use user ID 1 for test
      }, 100);

      res.json({ 
        success: true, 
        message: `Fresh Stage 1 analysis triggered for company ${companyId}` 
      });
    } catch (error) {
      console.error("Manual fresh analysis trigger error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Test endpoint to inject detailed analysis JSON directly
  app.post("/api/test/inject-detailed-analysis/:eventId", async (req: Request, res: Response) => {
    try {
      const eventId = parseInt(req.params.eventId);
      const detailedData = req.body;
      
      if (isNaN(eventId)) {
        return res.status(400).json({ message: "Invalid event ID" });
      }

      if (!detailedData) {
        return res.status(400).json({ message: "No data provided" });
      }

      console.log(`[TEST] Injecting detailed analysis data for event ${eventId}`);
      
      // Store the detailed analysis data
      await storage.updateStage1AnalysisEventDetailedData(eventId, detailedData);
      
      console.log(`[TEST] Successfully stored detailed analysis data for event ${eventId}`);
      
      res.json({ 
        success: true, 
        message: `Detailed analysis data injected for event ${eventId}` 
      });
    } catch (error) {
      console.error("Failed to inject detailed analysis data:", error);
      res.status(500).json({ message: "Internal server error", error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
