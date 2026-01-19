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

// In-memory webhook logs for testing
const webhookLogs: Array<{
  id: number;
  timestamp: string;
  targetCompanyId: number | null;
  webhookUrl: string;
  payload: any;
  response: any;
  status: string;
  processingTime: number;
}> = [];

let logCounter = 1;

// Webhook function to send company website data
async function sendWebhook(website: string, targetCompanyId: number, webhookUrl?: string) {
  const webhookUrlToUse = webhookUrl || process.env.WEBHOOK_URL;
  if (!webhookUrlToUse || !website) {
    return;
  }

  const startTime = Date.now();
  
  try {
    // Construct proper webhook URL using Replit domain
    const baseUrl = process.env.APP_URL || 
                   (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : 'http://localhost:3000');
    
    const payload = {
      company_name: website,
      target_company_id: targetCompanyId,
      webhook_response_url: `${baseUrl}/api/webhook/website-analysis`
    };

    // Create webhook log entry (matching the test tool's approach)
    const log = {
      id: logCounter++,
      timestamp: new Date().toISOString(),
      targetCompanyId: targetCompanyId,
      webhookUrl: webhookUrlToUse,
      payload: payload,
      response: null,
      status: "pending",
      processingTime: 0,
    };
    webhookLogs.push(log);

    console.log(`Sending webhook with response URL: ${payload.webhook_response_url} for target company ${targetCompanyId}`);
    console.log(`Full webhook payload:`, JSON.stringify(payload, null, 2));
    
    const response = await fetch(webhookUrlToUse, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    // Update log with response status
    log.status = response.ok ? "sent" : "error";
    log.processingTime = Date.now() - startTime;
    
    if (!response.ok) {
      (log as any).response = {
        error: `HTTP ${response.status}: ${response.statusText}`,
        status: response.status
      };
    } else {
      (log as any).response = {
        success: true,
        status: response.status,
        message: `Webhook sent successfully`
      };
      
      // Check if webhook returned analysis directly
      try {
        const responseData = await response.text();
        if (responseData) {
          const parsedResponse = JSON.parse(responseData);
          if (parsedResponse.output && parsedResponse.target_company_id) {
            console.log(`📥 Production webhook returned analysis directly for company ${parsedResponse.target_company_id}`);
            
            // Process the analysis like webhook callback would
            let processedOutput = parsedResponse.output.replace(/\\n/g, '\n');
            processedOutput = processedOutput
              .split('\n')
              .map((line: string) => {
                if (line.match(/^\d+\s+/)) {
                  return line.replace(/^(\d+)\s+(.+)/, '## $1. $2');
                }
                return line;
              })
              .join('\n\n');
            
            // Update target company with website analysis
            const updated = await storage.updateTargetCompanyWebsiteAnalysis(
              parsedResponse.target_company_id,
              processedOutput
            );
            
            if (updated) {
              console.log(`✅ Production website analysis stored directly for target company ID: ${parsedResponse.target_company_id}`);
              log.status = "completed";
              (log as any).response = {
                success: true,
                status: response.status,
                message: "Website analysis received and stored",
                outputLength: processedOutput.length
              };
            }
          }
        }
      } catch (parseError) {
        console.log("Production webhook response is not JSON or doesn't contain analysis data");
      }
    }

    console.log(`Webhook sent for website: ${website}, Target ID: ${targetCompanyId}, Status: ${response.status} (${log.processingTime}ms)`);
  } catch (error) {
    // Update log with error
    const log = webhookLogs.find(l => l.targetCompanyId === targetCompanyId && l.status === "pending");
    if (log) {
      log.status = "error";
      log.response = { error: error instanceof Error ? error.message : 'Unknown error' };
      log.processingTime = Date.now() - startTime;
    }
    console.error('Failed to send webhook:', error);
  }
}

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
async function sendFileUploadWebhook(eventId: number) {
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

  // Registration schema with password confirmation
  const registerSchema = insertUserSchema.extend({
    companyName: z.string().min(1, "Company name is required"),
    confirmPassword: z.string(),
  }).refine((data) => data.passwordHash === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

  // Login schema
  const loginSchema = z.object({
    email: z.string().email("Invalid email format"),
    password: z.string().min(1, "Password is required"),
  });

  // Registration endpoint
  app.post("/api/auth/register", async (req: Request, res: Response) => {
    try {
      const validatedData = registerSchema.parse(req.body);
      
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(validatedData.email);
      if (existingUser) {
        return res.status(400).json({ message: "User already exists with this email" });
      }

      // Hash password
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(validatedData.passwordHash, saltRounds);

      // Create user company first
      const userCompany = await storage.createUserCompany({
        companyName: validatedData.companyName,
      });

      // Create user
      const user = await storage.createUser({
        email: validatedData.email,
        passwordHash: hashedPassword,
        firstName: validatedData.firstName,
        lastName: validatedData.lastName,
        userCompanyId: userCompany.id,
        role: "user",
      });

      // Create session
      req.session.userId = user.id;
      req.session.userCompanyId = userCompany.id;

      res.status(201).json({
        message: "User created successfully",
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          company: userCompany,
        },
      });
    } catch (error) {
      console.error("Registration error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: error.errors 
        });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Login endpoint
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const { email, password } = loginSchema.parse(req.body);

      // Get user by email
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.passwordHash);
      if (!isValidPassword) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Get user company
      const userCompany = user.userCompanyId 
        ? await storage.getUserCompany(user.userCompanyId)
        : null;

      // Create session
      req.session.userId = user.id;
      req.session.userCompanyId = user.userCompanyId || undefined;

      res.json({
        message: "Login successful",
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          company: userCompany,
        },
      });
    } catch (error) {
      console.error("Login error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: error.errors 
        });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Logout endpoint
  app.post("/api/auth/logout", (req: Request, res: Response) => {
    req.session.destroy((err) => {
      if (err) {
        console.error("Logout error:", err);
        return res.status(500).json({ message: "Could not log out" });
      }
      res.json({ message: "Logged out successfully" });
    });
  });

  // Get current user
  app.get("/api/auth/me", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const userCompany = user.userCompanyId 
        ? await storage.getUserCompany(user.userCompanyId)
        : null;

      res.json({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        company: userCompany,
      });
    } catch (error) {
      console.error("Get user error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Dashboard stats endpoint
  app.get("/api/dashboard/stats", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userCompanyId = req.session.userCompanyId;
      
      if (!userCompanyId) {
        return res.status(400).json({ message: "User company not found" });
      }

      const targetCompanyCount = await storage.getTargetCompanyCount(userCompanyId);
      const totalContactsCount = await storage.getTotalContactsCount(userCompanyId);
      const dashboardMetrics = await storage.getDashboardMetrics(userCompanyId);

      res.json({
        targetCompanies: targetCompanyCount,
        activeDeals: dashboardMetrics.activeDeals,
        totalContacts: totalContactsCount,
        dealValue: dashboardMetrics.totalDealValue,
      });
    } catch (error) {
      console.error("Dashboard stats error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Enhanced Dashboard Widget API Endpoints
  app.get("/api/dashboard/data/:widget", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userCompanyId = req.session.userCompanyId;
      const widgetType = req.params.widget;
      
      if (!userCompanyId) {
        return res.status(400).json({ message: "User company not found" });
      }

      let data;
      switch (widgetType) {
        case 'pipeline-overview':
          data = await storage.getPipelineOverviewWidget(userCompanyId);
          break;
        case 'recent-activities':
          data = await storage.getRecentActivitiesWidget(userCompanyId);
          break;
        case 'hot-deals':
          data = await storage.getHotDealsWidget(userCompanyId);
          break;
        case 'quick-stats':
          data = await storage.getQuickStatsWidget(userCompanyId);
          break;
        case 'upcoming-reminders':
          data = await storage.getUpcomingRemindersWidget(req.session.userId!);
          break;
        case 'team-activity':
          data = await storage.getTeamActivityWidget(userCompanyId);
          break;
        case 'stage-alerts':
          data = await storage.getStageAlertsWidget(userCompanyId);
          break;
        default:
          return res.status(400).json({ message: "Invalid widget type" });
      }

      res.json(data);
    } catch (error) {
      console.error(`Dashboard widget ${req.params.widget} error:`, error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Dashboard preferences endpoints
  app.get("/api/dashboard/widgets", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const preferences = await storage.getDashboardPreferences(userId);
      res.json(preferences);
    } catch (error) {
      console.error("Get dashboard preferences error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.put("/api/dashboard/widgets", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const preferences = req.body;
      await storage.updateDashboardPreferences(userId, preferences);
      res.json({ message: "Dashboard preferences updated" });
    } catch (error) {
      console.error("Update dashboard preferences error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Dashboard alerts endpoints
  app.get("/api/dashboard/alerts", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userCompanyId = req.session.userCompanyId;
      
      if (!userCompanyId) {
        return res.status(400).json({ message: "User company not found" });
      }

      const alerts = await storage.getDashboardAlerts(userCompanyId);
      res.json(alerts);
    } catch (error) {
      console.error("Get dashboard alerts error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.put("/api/dashboard/alerts/:id/dismiss", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userCompanyId = req.session.userCompanyId;
      const alertId = parseInt(req.params.id);
      
      if (!userCompanyId) {
        return res.status(400).json({ message: "User company not found" });
      }

      const success = await storage.dismissAlert(alertId, userCompanyId);
      if (success) {
        res.json({ message: "Alert dismissed" });
      } else {
        res.status(404).json({ message: "Alert not found" });
      }
    } catch (error) {
      console.error("Dismiss alert error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Create target company
  app.post("/api/target-companies", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const userCompanyId = req.session.userCompanyId;
      
      if (!userCompanyId) {
        return res.status(400).json({ message: "User company not found" });
      }

      // Create a validation schema that excludes userCompanyId and createdBy since we add them from session
      const frontendTargetCompanySchema = insertTargetCompanySchema.omit({
        userCompanyId: true,
        createdBy: true,
        stageUpdatedBy: true,
        stageUpdatedAt: true,
      });
      
      const validatedData = frontendTargetCompanySchema.parse(req.body);

      // Convert empty strings to null and handle number conversion
      const processedData = {
        companyName: validatedData.companyName,
        industry: validatedData.industry || null,
        website: validatedData.website || null,
        phone: validatedData.phone || null,
        email: validatedData.email || null,
        address: validatedData.address || null,
        annualRevenue: validatedData.annualRevenue || null,
        employeeCount: typeof validatedData.employeeCount === 'string' && validatedData.employeeCount.trim()
          ? parseInt(validatedData.employeeCount) || null
          : validatedData.employeeCount || null,
        yearEstablished: typeof validatedData.yearEstablished === 'string' && validatedData.yearEstablished.trim()
          ? parseInt(validatedData.yearEstablished) || null
          : validatedData.yearEstablished || null,
        description: validatedData.description || null,
        stage: validatedData.stage || null,
        userCompanyId,
        createdBy: userId,
      };

      const targetCompany = await storage.createTargetCompany(processedData as any);

      // Send webhook if website is provided
      if (validatedData.website && validatedData.website.trim()) {
        console.log(`Webhook initiated for new target company ${targetCompany.id} with website: ${validatedData.website}`);
        
        // Send webhook (it will handle its own logging now)
        sendWebhook(validatedData.website, targetCompany.id);
      }

      res.status(201).json(targetCompany);
    } catch (error) {
      console.error("Create target company error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: error.errors 
        });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get all target companies for user's company
  app.get("/api/target-companies", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userCompanyId = req.session.userCompanyId;
      
      if (!userCompanyId) {
        return res.status(400).json({ message: "User company not found" });
      }

      const targetCompanies = await storage.getTargetCompaniesByUserCompany(userCompanyId);
      res.json(targetCompanies);
    } catch (error) {
      console.error("Get target companies error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Search target companies with filters
  app.get("/api/target-companies/search", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userCompanyId = req.session.userCompanyId;
      
      if (!userCompanyId) {
        return res.status(400).json({ message: "User company not found" });
      }

      const searchParams = {
        q: req.query.q as string,
        industry: req.query.industry as string,
        minRevenue: req.query.minRevenue ? Number(req.query.minRevenue) : undefined,
        maxRevenue: req.query.maxRevenue ? Number(req.query.maxRevenue) : undefined,
        minEmployees: req.query.minEmployees ? Number(req.query.minEmployees) : undefined,
        maxEmployees: req.query.maxEmployees ? Number(req.query.maxEmployees) : undefined,
        minYear: req.query.minYear ? Number(req.query.minYear) : undefined,
        maxYear: req.query.maxYear ? Number(req.query.maxYear) : undefined,
        sort: req.query.sort as string,
      };

      const targetCompanies = await storage.searchTargetCompanies(userCompanyId, searchParams);
      res.json(targetCompanies);
    } catch (error) {
      console.error("Search target companies error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get filter options
  app.get("/api/target-companies/filters", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userCompanyId = req.session.userCompanyId;
      
      if (!userCompanyId) {
        return res.status(400).json({ message: "User company not found" });
      }

      const filterOptions = await storage.getFilterOptions(userCompanyId);
      res.json(filterOptions);
    } catch (error) {
      console.error("Get filter options error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get specific target company
  app.get("/api/target-companies/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userCompanyId = req.session.userCompanyId;
      const targetCompanyId = parseInt(req.params.id);
      
      if (!userCompanyId) {
        return res.status(400).json({ message: "User company not found" });
      }

      if (isNaN(targetCompanyId)) {
        return res.status(400).json({ message: "Invalid target company ID" });
      }

      const targetCompany = await storage.getTargetCompany(targetCompanyId, userCompanyId);
      
      if (!targetCompany) {
        return res.status(404).json({ message: "Target company not found" });
      }

      res.json(targetCompany);
    } catch (error) {
      console.error("Get target company error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

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

  // Update target company
  app.put("/api/target-companies/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userCompanyId = req.session.userCompanyId;
      const targetCompanyId = parseInt(req.params.id);
      
      if (!userCompanyId) {
        return res.status(400).json({ message: "User company not found" });
      }

      if (isNaN(targetCompanyId)) {
        return res.status(400).json({ message: "Invalid target company ID" });
      }

      const validatedData = insertTargetCompanySchema.partial().parse(req.body);

      const updatedCompany = await storage.updateTargetCompany(
        targetCompanyId, 
        validatedData, 
        userCompanyId
      );
      
      if (!updatedCompany) {
        return res.status(404).json({ message: "Target company not found" });
      }

      res.json(updatedCompany);
    } catch (error) {
      console.error("Update target company error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: error.errors 
        });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Delete target company
  app.delete("/api/target-companies/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userCompanyId = req.session.userCompanyId;
      const targetCompanyId = parseInt(req.params.id);
      
      if (!userCompanyId) {
        return res.status(400).json({ message: "User company not found" });
      }

      if (isNaN(targetCompanyId)) {
        return res.status(400).json({ message: "Invalid target company ID" });
      }

      const deleted = await storage.deleteTargetCompany(targetCompanyId, userCompanyId);
      
      if (!deleted) {
        return res.status(404).json({ message: "Target company not found" });
      }

      res.json({ message: "Target company deleted successfully" });
    } catch (error) {
      console.error("Delete target company error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Contact Management Routes
  const targetContactCreateSchema = insertTargetContactSchema.omit({
    targetCompanyId: true,
  });

  // Get contacts for target company
  app.get("/api/target-companies/:id/contacts", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userCompanyId = req.session.userCompanyId;
      const targetCompanyId = parseInt(req.params.id);
      
      if (!userCompanyId) {
        return res.status(400).json({ message: "User company not found" });
      }

      if (isNaN(targetCompanyId)) {
        return res.status(400).json({ message: "Invalid target company ID" });
      }

      const contacts = await storage.getContactsForTargetCompany(targetCompanyId, userCompanyId);
      res.json(contacts);
    } catch (error) {
      console.error("Get contacts error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Create contact for target company
  app.post("/api/target-companies/:id/contacts", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userCompanyId = req.session.userCompanyId;
      const targetCompanyId = parseInt(req.params.id);
      
      if (!userCompanyId) {
        return res.status(400).json({ message: "User company not found" });
      }

      if (isNaN(targetCompanyId)) {
        return res.status(400).json({ message: "Invalid target company ID" });
      }

      // Verify target company exists and belongs to user
      const targetCompany = await storage.getTargetCompany(targetCompanyId, userCompanyId);
      if (!targetCompany) {
        return res.status(404).json({ message: "Target company not found" });
      }

      const validatedData = targetContactCreateSchema.parse(req.body);

      const contact = await storage.createTargetContact({
        ...validatedData,
        targetCompanyId,
      });

      res.status(201).json(contact);
    } catch (error) {
      console.error("Create contact error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: error.errors 
        });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Update contact
  app.put("/api/contacts/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userCompanyId = req.session.userCompanyId;
      const contactId = parseInt(req.params.id);
      
      if (!userCompanyId) {
        return res.status(400).json({ message: "User company not found" });
      }

      if (isNaN(contactId)) {
        return res.status(400).json({ message: "Invalid contact ID" });
      }

      const validatedData = targetContactCreateSchema.partial().parse(req.body);

      const updatedContact = await storage.updateTargetContact(contactId, validatedData, userCompanyId);
      
      if (!updatedContact) {
        return res.status(404).json({ message: "Contact not found" });
      }

      res.json(updatedContact);
    } catch (error) {
      console.error("Update contact error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: error.errors 
        });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Delete contact
  app.delete("/api/contacts/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userCompanyId = req.session.userCompanyId;
      const contactId = parseInt(req.params.id);
      
      if (!userCompanyId) {
        return res.status(400).json({ message: "User company not found" });
      }

      if (isNaN(contactId)) {
        return res.status(400).json({ message: "Invalid contact ID" });
      }

      const deleted = await storage.deleteTargetContact(contactId, userCompanyId);
      
      if (!deleted) {
        return res.status(404).json({ message: "Contact not found" });
      }

      res.json({ message: "Contact deleted successfully" });
    } catch (error) {
      console.error("Delete contact error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get all contacts across all target companies for the user
  app.get("/api/contacts/all", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userCompanyId = req.session.userCompanyId;
      
      if (!userCompanyId) {
        return res.status(400).json({ message: "User company not found" });
      }

      const allContacts = await storage.getAllContactsForUserCompany(userCompanyId);
      res.json(allContacts);
    } catch (error) {
      console.error("Get all contacts error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ========================
  // Team Management Routes
  // ========================

  // Send invitation to new team member
  app.post("/api/team/invite", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId;
      const userCompanyId = req.session.userCompanyId;

      if (!userId || !userCompanyId) {
        return res.status(400).json({ message: "User not authenticated" });
      }

      // Check if user has permission to invite
      const userWithPermissions = await storage.getUserWithPermissions(userId);
      if (!userWithPermissions?.permissions?.canManageUsers && !userWithPermissions?.isCompanyAdmin) {
        return res.status(403).json({ message: "Insufficient permissions to invite users" });
      }

      const inviteSchema = z.object({
        email: z.string().email("Invalid email address"),
        role: z.string().min(1, "Role is required"),
        message: z.string().optional(),
      });

      const { email, role, message } = inviteSchema.parse(req.body);

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser && existingUser.userCompanyId === userCompanyId) {
        return res.status(400).json({ message: "User already exists in your company" });
      }

      // Check if invitation already exists
      const existingInvitations = await storage.getInvitationsByUserCompany(userCompanyId);
      const existingInvitation = existingInvitations.find(inv => 
        inv.email === email && inv.invitationStatus === 'pending'
      );
      
      if (existingInvitation) {
        return res.status(400).json({ message: "Invitation already sent to this email address" });
      }

      // Generate secure invitation token
      const invitationToken = randomUUID();

      const invitation = await storage.createUserInvitation({
        userCompanyId,
        email: email.toLowerCase(),
        invitedBy: userId,
        invitationToken,
        invitedRole: role,
        invitationMessage: message || "",
        invitationStatus: "pending",
        ipAddressSent: req.ip,
      });

      // Create notification for team activity
      await storage.createNotification({
        userCompanyId,
        targetUserId: userId, // Notify the inviter
        fromUserId: userId,
        notificationType: "team_invitation_sent",
        notificationTitle: "Team Invitation Sent",
        notificationMessage: `Invitation sent to ${email} as ${role}`,
        isRead: false,
      });

      // Send invitation email
      const inviteUrl = `${req.protocol}://${req.get('host')}/invite/${invitation.invitationToken}`;
      const inviterUser = await storage.getUser(userId);
      const userCompany = await storage.getUserCompany(userCompanyId);
      
      if (inviterUser && userCompany) {
        const inviterName = `${inviterUser.firstName || ''} ${inviterUser.lastName || ''}`.trim() || inviterUser.email;
        const emailSent = await emailService.sendTeamInvitation(
          email,
          inviterName,
          userCompany.companyName,
          invitation.invitationToken,
          inviteUrl,
          role
        );
        
        if (!emailSent) {
          console.warn(`Failed to send invitation email to ${email}`);
        }
      }

      res.json({ 
        message: "Invitation sent successfully", 
        invitation: { 
          id: invitation.id,
          email: invitation.email,
          role: invitation.invitedRole,
          status: invitation.invitationStatus,
          sentAt: invitation.sentAt,
          inviteUrl
        }
      });
    } catch (error) {
      console.error("Send invitation error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get invitation details by token (public endpoint for invitation acceptance)
  app.get("/api/team/invitation/:token", async (req: Request, res: Response) => {
    try {
      const { token } = req.params;
      
      if (!token) {
        return res.status(400).json({ message: "Token is required" });
      }
      
      const invitation = await storage.getUserInvitationByToken(token);
      
      if (!invitation) {
        return res.status(404).json({ message: "Invitation not found or expired" });
      }
      
      res.json({
        email: invitation.email,
        invitedRole: invitation.invitedRole,
        companyName: invitation.companyName,
        inviterName: invitation.inviterName,
        invitationMessage: invitation.invitationMessage,
        invitationStatus: invitation.invitationStatus,
      });
    } catch (error) {
      console.error("Get invitation details error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Accept invitation endpoint (public)
  app.post("/api/team/invitation/:token/accept", async (req: Request, res: Response) => {
    try {
      const { token } = req.params;
      const acceptSchema = z.object({
        firstName: z.string().min(1, "First name is required"),
        lastName: z.string().min(1, "Last name is required"),
        password: z.string().min(8, "Password must be at least 8 characters"),
      });
      
      const { firstName, lastName, password } = acceptSchema.parse(req.body);
      
      // Get invitation details first
      const invitation = await storage.getUserInvitationByToken(token);
      if (!invitation || invitation.invitationStatus !== 'pending') {
        return res.status(400).json({ message: "Invalid or expired invitation" });
      }
      
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(invitation.email);
      
      let user: any;
      
      if (existingUser) {
        // User exists - this means they were invited to a different company
        // For security, we should not allow cross-company invitations without proper validation
        return res.status(400).json({ 
          message: "An account with this email already exists. Please contact your administrator or use a different email address." 
        });
      } else {
        // Create new user
        user = await storage.acceptInvitation(token, {
          firstName,
          lastName,
          passwordHash: await bcrypt.hash(password, 10),
          isActive: true,
          emailVerified: true,
        });
      }
      
      if (!user) {
        return res.status(400).json({ message: "Failed to accept invitation" });
      }
      
      res.json({ 
        message: "Invitation accepted successfully",
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
        }
      });
    } catch (error) {
      console.error("Accept invitation error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get pending invitations (admin only)
  app.get("/api/team/invitations", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId;
      const userCompanyId = req.session.userCompanyId;

      if (!userId || !userCompanyId) {
        return res.status(400).json({ message: "User not authenticated" });
      }

      // Check if user has permission
      const userWithPermissions = await storage.getUserWithPermissions(userId);
      if (!userWithPermissions?.permissions?.canManageUsers && !userWithPermissions?.isCompanyAdmin) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const invitations = await storage.getInvitationsByUserCompany(userCompanyId);
      res.json(invitations);
    } catch (error) {
      console.error("Get invitations error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Update invitation (cancel, resend)
  app.put("/api/team/invitations/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId;
      const userCompanyId = req.session.userCompanyId;
      const invitationId = parseInt(req.params.id);

      if (!userId || !userCompanyId) {
        return res.status(400).json({ message: "User not authenticated" });
      }

      if (isNaN(invitationId)) {
        return res.status(400).json({ message: "Invalid invitation ID" });
      }

      // Check if user has permission
      const userWithPermissions = await storage.getUserWithPermissions(userId);
      if (!userWithPermissions?.permissions?.canManageUsers && !userWithPermissions?.isCompanyAdmin) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const updateSchema = z.object({
        status: z.enum(["cancelled", "pending"]),
      });

      const { status } = updateSchema.parse(req.body);

      const updatedInvitation = await storage.updateUserInvitation(invitationId, {
        invitationStatus: status,
      });

      if (!updatedInvitation) {
        return res.status(404).json({ message: "Invitation not found" });
      }

      res.json(updatedInvitation);
    } catch (error) {
      console.error("Update invitation error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Accept invitation via token
  app.post("/api/team/accept-invitation", async (req: Request, res: Response) => {
    try {
      const acceptSchema = z.object({
        token: z.string().min(1, "Token is required"),
        firstName: z.string().min(1, "First name is required"),
        lastName: z.string().min(1, "Last name is required"),
        password: z.string().min(6, "Password must be at least 6 characters"),
      });

      const { token, firstName, lastName, password } = acceptSchema.parse(req.body);

      // Get invitation details
      const invitation = await storage.getUserInvitationByToken(token);
      if (!invitation) {
        return res.status(400).json({ message: "Invalid or expired invitation" });
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 12);

      // Accept invitation and create user
      const newUser = await storage.acceptInvitation(token, {
        firstName,
        lastName,
        passwordHash,
      });

      if (!newUser) {
        return res.status(400).json({ message: "Failed to accept invitation" });
      }

      // Create welcome notification for inviter
      await storage.createNotification({
        userCompanyId: invitation.userCompanyId,
        targetUserId: invitation.invitedBy,
        fromUserId: newUser.id,
        notificationType: "team_member_joined",
        notificationTitle: "New Team Member Joined",
        notificationMessage: `${firstName} ${lastName} has joined your team`,
        isRead: false,
      });

      res.json({ 
        message: "Account created successfully",
        user: {
          id: newUser.id,
          email: newUser.email,
          firstName: newUser.firstName,
          lastName: newUser.lastName,
          role: newUser.userRole
        }
      });
    } catch (error) {
      console.error("Accept invitation error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get invitation details by token
  app.get("/api/team/invitation/:token", async (req: Request, res: Response) => {
    try {
      const { token } = req.params;
      
      const invitation = await storage.getUserInvitationByToken(token);
      if (!invitation) {
        return res.status(400).json({ message: "Invalid or expired invitation" });
      }

      res.json({
        email: invitation.email,
        role: invitation.invitedRole,
        companyName: invitation.companyName,
        inviterName: invitation.inviterName,
        message: invitation.invitationMessage
      });
    } catch (error) {
      console.error("Get invitation error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get all team members
  app.get("/api/team/members", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userCompanyId = req.session.userCompanyId;

      if (!userCompanyId) {
        return res.status(400).json({ message: "User company not found" });
      }

      const teamMembers = await storage.getTeamMembers(userCompanyId);
      res.json(teamMembers);
    } catch (error) {
      console.error("Get team members error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Update team member role/status
  app.put("/api/team/members/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId;
      const userCompanyId = req.session.userCompanyId;
      const memberId = parseInt(req.params.id);

      if (!userId || !userCompanyId) {
        return res.status(400).json({ message: "User not authenticated" });
      }

      if (isNaN(memberId)) {
        return res.status(400).json({ message: "Invalid member ID" });
      }

      // Check if user has permission
      const userWithPermissions = await storage.getUserWithPermissions(userId);
      if (!userWithPermissions?.permissions?.canManageUsers && !userWithPermissions?.isCompanyAdmin) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const updateSchema = z.object({
        role: z.string().optional(),
        status: z.enum(["active", "inactive"]).optional(),
      });

      const { role, status } = updateSchema.parse(req.body);

      if (role) {
        const updatedUser = await storage.updateUserRole(memberId, role, userCompanyId);
        if (!updatedUser) {
          return res.status(404).json({ message: "Team member not found" });
        }
      }

      if (status === "inactive") {
        const deactivated = await storage.deactivateUser(memberId, userCompanyId);
        if (!deactivated) {
          return res.status(404).json({ message: "Team member not found" });
        }
      }

      res.json({ message: "Team member updated successfully" });
    } catch (error) {
      console.error("Update team member error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Remove team member (admin only)
  app.delete("/api/team/members/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId;
      const userCompanyId = req.session.userCompanyId;
      const memberId = parseInt(req.params.id);

      if (!userId || !userCompanyId) {
        return res.status(400).json({ message: "User not authenticated" });
      }

      if (isNaN(memberId)) {
        return res.status(400).json({ message: "Invalid member ID" });
      }

      // Check if user has permission
      const userWithPermissions = await storage.getUserWithPermissions(userId);
      if (!userWithPermissions?.isCompanyAdmin) {
        return res.status(403).json({ message: "Only company admins can remove team members" });
      }

      // Don't allow removing themselves
      if (memberId === userId) {
        return res.status(400).json({ message: "Cannot remove yourself" });
      }

      const deactivated = await storage.deactivateUser(memberId, userCompanyId);
      if (!deactivated) {
        return res.status(404).json({ message: "Team member not found" });
      }

      res.json({ message: "Team member removed successfully" });
    } catch (error) {
      console.error("Remove team member error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get available roles and permissions
  app.get("/api/team/roles", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const roles = await storage.getUserRoles();
      res.json(roles);
    } catch (error) {
      console.error("Get roles error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Assign team member to deal
  app.post("/api/deals/:id/assign", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId;
      const userCompanyId = req.session.userCompanyId;
      const targetCompanyId = parseInt(req.params.id);

      if (!userId || !userCompanyId) {
        return res.status(400).json({ message: "User not authenticated" });
      }

      if (isNaN(targetCompanyId)) {
        return res.status(400).json({ message: "Invalid company ID" });
      }

      // Check if user has permission
      const userWithPermissions = await storage.getUserWithPermissions(userId);
      if (!userWithPermissions?.permissions?.canManageUsers && !userWithPermissions?.isCompanyAdmin) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const assignSchema = z.object({
        userId: z.number(),
        role: z.string().default("analyst"),
        canEditCompany: z.boolean().default(true),
        canUploadDocuments: z.boolean().default(true),
        canCreateActivities: z.boolean().default(true),
        canManageContacts: z.boolean().default(true),
      });

      const assignmentData = assignSchema.parse(req.body);

      const assignment = await storage.createDealAssignment({
        userId: assignmentData.userId,
        targetCompanyId,
        assignedBy: userId,
        assignmentRole: assignmentData.role,
        canEditCompany: assignmentData.canEditCompany,
        canUploadDocuments: assignmentData.canUploadDocuments,
        canCreateActivities: assignmentData.canCreateActivities,
        canManageContacts: assignmentData.canManageContacts,
        isActive: true,
      });

      // Get target company name for notification
      const targetCompany = await storage.getTargetCompany(targetCompanyId, userCompanyId);
      
      // Create notification for assigned user
      if (targetCompany) {
        await storage.createNotification({
          userCompanyId,
          targetUserId: assignmentData.userId,
          fromUserId: userId,
          notificationType: "deal_assigned",
          notificationTitle: "Assigned to Deal",
          notificationMessage: `You have been assigned to ${targetCompany.companyName}`,
          targetCompanyId,
          isRead: false,
        });
      }

      res.json(assignment);
    } catch (error) {
      console.error("Assign team member error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Remove team member from deal
  app.delete("/api/deals/:id/assign/:userId", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const requestUserId = req.session.userId;
      const userCompanyId = req.session.userCompanyId;
      const targetCompanyId = parseInt(req.params.id);
      const assignedUserId = parseInt(req.params.userId);

      if (!requestUserId || !userCompanyId) {
        return res.status(400).json({ message: "User not authenticated" });
      }

      if (isNaN(targetCompanyId) || isNaN(assignedUserId)) {
        return res.status(400).json({ message: "Invalid parameters" });
      }

      // Check if user has permission
      const userWithPermissions = await storage.getUserWithPermissions(requestUserId);
      if (!userWithPermissions?.permissions?.canManageUsers && !userWithPermissions?.isCompanyAdmin) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const removed = await storage.removeDealAssignment(assignedUserId, targetCompanyId);
      if (!removed) {
        return res.status(404).json({ message: "Assignment not found" });
      }

      res.json({ message: "Team member removed from deal successfully" });
    } catch (error) {
      console.error("Remove team member from deal error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get deal team members
  app.get("/api/deals/:id/team", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userCompanyId = req.session.userCompanyId;
      const targetCompanyId = parseInt(req.params.id);

      if (!userCompanyId) {
        return res.status(400).json({ message: "User not authenticated" });
      }

      if (isNaN(targetCompanyId)) {
        return res.status(400).json({ message: "Invalid company ID" });
      }

      const assignments = await storage.getDealAssignments(targetCompanyId);
      res.json(assignments);
    } catch (error) {
      console.error("Get deal team error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Update team member permissions for deal
  app.put("/api/deals/:id/team/:userId", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const requestUserId = req.session.userId;
      const userCompanyId = req.session.userCompanyId;
      const targetCompanyId = parseInt(req.params.id);
      const assignedUserId = parseInt(req.params.userId);

      if (!requestUserId || !userCompanyId) {
        return res.status(400).json({ message: "User not authenticated" });
      }

      if (isNaN(targetCompanyId) || isNaN(assignedUserId)) {
        return res.status(400).json({ message: "Invalid parameters" });
      }

      // Check if user has permission
      const userWithPermissions = await storage.getUserWithPermissions(requestUserId);
      if (!userWithPermissions?.permissions?.canManageUsers && !userWithPermissions?.isCompanyAdmin) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const updateSchema = z.object({
        role: z.string().optional(),
        canEditCompany: z.boolean().optional(),
        canUploadDocuments: z.boolean().optional(),
        canCreateActivities: z.boolean().optional(),
        canManageContacts: z.boolean().optional(),
      });

      const updateData = updateSchema.parse(req.body);

      const updatedAssignment = await storage.updateDealAssignment(
        assignedUserId, 
        targetCompanyId, 
        {
          assignmentRole: updateData.role,
          canEditCompany: updateData.canEditCompany,
          canUploadDocuments: updateData.canUploadDocuments,
          canCreateActivities: updateData.canCreateActivities,
          canManageContacts: updateData.canManageContacts,
        }
      );

      if (!updatedAssignment) {
        return res.status(404).json({ message: "Assignment not found" });
      }

      res.json(updatedAssignment);
    } catch (error) {
      console.error("Update team member permissions error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get user notifications
  app.get("/api/notifications", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId;

      if (!userId) {
        return res.status(400).json({ message: "User not authenticated" });
      }

      const notifications = await storage.getUserNotifications(userId);
      res.json(notifications);
    } catch (error) {
      console.error("Get notifications error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Mark notification as read
  app.put("/api/notifications/:id/read", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId;
      const notificationId = parseInt(req.params.id);

      if (!userId) {
        return res.status(400).json({ message: "User not authenticated" });
      }

      if (isNaN(notificationId)) {
        return res.status(400).json({ message: "Invalid notification ID" });
      }

      const marked = await storage.markNotificationRead(notificationId, userId);
      if (!marked) {
        return res.status(404).json({ message: "Notification not found" });
      }

      res.json({ message: "Notification marked as read" });
    } catch (error) {
      console.error("Mark notification read error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Mark all notifications as read
  app.post("/api/notifications/mark-all-read", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId;

      if (!userId) {
        return res.status(400).json({ message: "User not authenticated" });
      }

      const count = await storage.markAllNotificationsRead(userId);
      res.json({ message: "All notifications marked as read", count });
    } catch (error) {
      console.error("Mark all notifications read error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

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

  // Deal Notes CRUD operations
  app.get("/api/target-companies/:id/notes", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userCompanyId = req.session.userCompanyId;
      const companyId = parseInt(req.params.id);

      if (!userCompanyId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      if (isNaN(companyId)) {
        return res.status(400).json({ message: "Invalid company ID" });
      }

      const company = await storage.getTargetCompany(companyId, userCompanyId);
      if (!company) {
        return res.status(404).json({ message: "Company not found or access denied" });
      }

      const notes = await storage.getDealNotes(companyId);
      res.json(notes);
    } catch (error) {
      console.error("Get deal notes error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/target-companies/:id/notes", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId;
      const userCompanyId = req.session.userCompanyId;
      const companyId = parseInt(req.params.id);

      if (!userId || !userCompanyId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      if (isNaN(companyId)) {
        return res.status(400).json({ message: "Invalid company ID" });
      }

      const company = await storage.getTargetCompany(companyId, userCompanyId);
      if (!company) {
        return res.status(404).json({ message: "Company not found or access denied" });
      }

      const { noteType, title, content, reminderDate } = req.body;
      if (!title) {
        return res.status(400).json({ message: "Title is required" });
      }

      const note = await storage.createDealNote({
        targetCompanyId: companyId,
        noteType: noteType || "General",
        title,
        content: content || null,
        reminderDate: reminderDate ? new Date(reminderDate) : null,
        reminderCompleted: false,
        createdBy: userId,
      });

      // Auto-move to Initial Contact stage when Initial Discussion note is added
      if (noteType === "Initial Discussion" && company.stage === "New Target") {
        await storage.updateTargetCompany(companyId, { stage: "Initial Contact" }, userCompanyId);
      }

      res.json(note);
    } catch (error) {
      console.error("Create deal note error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.put("/api/notes/:noteId", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId;
      const noteId = parseInt(req.params.noteId);

      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      if (isNaN(noteId)) {
        return res.status(400).json({ message: "Invalid note ID" });
      }

      const { noteType, title, content, reminderDate, reminderCompleted } = req.body;
      const updates: any = {};
      if (noteType !== undefined) updates.noteType = noteType;
      if (title !== undefined) updates.title = title;
      if (content !== undefined) updates.content = content;
      if (reminderDate !== undefined) updates.reminderDate = reminderDate ? new Date(reminderDate) : null;
      if (reminderCompleted !== undefined) updates.reminderCompleted = reminderCompleted;

      const note = await storage.updateDealNote(noteId, updates);
      if (!note) {
        return res.status(404).json({ message: "Note not found" });
      }
      res.json(note);
    } catch (error) {
      console.error("Update deal note error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/notes/:noteId", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId;
      const noteId = parseInt(req.params.noteId);

      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      if (isNaN(noteId)) {
        return res.status(400).json({ message: "Invalid note ID" });
      }

      const deleted = await storage.deleteDealNote(noteId);
      if (!deleted) {
        return res.status(404).json({ message: "Note not found" });
      }
      res.json({ success: true, message: "Note deleted" });
    } catch (error) {
      console.error("Delete deal note error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

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

  // Activity management routes

  // Get activity types
  app.get("/api/activities/types", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const activityTypes = await storage.getActivityTypes();
      res.json(activityTypes);
    } catch (error) {
      console.error("Get activity types error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Create new activity for target company
  app.post("/api/target-companies/:id/activities", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId;
      const userCompanyId = req.session.userCompanyId;
      const targetCompanyId = parseInt(req.params.id);

      if (!userId || !userCompanyId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      if (isNaN(targetCompanyId)) {
        return res.status(400).json({ message: "Invalid company ID" });
      }

      // Verify user has access to this company
      const company = await storage.getTargetCompany(targetCompanyId, userCompanyId);
      if (!company) {
        return res.status(404).json({ message: "Company not found or access denied" });
      }

      const activityData = insertActivitySchema.parse({
        ...req.body,
        targetCompanyId,
        userId,
      });

      const newActivity = await storage.createActivity(activityData);
      res.status(201).json(newActivity);
    } catch (error) {
      console.error("Create activity error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: error.errors 
        });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get activities for target company
  app.get("/api/target-companies/:id/activities", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userCompanyId = req.session.userCompanyId;
      const targetCompanyId = parseInt(req.params.id);

      if (!userCompanyId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      if (isNaN(targetCompanyId)) {
        return res.status(400).json({ message: "Invalid company ID" });
      }

      // Verify user has access to this company
      const company = await storage.getTargetCompany(targetCompanyId, userCompanyId);
      if (!company) {
        return res.status(404).json({ message: "Company not found or access denied" });
      }

      const activities = await storage.getActivitiesForCompany(targetCompanyId, userCompanyId);
      res.json(activities);
    } catch (error) {
      console.error("Get company activities error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get activity timeline for target company
  app.get("/api/target-companies/:id/activities/timeline", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userCompanyId = req.session.userCompanyId;
      const targetCompanyId = parseInt(req.params.id);

      if (!userCompanyId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      if (isNaN(targetCompanyId)) {
        return res.status(400).json({ message: "Invalid company ID" });
      }

      // Verify user has access to this company
      const company = await storage.getTargetCompany(targetCompanyId, userCompanyId);
      if (!company) {
        return res.status(404).json({ message: "Company not found or access denied" });
      }

      const timeline = await storage.getActivityTimeline(targetCompanyId, userCompanyId);
      res.json(timeline);
    } catch (error) {
      console.error("Get activity timeline error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Update activity
  app.put("/api/activities/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userCompanyId = req.session.userCompanyId;
      const activityId = parseInt(req.params.id);

      if (!userCompanyId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      if (isNaN(activityId)) {
        return res.status(400).json({ message: "Invalid activity ID" });
      }

      const updateData = z.object({
        activityType: z.string().optional(),
        title: z.string().optional(),
        description: z.string().optional(),
        activityDate: z.string().datetime().or(z.date()).optional(),
        activityTime: z.string().optional(),
        durationMinutes: z.number().optional().nullable(),
        contactId: z.number().optional().nullable(),
        isCompleted: z.boolean().optional(),
        followUpDate: z.string().datetime().optional().nullable().or(z.date().optional().nullable()),
      }).parse(req.body);

      const updatedActivity = await storage.updateActivity(activityId, updateData, userCompanyId);
      
      if (!updatedActivity) {
        return res.status(404).json({ message: "Activity not found or access denied" });
      }

      res.json(updatedActivity);
    } catch (error) {
      console.error("Update activity error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: error.errors 
        });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Delete activity
  app.delete("/api/activities/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userCompanyId = req.session.userCompanyId;
      const activityId = parseInt(req.params.id);

      if (!userCompanyId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      if (isNaN(activityId)) {
        return res.status(400).json({ message: "Invalid activity ID" });
      }

      const deleted = await storage.deleteActivity(activityId, userCompanyId);
      
      if (!deleted) {
        return res.status(404).json({ message: "Activity not found or access denied" });
      }

      res.json({ message: "Activity deleted successfully" });
    } catch (error) {
      console.error("Delete activity error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get recent activities across all companies
  app.get("/api/activities/recent", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userCompanyId = req.session.userCompanyId;
      const limit = parseInt(req.query.limit as string) || 20;

      if (!userCompanyId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const recentActivities = await storage.getRecentActivities(userCompanyId, limit);
      res.json(recentActivities);
    } catch (error) {
      console.error("Get recent activities error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ========================
  // Reporting & Analytics Routes
  // ========================

  // Get pipeline overview report
  app.get("/api/reports/pipeline-overview", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userCompanyId = req.session.userCompanyId;
      const dateRange = req.query.range as string;
      
      if (!userCompanyId) {
        return res.status(400).json({ message: "User company not found" });
      }

      const pipelineData = await storage.getPipelineOverview(userCompanyId, dateRange);
      res.json(pipelineData);
    } catch (error) {
      console.error("Pipeline overview error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get activity summary report
  app.get("/api/reports/activity-summary", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userCompanyId = req.session.userCompanyId;
      const dateRange = req.query.range as string;
      
      if (!userCompanyId) {
        return res.status(400).json({ message: "User company not found" });
      }

      const activityData = await storage.getActivitySummary(userCompanyId, dateRange);
      res.json(activityData);
    } catch (error) {
      console.error("Activity summary error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get performance metrics report
  app.get("/api/reports/performance-metrics", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userCompanyId = req.session.userCompanyId;
      const dateRange = req.query.range as string;
      
      if (!userCompanyId) {
        return res.status(400).json({ message: "User company not found" });
      }

      const performanceData = await storage.getPerformanceMetrics(userCompanyId, dateRange);
      res.json(performanceData);
    } catch (error) {
      console.error("Performance metrics error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get stage analysis report
  app.get("/api/reports/stage-analysis", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userCompanyId = req.session.userCompanyId;
      const dateRange = req.query.range as string;
      
      if (!userCompanyId) {
        return res.status(400).json({ message: "User company not found" });
      }

      const stageData = await storage.getStageAnalysis(userCompanyId, dateRange);
      res.json(stageData);
    } catch (error) {
      console.error("Stage analysis error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get user performance report
  app.get("/api/reports/user-performance", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userCompanyId = req.session.userCompanyId;
      const dateRange = req.query.range as string;
      
      if (!userCompanyId) {
        return res.status(400).json({ message: "User company not found" });
      }

      const userPerformanceData = await storage.getUserPerformance(userCompanyId, dateRange);
      res.json(userPerformanceData);
    } catch (error) {
      console.error("User performance error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Export reports as CSV
  app.get("/api/reports/export/:type", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userCompanyId = req.session.userCompanyId;
      const reportType = req.params.type;
      const format = req.query.format as string || 'csv';
      
      if (!userCompanyId) {
        return res.status(400).json({ message: "User company not found" });
      }

      const csvData = await storage.exportReport(userCompanyId, reportType, format);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${reportType}_report_${new Date().toISOString().split('T')[0]}.csv"`);
      res.send(csvData);
    } catch (error) {
      console.error("Export report error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

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

  // Upload document
  app.post("/api/target-companies/:id/documents", isAuthenticated, (req: Request, res: Response) => {
    upload.single('document')(req, res, async (err) => {
      try {
        const targetCompanyId = parseInt(req.params.id);
        const userId = req.session.userId!;
        const userCompanyId = req.session.userCompanyId!;
        
        if (err) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'File size too large. Maximum 10MB allowed.' });
          }
          return res.status(400).json({ error: err.message });
        }
        
        if (!req.file) {
          return res.status(400).json({ error: 'No file uploaded' });
        }

        // Verify user has access to this company
        const company = await storage.getTargetCompany(targetCompanyId, userCompanyId);
        if (!company) {
          return res.status(404).json({ error: 'Company not found or access denied' });
        }
        
        // Create document record
        const documentCategory = req.body.document_category || 'Company Accounts';
        const originalFilename = req.file.originalname;
        
        // Prefix filename with 'COMPANY ACCOUNTS- ' if category is 'Company Accounts'
        const prefixedFilename = documentCategory === 'Company Accounts' 
          ? `COMPANY ACCOUNTS- ${originalFilename}`
          : originalFilename;
        
        const documentData = {
          targetCompanyId,
          uploadedBy: userId,
          documentName: req.body.document_name || prefixedFilename,
          originalFilename: prefixedFilename,
          filePath: req.file.path,
          fileSize: req.file.size,
          fileType: req.file.mimetype,
          documentCategory: documentCategory,
          description: req.body.description || '',
          isConfidential: req.body.is_confidential !== 'false'
        };
        
        const document = await storage.createDocument(documentData);
        
        // Create file upload event for webhook monitoring
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const fileUploadEventData = {
          documentId: document.id,
          targetCompanyId: targetCompanyId,
          uploadedBy: userId,
          fileName: prefixedFilename, // Use prefixed filename for webhook
          fileUrl: `${baseUrl}/api/public/documents/${document.id}/download`, // Public URL for external webhook access
          webhookSent: false,
          webhookStatus: 'pending',
        };
        
        const uploadEvent = await storage.createFileUploadEvent(fileUploadEventData);
        
        // Send SSE notification for immediate document list updates
        if (global.documentUpdateListeners) {
          global.documentUpdateListeners.forEach((listener) => {
            if (listener.targetCompanyId === targetCompanyId) {
              listener.res.write(`data: ${JSON.stringify({ 
                type: 'document_uploaded', 
                targetCompanyId: targetCompanyId,
                documentId: document.id,
                timestamp: new Date().toISOString()
              })}\n\n`);
            }
          });
        }
        
        // Automatically trigger webhook for file upload
        await sendFileUploadWebhook(uploadEvent.id);
        
        res.json({
          success: true,
          document,
          message: 'Document uploaded successfully'
        });
        
      } catch (error) {
        console.error('Document upload failed:', error);
        res.status(500).json({ error: 'Upload failed' });
      }
    });
  });

  // Get company documents
  app.get("/api/target-companies/:id/documents", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const targetCompanyId = parseInt(req.params.id);
      const userCompanyId = req.session.userCompanyId!;
      
      const documents = await storage.getCompanyDocuments(targetCompanyId, userCompanyId);
      
      // Group documents by category
      const groupedDocuments = documents.reduce((acc: any, doc) => {
        if (!acc[doc.documentCategory]) {
          acc[doc.documentCategory] = [];
        }
        acc[doc.documentCategory].push(doc);
        return acc;
      }, {});
      
      console.log(`[API] Returning ${documents.length} documents grouped into ${Object.keys(groupedDocuments).length} categories for company ${targetCompanyId}`);
      Object.keys(groupedDocuments).forEach(category => {
        console.log(`[API] Category "${category}": ${groupedDocuments[category].length} documents`);
      });
      
      res.json(groupedDocuments);
    } catch (error) {
      console.error("Get company documents error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get document details
  app.get("/api/documents/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const documentId = parseInt(req.params.id);
      const userCompanyId = req.session.userCompanyId!;
      
      const document = await storage.getDocument(documentId, userCompanyId);
      if (!document) {
        return res.status(404).json({ error: 'Document not found or access denied' });
      }
      
      res.json(document);
    } catch (error) {
      console.error("Get document error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // View document (for preview)
  app.get("/api/documents/:id/view", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const documentId = parseInt(req.params.id);
      const userId = req.session.userId!;
      const userCompanyId = req.session.userCompanyId!;
      
      const document = await storage.getDocument(documentId, userCompanyId);
      if (!document) {
        return res.status(404).json({ error: 'Document not found or access denied' });
      }
      
      // Log access
      await storage.logDocumentAccess(documentId, userId, 'view', req.ip);
      
      // Set headers for inline viewing
      res.setHeader('Content-Type', document.fileType);
      res.setHeader('Content-Disposition', `inline; filename="${document.originalFilename}"`);
      
      // Add cache control for better performance
      res.setHeader('Cache-Control', 'private, max-age=3600');
      
      // Add headers to allow iframe embedding
      res.setHeader('X-Frame-Options', 'SAMEORIGIN');
      res.setHeader('Content-Security-Policy', 'frame-ancestors \'self\'');
      
      // Send file
      res.sendFile(path.resolve(document.filePath));
      
    } catch (error) {
      console.error("View document error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Download document
  app.get("/api/documents/:id/download", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const documentId = parseInt(req.params.id);
      const userId = req.session.userId!;
      const userCompanyId = req.session.userCompanyId!;
      
      const document = await storage.getDocument(documentId, userCompanyId);
      if (!document) {
        return res.status(404).json({ error: 'Document not found or access denied' });
      }
      
      // Log access
      await storage.logDocumentAccess(documentId, userId, 'download', req.ip);
      
      // Set headers for download
      res.setHeader('Content-Disposition', `attachment; filename="${document.originalFilename}"`);
      res.setHeader('Content-Type', document.fileType);
      
      // Send file
      res.sendFile(path.resolve(document.filePath));
      
    } catch (error) {
      console.error("Download document error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Update document
  app.put("/api/documents/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const documentId = parseInt(req.params.id);
      const userCompanyId = req.session.userCompanyId!;
      
      const updateData = {
        documentName: req.body.document_name,
        documentCategory: req.body.document_category,
        description: req.body.description,
        isConfidential: req.body.is_confidential
      };
      
      const document = await storage.updateDocument(documentId, updateData, userCompanyId);
      if (!document) {
        return res.status(404).json({ error: 'Document not found or access denied' });
      }
      
      res.json({ success: true, document });
    } catch (error) {
      console.error("Update document error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

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

  // Debug Stage 1 analysis events - No auth for debugging  
  app.get("/api/debug/stage1-events/:id", async (req: Request, res: Response) => {
    try {
      const targetCompanyId = parseInt(req.params.id);
      
      // Get all Stage 1 analysis events for this company (bypass auth for debug)
      const events = await db
        .select()
        .from(stage1AnalysisEvents)
        .where(eq(stage1AnalysisEvents.targetCompanyId, targetCompanyId))
        .orderBy(desc(stage1AnalysisEvents.createdAt));
      
      console.log(`[DEBUG] Found ${events.length} Stage 1 analysis events for company ${targetCompanyId}:`);
      events.forEach(event => {
        console.log(`[DEBUG] Event ${event.id}: status=${event.webhookStatus}, sent=${event.webhookSent}, response length=${event.webhookResponse?.length || 0}`);
      });
      
      res.json({ 
        success: true,
        events: events.map(event => ({
          id: event.id,
          webhookStatus: event.webhookStatus,
          webhookSent: event.webhookSent,
          webhookSentAt: event.webhookSentAt,
          createdAt: event.createdAt,
          responseLength: event.webhookResponse?.length || 0,
          responsePreview: event.webhookResponse?.substring(0, 100) || null
        }))
      });
    } catch (error) {
      console.error('[DEBUG] Error getting Stage 1 analysis events:', error);
      res.status(500).json({ error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Manual trigger for Stage 1 analysis (for testing) - No auth for debugging
  app.post("/api/debug/trigger-stage1/:id", async (req: Request, res: Response) => {
    try {
      const targetCompanyId = parseInt(req.params.id);

      console.log(`[MANUAL_TRIGGER] Starting Stage 1 analysis check for company ${targetCompanyId}`);
      
      // First, check the category requirements directly
      const categoryCheck = await checkStage1RequirementsByCategory(targetCompanyId);
      console.log(`[MANUAL_TRIGGER] Category check result:`, categoryCheck);
      
      // Debug - Check what analysis results actually exist
      const companyAccountsData = await storage.getDocumentAnalysisResultsByTypeForCompany('company_accounts', targetCompanyId);
      const balanceSheetData = await storage.getDocumentAnalysisResultsByTypeForCompany('balance_sheet', targetCompanyId);
      const profitLossData = await storage.getDocumentAnalysisResultsByTypeForCompany('profit_and_loss', targetCompanyId);
      const assetRegisterData = await storage.getDocumentAnalysisResultsByTypeForCompany('asset_register', targetCompanyId);
      const salesLedgerData = await storage.getDocumentAnalysisResultsByTypeForCompany('sales_ledger', targetCompanyId);
      const staffMatrixData = await storage.getDocumentAnalysisResultsByTypeForCompany('staff_matrix', targetCompanyId);
      
      console.log(`[MANUAL_TRIGGER] Available analysis data counts:`, {
        company_accounts: companyAccountsData.length,
        balance_sheet: balanceSheetData.length,
        profit_and_loss: profitLossData.length,
        asset_register: assetRegisterData.length,
        sales_ledger: salesLedgerData.length,
        staff_matrix: staffMatrixData.length
      });
      
      // Manually trigger Stage 1 analysis check with user ID 2 (admin) - bypass requirements
      console.log(`[MANUAL_TRIGGER] Calling checkAndTriggerStage1Analysis for company ${targetCompanyId} with bypass=true`);
      await checkAndTriggerStage1Analysis(targetCompanyId, 2, true);
      console.log(`[MANUAL_TRIGGER] Completed checkAndTriggerStage1Analysis for company ${targetCompanyId}`);
      
      res.json({ 
        success: true, 
        message: 'Stage 1 analysis check triggered (bypassed requirements)',
        categoryCheck,
        analysisDataCounts: {
          company_accounts: companyAccountsData.length,
          balance_sheet: balanceSheetData.length,
          profit_and_loss: profitLossData.length,
          asset_register: assetRegisterData.length,
          sales_ledger: salesLedgerData.length,
          staff_matrix: staffMatrixData.length
        }
      });
    } catch (error) {
      console.error('[MANUAL_TRIGGER] Error triggering Stage 1 analysis:', error);
      res.status(500).json({ error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

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

  // Delete document (handles both regular documents and external submissions)
  app.delete("/api/documents/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const documentId = parseInt(req.params.id);
      const userCompanyId = req.session.userCompanyId!;
      
      // First try to find in main documents table
      const document = await storage.getDocument(documentId, userCompanyId);
      
      if (document) {
        // It's a regular document, delete it normally
        const success = await storage.deleteDocument(documentId, userCompanyId);
        if (!success) {
          return res.status(500).json({ error: 'Failed to delete document' });
        }
        
        // If this document came from a portal submission, also delete the external submission
        if (document.externalSubmissionId) {
          try {
            console.log(`[DOCUMENT_DELETE] Deleting external submission ${document.externalSubmissionId} for document ${documentId}`);
            // First get the external submission to retrieve its file path for cleanup
            const externalSubmission = await storage.getExternalSubmission(document.externalSubmissionId, userCompanyId);
            if (externalSubmission) {
              // Remove the external submission's file from filesystem
              try {
                await fs.unlink(externalSubmission.filePath);
                console.log(`[DOCUMENT_DELETE] Removed external submission file: ${externalSubmission.filePath}`);
              } catch (fileErr) {
                console.warn("Could not remove external submission file:", externalSubmission.filePath, fileErr);
              }
            }
            // Then delete the external submission from database
            await storage.deleteExternalSubmission(document.externalSubmissionId, userCompanyId);
          } catch (err) {
            console.warn("Could not delete external submission:", document.externalSubmissionId, err);
          }
        }
        
        // Remove file from filesystem
        try {
          await fs.unlink(document.filePath);
        } catch (err) {
          console.warn("Could not remove file:", document.filePath, err);
        }
        
        res.json({ success: true });
      } else {
        // Not found in main documents table, check if it's an external submission
        const externalSubmission = await storage.getExternalSubmission(documentId, userCompanyId);
        
        if (!externalSubmission) {
          return res.status(404).json({ error: 'Document not found or access denied' });
        }
        
        // It's an external submission, delete it
        console.log(`[DOCUMENT_DELETE] Deleting external submission ${documentId} directly`);
        const success = await storage.deleteExternalSubmission(documentId, userCompanyId);
        if (!success) {
          return res.status(500).json({ error: 'Failed to delete external submission' });
        }
        
        // Remove file from filesystem
        try {
          await fs.unlink(externalSubmission.filePath);
        } catch (err) {
          console.warn("Could not remove file:", externalSubmission.filePath, err);
        }
        
        res.json({ success: true });
      }
    } catch (error) {
      console.error("Delete document error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

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
  // External Document Portal Routes
  // ========================================

  // Validate portal token (public endpoint)
  app.get("/api/portal/validate/:token", async (req: Request, res: Response) => {
    try {
      const accessToken = req.params.token;
      
      if (!accessToken) {
        return res.status(400).json({ message: "Access token is required" });
      }
      
      const portalToken = await storage.validatePortalToken(accessToken);
      if (!portalToken) {
        return res.status(404).json({ message: "Invalid or expired access token" });
      }
      
      // Log access
      await storage.updatePortalTokenAccess(
        portalToken.id, 
        req.ip, 
        req.get('User-Agent')
      );
      
      // Log activity
      await storage.logPortalActivity({
        portalTokenId: portalToken.id,
        targetContactId: portalToken.targetContactId,
        activityType: "portal_access",
        activityDescription: "Portal accessed via token validation",
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });
      
      res.json({
        valid: true,
        tokenId: portalToken.id,
        companyId: portalToken.targetCompanyId,
        contactId: portalToken.targetContactId,
        allowedActions: JSON.parse(portalToken.allowedActions || '{}'),
        customMessage: portalToken.customMessage,
        portalBranding: portalToken.portalBranding ? JSON.parse(portalToken.portalBranding) : null,
      });
    } catch (error) {
      console.error("Validate portal token error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Main portal data endpoint - returns complete portal data for frontend  
  app.get("/api/portal/:token", async (req: Request, res: Response) => {
    console.log(`[PORTAL API] Accessing portal data for token: ${req.params.token}`);
    
    // Skip if this is a more specific route
    if (req.params.token.includes('/')) {
      return res.status(404).json({ message: "Not found" });
    }
    
    try {
      const accessToken = req.params.token;
      
      if (!accessToken) {
        return res.status(400).json({ message: "Access token is required" });
      }
      
      const portalToken = await storage.validatePortalToken(accessToken);
      if (!portalToken) {
        return res.status(404).json({ message: "Invalid or expired portal token" });
      }
      
      // Log access
      await storage.updatePortalTokenAccess(
        portalToken.id, 
        req.ip, 
        req.get('User-Agent')
      );
      
      // Get portal data for simple upload system
      const documentTypes = [
        { value: 'p_and_l', label: 'P&L Statement', category: 'financial', maxFiles: 1 },
        { value: 'balance_sheet', label: 'Balance Sheet', category: 'financial', maxFiles: 1 },
        { value: 'cash_flow', label: 'Cash Flow Statement', category: 'financial', maxFiles: 1 },
        { value: 'tax_returns', label: 'Tax Returns', category: 'financial', maxFiles: 1 },
        { value: 'management_accounts', label: 'Management Accounts', category: 'financial', maxFiles: 1 },
        { value: 'company_accounts_1', label: 'Company Accounts 1', category: 'company_accounts', maxFiles: 1 },
        { value: 'company_accounts_2', label: 'Company Accounts 2', category: 'company_accounts', maxFiles: 1 },
        { value: 'company_accounts_3', label: 'Company Accounts 3', category: 'company_accounts', maxFiles: 1 },
        { value: 'company_accounts_4', label: 'Company Accounts 4', category: 'company_accounts', maxFiles: 1 },
        { value: 'company_accounts_5', label: 'Company Accounts 5', category: 'company_accounts', maxFiles: 1 }
      ];
      
      // Get enhanced portal data with document status tracking
      const portalData = await storage.getSimplePortalData(portalToken.id);
      
      res.json(portalData);
    } catch (error) {
      console.error("Portal data error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get portal document requirements (public endpoint)
  app.get("/api/portal/:token/requirements", async (req: Request, res: Response) => {
    try {
      const accessToken = req.params.token;
      
      const portalToken = await storage.validatePortalToken(accessToken);
      if (!portalToken) {
        return res.status(404).json({ message: "Invalid or expired access token" });
      }
      
      const requirements = await storage.getPortalDocumentRequirements(portalToken.id);
      
      // Log activity
      await storage.logPortalActivity({
        portalTokenId: portalToken.id,
        targetContactId: portalToken.targetContactId,
        activityType: "requirements_viewed",
        activityDescription: "Document requirements viewed",
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });
      
      res.json(requirements);
    } catch (error) {
      console.error("Get portal requirements error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Submit document via portal (public endpoint with file upload)
  const portalUpload = multer({
    storage: multer.diskStorage({
      destination: async (req, file, cb) => {
        const uploadPath = path.join(process.cwd(), 'uploads', 'portal');
        try {
          await fs.mkdir(uploadPath, { recursive: true });
          cb(null, uploadPath);
        } catch (error) {
          cb(error as Error, '');
        }
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
      }
    }),
    fileFilter: (req, file, cb) => {
      // Allow common business document types - be more permissive with extensions
      const allowedExtensions = /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|csv|jpg|jpeg|png|gif)$/i;
      
      // Log file upload attempts for debugging
      console.log('File upload attempt:', file.originalname, file.mimetype);
      
      if (allowedExtensions.test(file.originalname)) {
        return cb(null, true);
      } else {
        cb(new Error('Only PDF, Office documents, text files and images are allowed'));
      }
    },
    limits: {
      fileSize: 10 * 1024 * 1024 // 10MB limit
    }
  });

  app.post("/api/portal/:token/submit", portalUpload.single('document'), async (req: Request, res: Response) => {
    try {
      const accessToken = req.params.token;
      const file = req.file;
      
      if (!file) {
        return res.status(400).json({ message: "No document uploaded" });
      }
      
      const portalToken = await storage.validatePortalToken(accessToken);
      if (!portalToken) {
        // Remove uploaded file if token is invalid
        try {
          await fs.unlink(file.path);
        } catch (err) {
          console.warn("Could not remove invalid upload:", file.path);
        }
        return res.status(404).json({ message: "Invalid or expired access token" });
      }
      
      // Check allowed actions
      const allowedActions = JSON.parse(portalToken.allowedActions || '{}');
      if (!allowedActions.upload) {
        try {
          await fs.unlink(file.path);
        } catch (err) {
          console.warn("Could not remove unauthorized upload:", file.path);
        }
        return res.status(403).json({ message: "Document upload not permitted for this portal" });
      }
      
      // Map portal document types to internal categories - only 6 categories
      const portalToInternalCategoryMap = {
        'company_accounts_1': 'Company Accounts',
        'company_accounts_2': 'Company Accounts', 
        'company_accounts_3': 'Company Accounts',
        'company_accounts_4': 'Company Accounts',
        'company_accounts_5': 'Company Accounts',
        'sales_ledger': 'Sales Ledger',
        'balance_sheet': 'Balance Sheet',
        'profit_loss': 'Profit & Loss',
        'p_and_l': 'Profit & Loss', // Fix for the actual submitted type
        'staff_matrix': 'Staff Matrix',
        'asset_register': 'Asset Register',
        // Default fallbacks to one of the 6 categories
        'legal_documents': 'Company Accounts',
        'correspondence': 'Company Accounts',
        'marketing': 'Company Accounts',
        'technical': 'Company Accounts',
        'other': 'Company Accounts',
        'general': 'Company Accounts'
      };

      const submittedDocumentType = req.body.documentType || req.body.document_category || 'general';
      const mappedCategory = portalToInternalCategoryMap[submittedDocumentType as keyof typeof portalToInternalCategoryMap] || 'Company Accounts';

      // Prefix filename with 'COMPANY ACCOUNTS- ' if mapped category is 'Company Accounts'
      const originalFilename = file.originalname;
      const prefixedFilename = mappedCategory === 'Company Accounts' 
        ? `COMPANY ACCOUNTS- ${originalFilename}`
        : originalFilename;

      // Create submission record first for tracking
      const submission = await storage.createExternalDocumentSubmission({
        portalTokenId: portalToken.id,
        targetCompanyId: portalToken.targetCompanyId,
        targetContactId: portalToken.targetContactId,
        originalFilename: prefixedFilename,
        storedFilename: file.filename,
        filePath: file.path,
        fileSize: file.size,
        fileType: file.mimetype,
        documentCategory: submittedDocumentType,
        submissionNotes: req.body.submissionNotes || req.body.submission_notes || null,
        submissionIp: req.ip,
        submissionUserAgent: req.get('User-Agent'),
        documentRequirementId: req.body.requirement_id ? parseInt(req.body.requirement_id) : null,
      });

      // Create document directly in main system (unified approach)
      console.log('[PORTAL] Creating document using unified upload process for:', prefixedFilename);
      
      const mainDocument = await storage.createDocument({
        targetCompanyId: portalToken.targetCompanyId,
        uploadedBy: 1, // System user for portal submissions
        documentName: prefixedFilename,
        originalFilename: prefixedFilename,
        filePath: file.path,
        fileSize: file.size,
        fileType: file.mimetype,
        documentCategory: mappedCategory, // Use mapped internal category
        description: `Submitted via external portal${req.body.submissionNotes || req.body.submission_notes ? ': ' + (req.body.submissionNotes || req.body.submission_notes) : ''}`,
        isConfidential: false,
        externalSubmissionId: submission.id, // Link to portal submission
      });
      
      console.log('[PORTAL] ✅ SUCCESS: Document created using unified process! Document ID:', mainDocument.id);
      
      // Create file upload event and trigger webhook (same as internal uploads)
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const uploadEvent = await storage.createFileUploadEvent({
        documentId: mainDocument.id,
        targetCompanyId: portalToken.targetCompanyId,
        uploadedBy: 1,
        fileName: prefixedFilename, // Use prefixed filename for webhook
        fileUrl: `${baseUrl}/api/public/documents/${mainDocument.id}/download`,
        webhookSent: false,
        webhookStatus: 'pending',
      });
      
      // Trigger webhook automatically
      await sendFileUploadWebhook(uploadEvent.id);
      
      // Auto-approve the submission
      await storage.reviewDocumentSubmission(
        submission.id, 
        portalToken.createdBy, 
        'approved', 
        'Auto-approved - unified upload process'
      );
      
      console.log('[PORTAL] Unified upload process completed successfully, webhook triggered');
      
      // Notify connected clients about document update (for real-time UI updates)
      if (global.documentUpdateListeners) {
        global.documentUpdateListeners.forEach((listener) => {
          if (listener.targetCompanyId === portalToken.targetCompanyId) {
            listener.res.write(`data: ${JSON.stringify({ 
              type: 'document_uploaded', 
              targetCompanyId: portalToken.targetCompanyId,
              documentId: mainDocument.id,
              timestamp: new Date().toISOString()
            })}\n\n`);
          }
        });
      }
      
      // Remove the old integration code since we're using unified process
      
      // Log activity
      await storage.logPortalActivity({
        portalTokenId: portalToken.id,
        targetContactId: portalToken.targetContactId,
        activityType: "document_submitted",
        activityDescription: `Document submitted: ${prefixedFilename}`,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        relatedDocumentId: submission.id,
      });
      
      res.json({
        success: true,
        submissionId: submission.id,
        message: "Document submitted successfully",
        filename: prefixedFilename,
      });
    } catch (error) {
      console.error("Portal document submission error:", error);
      
      // Clean up uploaded file on error
      if (req.file) {
        try {
          await fs.unlink(req.file.path);
        } catch (err) {
          console.warn("Could not remove file after error:", req.file.path);
        }
      }
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get analysis completion status for portal (public endpoint)
  app.get("/api/portal/:token/analysis-completion", async (req: Request, res: Response) => {
    try {
      const accessToken = req.params.token;
      
      const portalToken = await storage.validatePortalToken(accessToken);
      if (!portalToken) {
        return res.status(404).json({ message: "Invalid or expired access token" });
      }
      
      // Get analysis completion status using the portal-specific method
      const analysisStatus = await storage.getPortalAnalysisCompletionStatus(
        portalToken.targetCompanyId
      );
      
      // Log activity
      await storage.logPortalActivity({
        portalTokenId: portalToken.id,
        targetContactId: portalToken.targetContactId,
        activityType: "analysis_status_viewed",
        activityDescription: "Document analysis completion status viewed",
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });
      
      res.json(analysisStatus);
    } catch (error) {
      console.error("Get portal analysis completion error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get portal submissions history (public endpoint)
  app.get("/api/portal/:token/submissions", async (req: Request, res: Response) => {
    try {
      const accessToken = req.params.token;
      
      const portalToken = await storage.validatePortalToken(accessToken);
      if (!portalToken) {
        return res.status(404).json({ message: "Invalid or expired access token" });
      }
      
      const submissions = await storage.getPortalSubmissions(portalToken.id);
      
      // Log activity
      await storage.logPortalActivity({
        portalTokenId: portalToken.id,
        targetContactId: portalToken.targetContactId,
        activityType: "submissions_viewed",
        activityDescription: "Submission history viewed",
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });
      
      // Return submissions without sensitive server paths
      const sanitizedSubmissions = submissions.map(submission => ({
        id: submission.id,
        originalFilename: submission.originalFilename,
        fileSize: submission.fileSize,
        fileType: submission.fileType,
        documentCategory: submission.documentCategory,
        submissionNotes: submission.submissionNotes,
        submittedAt: submission.submittedAt,
        processingStatus: submission.processingStatus,
        reviewNotes: submission.reviewNotes,
        reviewedAt: submission.reviewedAt,
      }));
      
      res.json(sanitizedSubmissions);
    } catch (error) {
      console.error("Get portal submissions error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });


  // Portal token creation (NEW route for Portal Management page)
  app.post("/api/portal-tokens", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId;
      const userCompanyId = req.session.userCompanyId;
      
      if (!userId || !userCompanyId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      console.log('[PORTAL TOKEN] Creating tokens with data:', req.body);
      
      const portalLinkSchema = z.object({
        targetCompanyId: z.number(),
        contactIds: z.array(z.number()).min(1, "At least one contact is required"),
        customMessage: z.string().optional(),
      });
      
      const tokenData = portalLinkSchema.parse(req.body);
      
      // Verify user has access to the target company
      const company = await storage.getTargetCompany(tokenData.targetCompanyId, userCompanyId);
      if (!company) {
        return res.status(404).json({ message: "Target company not found or access denied" });
      }
      
      // Check if a portal link already exists for this target company
      const existingToken = await storage.getPortalTokenByCompany(tokenData.targetCompanyId);
      if (existingToken) {
        return res.status(409).json({ 
          message: "A portal link already exists for this company. Please remove the existing link before creating a new one.",
          existingToken: {
            id: existingToken.id,
            contactId: existingToken.targetContactId,
            isActive: existingToken.isActive,
            createdAt: existingToken.createdAt
          }
        });
      }
      
      // Only allow one contact and ensure it's the primary contact
      if (tokenData.contactIds.length > 1) {
        return res.status(400).json({ message: "Only one contact is allowed per portal link" });
      }
      
      const contactId = tokenData.contactIds[0];
      
      // Verify contact exists, belongs to the company, and is primary
      const contact = await storage.getTargetContact(contactId, userCompanyId);
      if (!contact || contact.targetCompanyId !== tokenData.targetCompanyId) {
        return res.status(404).json({ message: "Contact not found or doesn't belong to the specified company" });
      }
      
      if (!contact.isPrimary) {
        return res.status(400).json({ message: "Portal links can only be created for primary contacts" });
      }
      
      // Generate unique access token
      const accessToken = randomUUID() + '-' + randomUUID();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30); // 30 days default
      
      const portalToken = await storage.createPortalAccessToken({
        targetCompanyId: tokenData.targetCompanyId,
        targetContactId: contactId,
        userCompanyId,
        accessToken,
        tokenPurpose: "document_submission",
        expiresAt,
        createdBy: userId,
        allowedActions: JSON.stringify({ upload: true, download: false, message: true }),
        customMessage: tokenData.customMessage || null,
        portalBranding: null,
      });
      
      const portalUrl = `${req.protocol}://${req.get('host')}/portal/${portalToken.accessToken}`;
      
      // Send portal access email
      try {
        console.log(`[PORTAL TOKEN] Sending email to ${contact.email} for portal access`);
        
        const emailResult = await emailService.sendPortalAccessLink(
          contact.email!,
          contact.firstName || 'Contact',
          company.companyName,
          portalUrl,
          tokenData.customMessage || 'Please access the secure document portal to submit required documents.',
          expiresAt
        );
        
        console.log(`[PORTAL TOKEN] Email sent result:`, emailResult);
        
      } catch (emailError) {
        console.error(`[PORTAL TOKEN] Failed to send email to ${contact.email}:`, emailError);
        // Continue anyway - token is created
      }
      
      const createdToken = {
        id: portalToken.id,
        accessToken: portalToken.accessToken,
        contactId: contactId,
        contactName: `${contact.firstName} ${contact.lastName}`,
        contactEmail: contact.email,
        portalUrl: portalUrl,
      };
      
      res.json({ 
        success: true, 
        message: "Portal link created and sent successfully",
        token: createdToken 
      });
      
    } catch (error) {
      console.error("Create portal tokens error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: error.errors 
        });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get portal tokens for management page
  app.get("/api/portal-tokens", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userCompanyId = req.session.userCompanyId;
      
      if (!userCompanyId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const tokens = await storage.getPortalTokensForCompany(userCompanyId);
      res.json(tokens);
    } catch (error) {
      console.error("Get portal tokens error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // LEGACY portal token creation route
  app.post("/api/portal/create-token", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId;
      const userCompanyId = req.session.userCompanyId;
      
      if (!userId || !userCompanyId) {
        return res.status(401).json({ message: "User not authenticated" });
      }
      
      const tokenSchema = z.object({
        targetCompanyId: z.number(),
        targetContactId: z.number(),
        tokenPurpose: z.string().default("document_submission"),
        expiresInDays: z.number().min(1).max(90).default(30),
        allowedActions: z.object({
          upload: z.boolean().default(true),
          download: z.boolean().default(false),
          message: z.boolean().default(true),
        }).default({ upload: true, download: false, message: true }),
        customMessage: z.string().optional(),
        portalBranding: z.object({
          companyName: z.string().optional(),
          logoUrl: z.string().optional(),
          primaryColor: z.string().optional(),
        }).optional(),
      });
      
      const tokenData = tokenSchema.parse(req.body);
      
      // Verify user has access to the target company
      const company = await storage.getTargetCompany(tokenData.targetCompanyId, userCompanyId);
      if (!company) {
        return res.status(404).json({ message: "Target company not found or access denied" });
      }
      
      // Generate unique access token
      const accessToken = randomUUID() + '-' + randomUUID();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + tokenData.expiresInDays);
      
      const portalToken = await storage.createPortalAccessToken({
        targetCompanyId: tokenData.targetCompanyId,
        targetContactId: tokenData.targetContactId,
        userCompanyId,
        accessToken,
        tokenPurpose: tokenData.tokenPurpose,
        expiresAt,
        createdBy: userId,
        allowedActions: JSON.stringify(tokenData.allowedActions),
        customMessage: tokenData.customMessage || null,
        portalBranding: tokenData.portalBranding ? JSON.stringify(tokenData.portalBranding) : null,
      });
      
      const portalUrl = `${req.protocol}://${req.get('host')}/portal/${portalToken.accessToken}`;
      
      // Send portal access email if contact email is available
      try {
        const contact = await storage.getTargetContact(tokenData.targetContactId, userCompanyId);
        const targetCompany = await storage.getTargetCompany(tokenData.targetCompanyId, userCompanyId);
        
        if (contact?.email && targetCompany) {
          const contactName = `${contact.firstName} ${contact.lastName}`.trim() || contact.email;
          await emailService.sendPortalAccessLink(
            contact.email,
            contactName,
            targetCompany.companyName,
            portalUrl,
            tokenData.customMessage,
            portalToken.expiresAt || undefined
          );
        }
      } catch (emailError) {
        console.warn('Failed to send portal access email:', emailError);
      }

      res.json({
        success: true,
        tokenId: portalToken.id,
        accessToken: portalToken.accessToken,
        portalUrl,
        expiresAt: portalToken.expiresAt,
      });
    } catch (error) {
      console.error("Create portal token error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Delete portal token (authenticated endpoint)
  app.delete("/api/portal/deactivate/:tokenId", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId;
      const userCompanyId = req.session.userCompanyId;
      const tokenId = parseInt(req.params.tokenId);
      
      if (!userId || !userCompanyId) {
        return res.status(401).json({ message: "User not authenticated" });
      }
      
      if (isNaN(tokenId)) {
        return res.status(400).json({ message: "Invalid token ID" });
      }
      
      const deleted = await storage.deletePortalToken(tokenId);
      if (!deleted) {
        return res.status(404).json({ message: "Portal token not found" });
      }
      
      res.json({ success: true, message: "Portal token deleted successfully" });
    } catch (error) {
      console.error("Delete portal token error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Review portal submission (authenticated endpoint)
  app.post("/api/portal/review/:submissionId", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId;
      const userCompanyId = req.session.userCompanyId;
      const submissionId = parseInt(req.params.submissionId);
      
      if (!userId || !userCompanyId) {
        return res.status(401).json({ message: "User not authenticated" });
      }
      
      if (isNaN(submissionId)) {
        return res.status(400).json({ message: "Invalid submission ID" });
      }
      
      const reviewSchema = z.object({
        status: z.enum(["approved", "rejected", "needs_revision"]),
        notes: z.string().optional(),
      });
      
      const reviewData = reviewSchema.parse(req.body);
      
      const reviewed = await storage.reviewDocumentSubmission(
        submissionId, 
        userId, 
        reviewData.status, 
        reviewData.notes
      );
      
      if (!reviewed) {
        return res.status(404).json({ message: "Submission not found" });
      }
      
      res.json({ 
        success: true, 
        message: "Submission reviewed successfully",
        status: reviewData.status 
      });
    } catch (error) {
      console.error("Review portal submission error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get portal tokens (authenticated endpoint)
  app.get("/api/portal/tokens", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userCompanyId = req.session.userCompanyId;
      
      if (!userCompanyId) {
        return res.status(401).json({ message: "User not authenticated" });
      }
      
      // This would need a new storage method - for now return empty array
      res.json([]);
    } catch (error) {
      console.error("Get portal tokens error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get contacts by company (authenticated endpoint)
  app.get("/api/target-companies/contacts/:companyId", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userCompanyId = req.session.userCompanyId;
      const targetCompanyId = parseInt(req.params.companyId);
      
      if (!userCompanyId) {
        return res.status(401).json({ message: "User not authenticated" });
      }
      
      if (isNaN(targetCompanyId)) {
        return res.status(400).json({ message: "Invalid company ID" });
      }
      
      const contacts = await storage.getContactsByCompany(targetCompanyId, userCompanyId);
      res.json(contacts || []);
    } catch (error) {
      console.error("Get contacts by company error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Add email test endpoint
  app.post("/api/email/test", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const testResult = await emailService.testConnection();
      res.json({ 
        success: testResult, 
        message: testResult ? "Email connection successful" : "Email connection failed" 
      });
    } catch (error) {
      console.error("Email test error:", error);
      res.status(500).json({ message: "Email test failed", error: String(error) });
    }
  });

  // Webhook endpoint to receive website analysis results (public endpoint)
  app.post("/api/webhook/website-analysis", async (req: Request, res: Response) => {
    console.log("🔔 Webhook response endpoint called!", {
      timestamp: new Date().toISOString(),
      bodyKeys: Object.keys(req.body || {}),
      bodyPreview: JSON.stringify(req.body).substring(0, 200),
      headers: req.headers['content-type']
    });
    
    try {
      const webhookSchema = z.object({
        target_company_id: z.number(),
        output: z.string(), // Markdown content from webhook
      });

      const validatedData = webhookSchema.parse(req.body);
      
      console.log("✅ Webhook data validated successfully:", {
        targetCompanyId: validatedData.target_company_id,
        outputLength: validatedData.output.length
      });
      
      // Convert \n to actual line breaks and format as markdown
      let processedOutput = validatedData.output.replace(/\\n/g, '\n');
      
      // Format as markdown with proper headings and structure
      processedOutput = processedOutput
        .split('\n')
        .map(line => {
          if (line.match(/^\d+\s+/)) {
            // Convert numbered items to markdown headings
            return line.replace(/^(\d+)\s+(.+)/, '## $1. $2');
          }
          return line;
        })
        .join('\n\n');
      
      // Update target company with website analysis
      const updated = await storage.updateTargetCompanyWebsiteAnalysis(
        validatedData.target_company_id,
        processedOutput
      );

      if (!updated) {
        console.error(`Failed to update website analysis for target company ID: ${validatedData.target_company_id}`);
        return res.status(404).json({ message: "Target company not found" });
      }

      console.log(`Website analysis updated for target company ID: ${validatedData.target_company_id}`);
      
      // Update webhook logs to show response received
      const log = webhookLogs.find(log => log.targetCompanyId === validatedData.target_company_id && log.status !== "completed");
      if (log) {
        log.status = "completed";
        log.response = {
          success: true,
          message: "Website analysis stored successfully",
          receivedAt: new Date().toISOString(),
          outputLength: processedOutput.length
        };
        log.processingTime = Date.now() - new Date(log.timestamp).getTime();
        console.log(`Webhook response received and processed for target company ${validatedData.target_company_id} (${log.processingTime}ms total)`);
      }
      
      res.json({ success: true, message: "Website analysis stored successfully" });
    } catch (error) {
      console.error("Webhook website analysis error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });



  // Get webhook configuration
  app.get("/api/webhook/config", async (req: Request, res: Response) => {
    const baseUrl = process.env.APP_URL || 
                   (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : 'http://localhost:3000');
    
    res.json({
      webhookUrl: process.env.WEBHOOK_URL || null,
      responseUrl: `${baseUrl}/api/webhook/website-analysis`
    });
  });

  // Get webhook logs
  app.get("/api/webhook/logs", async (req: Request, res: Response) => {
    res.json(webhookLogs.slice(-10).reverse()); // Return last 10 logs, newest first
  });

  // Get pending webhooks (waiting for response)
  app.get("/api/webhook/pending", async (req: Request, res: Response) => {
    const pendingWebhooks = webhookLogs.filter(log => 
      ["pending", "sent"].includes(log.status) && 
      (Date.now() - new Date(log.timestamp).getTime()) < 300000 // Less than 5 minutes old
    );
    res.json(pendingWebhooks);
  });

  // ========================
  // Public Document Download for Webhooks
  // ========================
  
  // Public download endpoint for webhook access (no authentication required)
  app.get("/api/public/documents/:id/download", async (req: Request, res: Response) => {
    try {
      const documentId = parseInt(req.params.id);
      
      // For webhook testing, we'll allow public access to documents
      // In production, you might want to implement token-based security
      const document = await storage.getDocumentByIdPublic(documentId);
      if (!document) {
        return res.status(404).json({ error: 'Document not found' });
      }
      
      // Set headers for download
      res.setHeader('Content-Disposition', `attachment; filename="${document.originalFilename}"`);
      res.setHeader('Content-Type', document.fileType);
      
      // Send file
      res.sendFile(path.resolve(document.filePath));
      
    } catch (error) {
      console.error("Public download document error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ========================
  // Portal Document Management
  // ========================
  
  // Get all documents for a company via portal token (public endpoint)
  app.get("/api/portal/:token/documents", async (req: Request, res: Response) => {
    try {
      const accessToken = req.params.token;
      
      const portalToken = await storage.validatePortalToken(accessToken);
      if (!portalToken) {
        return res.status(404).json({ message: "Invalid or expired access token" });
      }
      
      const groupedDocuments = await storage.getCompanyDocuments(portalToken.targetCompanyId, portalToken.userCompanyId);
      
      // Flatten the grouped documents into a single array for portal use
      const flatDocuments = Object.values(groupedDocuments).flat();
      
      res.json(flatDocuments);
      
    } catch (error) {
      console.error("Portal documents error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Debug route matcher to see what's hitting this endpoint
  app.all("/api/portal/:token/documents/:id", (req: Request, res: Response, next: any) => {
    console.log(`[PORTAL DELETE MATCH] ${req.method} ${req.originalUrl}`);
    next();
  });

  // Delete document via portal token (public endpoint)
  app.delete("/api/portal/:token/documents/:id", async (req: Request, res: Response) => {
    try {
      const accessToken = req.params.token;
      const documentId = parseInt(req.params.id);
      
      if (isNaN(documentId)) {
        return res.status(400).json({ message: "Invalid document ID" });
      }
      
      const portalToken = await storage.validatePortalToken(accessToken);
      if (!portalToken) {
        return res.status(404).json({ message: "Invalid or expired access token" });
      }
      
      // Get document to verify it belongs to the portal's company  
      const document = await storage.getDocument(documentId, portalToken.userCompanyId);
      
      if (!document || document.targetCompanyId !== portalToken.targetCompanyId) {
        return res.status(404).json({ message: "Document not found or access denied" });
      }
      
      // Delete the document using the same method as document library
      const success = await storage.deleteDocument(documentId, portalToken.userCompanyId);
      if (!success) {
        return res.status(500).json({ error: 'Failed to delete document' });
      }
      
      res.json({ message: "Document deleted successfully" });
      
    } catch (error) {
      console.error("Portal document deletion error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ========================
  // Server-Sent Events for Real-time Updates
  // ========================
  
  // Initialize global listeners array
  declare global {
    var documentUpdateListeners: Array<{ targetCompanyId: number; res: any }> | undefined;
  }
  
  if (!global.documentUpdateListeners) {
    global.documentUpdateListeners = [];
  }
  
  // SSE endpoint for document updates
  app.get("/api/document-updates/stream/:targetCompanyId", isAuthenticated, async (req: Request, res: Response) => {
    const targetCompanyId = parseInt(req.params.targetCompanyId);
    const userCompanyId = req.session.userCompanyId!;
    
    // Verify user has access to this company
    const company = await storage.getTargetCompany(targetCompanyId, userCompanyId);
    if (!company) {
      return res.status(404).json({ error: 'Company not found or access denied' });
    }
    
    // Set up SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });
    
    // Add this connection to the listeners
    const listener = { targetCompanyId, res };
    global.documentUpdateListeners.push(listener);
    
    // Send initial connection confirmation
    res.write(`data: ${JSON.stringify({ type: 'connected', targetCompanyId })}\n\n`);
    
    // Clean up on disconnect
    req.on('close', () => {
      const index = global.documentUpdateListeners.indexOf(listener);
      if (index > -1) {
        global.documentUpdateListeners.splice(index, 1);
      }
    });
  });

  // ========================
  // File Upload Event Routes
  // ========================

  // Get file upload events for monitoring
  app.get("/api/file-upload-events", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userCompanyId = req.session.userCompanyId;
      if (!userCompanyId) {
        return res.status(400).json({ message: "User not authenticated" });
      }

      const fileUploadEvents = await storage.getFileUploadEventsWithDetails(userCompanyId);
      res.json(fileUploadEvents);
    } catch (error) {
      console.error("Get file upload events error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Retry file upload analysis webhook for a specific document
  app.post("/api/documents/:id/retry-analysis-webhook", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const documentId = parseInt(req.params.id);
      const userCompanyId = req.session.userCompanyId;
      
      if (!userCompanyId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      // Verify user has access to this document
      const document = await storage.getDocument(documentId, userCompanyId);
      if (!document) {
        return res.status(404).json({ message: "Document not found or access denied" });
      }

      // Find the file upload event for this document
      const events = await storage.getFileUploadEventsWithDetails(userCompanyId);
      const event = events.find(e => e.documentId === documentId);
      
      if (!event) {
        return res.status(404).json({ message: "No upload event found for this document" });
      }

      // Send FILE UPLOAD ANALYSIS webhook manually (not website analysis)
      await sendFileUploadWebhook(event.id);
      
      res.json({ 
        success: true, 
        message: "File upload analysis webhook triggered successfully",
        eventId: event.id
      });
    } catch (error) {
      console.error("Retry file upload analysis webhook error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Send webhook for file upload event
  app.post("/api/file-upload-events/:eventId/send-webhook", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const eventId = parseInt(req.params.eventId);
      const userId = req.session.userId;
      const userCompanyId = req.session.userCompanyId;

      if (!userId || !userCompanyId || !eventId) {
        return res.status(400).json({ message: "Invalid request" });
      }

      // Get the file upload event
      const event = await storage.getFileUploadEvent(eventId);
      if (!event) {
        return res.status(404).json({ message: "File upload event not found" });
      }

      // Check if webhook URL is configured
      const webhookUrl = process.env.file_upload_webhook;
      if (!webhookUrl) {
        return res.status(400).json({ message: "File upload webhook URL not configured" });
      }

      const startTime = Date.now();
      
      try {
        // Prepare webhook payload
        const webhookPayload = {
          event_type: "file_uploaded",
          timestamp: new Date().toISOString(),
          file_info: {
            id: event.id,
            document_id: event.documentId,
            target_company_id: event.targetCompanyId,
            uploaded_by: event.uploadedBy,
            file_name: event.fileName,
            file_url: event.fileUrl,
            uploaded_at: event.uploadedAt,
          },
        };

        console.log(`[FILE_UPLOAD_WEBHOOK] Sending webhook for event ${eventId}:`, webhookPayload);

        // Send webhook
        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(webhookPayload),
          timeout: 30000, // 30 second timeout
        });

        const processingTime = Date.now() - startTime;
        const responseText = await response.text();
        let responseData;
        
        try {
          responseData = JSON.parse(responseText);
        } catch {
          responseData = responseText;
        }

        const webhookStatus = response.ok ? 'success' : 'failed';
        const webhookResponse = JSON.stringify({
          status: response.status,
          statusText: response.statusText,
          data: responseData,
          processingTime: processingTime
        }, null, 2);

        // Update the event with webhook response
        const updatedEvent = await storage.updateFileUploadEventWebhookStatus(
          eventId, 
          webhookStatus, 
          webhookResponse,
          new Date()
        );

        if (!updatedEvent) {
          return res.status(500).json({ message: "Failed to update webhook status" });
        }

        console.log(`[FILE_UPLOAD_WEBHOOK] Webhook sent successfully for event ${eventId}, status: ${webhookStatus}, time: ${processingTime}ms`);
        
        // Process analysis results if webhook was successful and contains analysis data
        if (response.ok && responseData && (
          responseData.document_type || // Single document type
          (Array.isArray(responseData) && responseData.length > 0 && responseData[0].document_type) || // Multiple document types
          (responseData.data && responseData.data.document_type) // Nested format
        )) {
          console.log(`[FILE_UPLOAD_WEBHOOK] Processing analysis results for event ${eventId}`);
          await processFileUploadWebhookResponse(responseData, eventId);
        }
        
        res.json({
          success: true,
          status: webhookStatus,
          response: responseData,
          processingTime: processingTime
        });

      } catch (webhookError) {
        const processingTime = Date.now() - startTime;
        const errorMessage = webhookError instanceof Error ? webhookError.message : 'Unknown webhook error';
        const webhookResponse = JSON.stringify({
          error: errorMessage,
          processingTime: processingTime
        }, null, 2);

        // Update event with error
        await storage.updateFileUploadEventWebhookStatus(
          eventId, 
          'failed', 
          webhookResponse,
          new Date()
        );

        console.error(`[FILE_UPLOAD_WEBHOOK] Webhook failed for event ${eventId}:`, webhookError);
        
        res.status(500).json({
          success: false,
          error: errorMessage,
          processingTime: processingTime
        });
      }

    } catch (error) {
      console.error("Send file upload webhook error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Webhook response handler for file upload analysis results
  app.post("/api/file-upload-events/:eventId/webhook-response", async (req: Request, res: Response) => {
    try {
      const eventId = parseInt(req.params.eventId);
      
      if (isNaN(eventId)) {
        return res.status(400).json({ message: "Invalid event ID" });
      }

      const responseData = req.body;
      console.log(`[FILE_UPLOAD_WEBHOOK] Received webhook response for event ${eventId}:`, responseData);

      // Process the analysis results
      await processFileUploadWebhookResponse(responseData, eventId);
      
      res.json({ success: true, message: "Webhook response processed successfully" });
      
    } catch (error) {
      console.error(`[FILE_UPLOAD_WEBHOOK] Failed to process webhook response:`, error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Test webhook endpoint
  app.post("/api/webhook/test", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    try {
      const testSchema = z.object({
        website: z.string().min(1, "Website URL is required").url("Please enter a valid URL (e.g., https://example.com)"),
        webhookUrl: z.string().url("Please enter a valid webhook URL").optional(),
      });

      const validatedData = testSchema.parse(req.body);
      const startTime = Date.now();
      
      // Create a temporary target company for testing
      const tempTargetCompany = await storage.createTargetCompany({
        companyName: `Test Company - ${new Date().toISOString()}`,
        industry: "Technology",
        website: validatedData.website,
        annualRevenue: 1000000,
        employeeCount: 50,
        userCompanyId: req.session.userCompanyId!,
      });

      const webhookUrlToUse = validatedData.webhookUrl || process.env.WEBHOOK_URL;
      
      if (!webhookUrlToUse) {
        return res.status(400).json({ message: "No webhook URL configured" });
      }

      const baseUrl = process.env.APP_URL || 
                     (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : 'http://localhost:3000');
      
      const payload = {
        company_name: validatedData.website,
        target_company_id: tempTargetCompany.id,
        webhook_response_url: `${baseUrl}/api/webhook/website-analysis`
      };

      let response: any = null;
      let status = "pending";
      
      try {
        const webhookResponse = await fetch(webhookUrlToUse, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        response = {
          status: webhookResponse.status,
          statusText: webhookResponse.statusText,
          headers: Object.fromEntries(webhookResponse.headers.entries()),
        };

        if (webhookResponse.ok) {
          try {
            const responseData = await webhookResponse.text();
            if (responseData) {
              response.body = responseData;
              
              // Parse response and extract analysis if present
              try {
                const parsedResponse = JSON.parse(responseData);
                if (parsedResponse.output && parsedResponse.target_company_id) {
                  console.log(`📥 Webhook returned analysis directly for company ${parsedResponse.target_company_id}`);
                  
                  // Process the analysis like webhook callback would
                  let processedOutput = parsedResponse.output.replace(/\\n/g, '\n');
                  processedOutput = processedOutput
                    .split('\n')
                    .map((line: string) => {
                      if (line.match(/^\d+\s+/)) {
                        return line.replace(/^(\d+)\s+(.+)/, '## $1. $2');
                      }
                      return line;
                    })
                    .join('\n\n');
                  
                  // Update target company with website analysis
                  const updated = await storage.updateTargetCompanyWebsiteAnalysis(
                    parsedResponse.target_company_id,
                    processedOutput
                  );
                  
                  if (updated) {
                    console.log(`✅ Website analysis stored directly for target company ID: ${parsedResponse.target_company_id}`);
                  }
                }
              } catch (parseError) {
                console.log("Response is not JSON or doesn't contain analysis data");
              }
            }
          } catch (e) {
            // Response body might be empty or invalid
          }
        }

        status = webhookResponse.ok ? "success" : "error";
      } catch (error) {
        response = {
          error: error instanceof Error ? error.message : "Unknown error"
        };
        status = "error";
      }

      const processingTime = Date.now() - startTime;

      // Log the webhook test
      const log = {
        id: logCounter++,
        timestamp: new Date().toISOString(),
        targetCompanyId: tempTargetCompany.id,
        webhookUrl: webhookUrlToUse,
        payload,
        response,
        status,
        processingTime,
      };

      webhookLogs.push(log);

      console.log(`Test webhook sent to: ${webhookUrlToUse}, Status: ${status}, Processing time: ${processingTime}ms`);

      res.json({
        success: true,
        message: "Test webhook sent successfully",
        targetCompanyId: tempTargetCompany.id,
        status,
        processingTime,
      });
    } catch (error) {
      console.error("Test webhook error:", error);
      if (error instanceof z.ZodError) {
        const firstError = error.issues[0];
        return res.status(400).json({ 
          message: firstError.message,
          field: firstError.path[0]
        });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ========================================
  // Document Analysis Results API
  // ========================================

  // Get document analysis results for a specific document
  app.get("/api/documents/:id/analysis", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const documentId = parseInt(req.params.id);
      const userCompanyId = req.session.userCompanyId!;
      
      // Verify user has access to this document
      const document = await storage.getDocument(documentId, userCompanyId);
      if (!document) {
        return res.status(404).json({ error: 'Document not found or access denied' });
      }
      
      const analysisResults = await storage.getDocumentAnalysisResults(documentId);
      res.json(analysisResults);
    } catch (error) {
      console.error("Get document analysis error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get all analysis results by document type
  app.get("/api/analysis/by-type/:documentType", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const documentType = req.params.documentType;
      const userCompanyId = req.session.userCompanyId!;
      
      const analysisResults = await storage.getDocumentAnalysisResultsByType(documentType, userCompanyId);
      res.json(analysisResults);
    } catch (error) {
      console.error("Get analysis by type error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get analysis completion status for a target company
  app.get("/api/target-companies/:id/analysis-completion", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const targetCompanyId = parseInt(req.params.id);
      const userCompanyId = req.session.userCompanyId!;
      
      const completionStatus = await storage.getAnalysisCompletionStatus(targetCompanyId, userCompanyId);
      res.json(completionStatus);
    } catch (error) {
      console.error("Get analysis completion error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get stage 1 analysis events for a target company
  app.get("/api/target-companies/:id/stage1-analysis", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const targetCompanyId = parseInt(req.params.id);
      const userCompanyId = req.session.userCompanyId!;
      
      const events = await storage.getStage1AnalysisEventsByCompany(targetCompanyId, userCompanyId);
      res.json(events);
    } catch (error) {
      console.error("Get stage 1 analysis events error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ========================================
  // Portal Link Campaigns Management
  // ========================================

  // Get all portal link campaigns for user's company
  app.get("/api/portal/campaigns", isAuthenticated, async (req: Request, res: Response) => {
    if (!req.session?.userId || !req.session.userCompanyId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      const campaigns = await storage.getPortalLinkCampaigns(req.session.userCompanyId);
      res.json(campaigns);
    } catch (error) {
      console.error("Failed to fetch portal campaigns:", error);
      res.status(500).json({ error: "Failed to fetch portal campaigns" });
    }
  });

  // Create new portal link campaign
  app.post("/api/portal/campaigns", isAuthenticated, async (req: Request, res: Response) => {
    if (!req.session?.userId || !req.session.userCompanyId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      // Clean up empty date strings to null for PostgreSQL compatibility
      const cleanData = {
        ...req.body,
        userCompanyId: req.session.userCompanyId,
        createdBy: req.session.userId,
        startDate: req.body.startDate === "" ? null : req.body.startDate,
        endDate: req.body.endDate === "" ? null : req.body.endDate
      };

      const campaignData = insertPortalLinkCampaignSchema.parse(cleanData);
      const campaign = await storage.createPortalLinkCampaign(campaignData);
      res.status(201).json(campaign);
    } catch (error) {
      console.error("Failed to create portal campaign:", error);
      res.status(500).json({ error: "Failed to create portal campaign" });
    }
  });

  // Get specific portal link campaign
  app.get("/api/portal/campaigns/:campaignId", isAuthenticated, async (req: Request, res: Response) => {
    if (!req.session?.userId || !req.session.userCompanyId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      const campaignId = parseInt(req.params.campaignId);
      const campaign = await storage.getPortalLinkCampaign(campaignId, req.session.userCompanyId);
      
      if (!campaign) {
        return res.status(404).json({ error: "Campaign not found" });
      }
      
      res.json(campaign);
    } catch (error) {
      console.error("Failed to fetch portal campaign:", error);
      res.status(500).json({ error: "Failed to fetch portal campaign" });
    }
  });

  // Update portal link campaign
  app.patch("/api/portal/campaigns/:campaignId", isAuthenticated, async (req: Request, res: Response) => {
    if (!req.session?.userId || !req.session.userCompanyId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      const campaignId = parseInt(req.params.campaignId);
      
      // Clean up empty date strings to null for PostgreSQL compatibility
      const cleanUpdates = {
        ...req.body,
        startDate: req.body.startDate === "" ? null : req.body.startDate,
        endDate: req.body.endDate === "" ? null : req.body.endDate
      };
      
      const updates = insertPortalLinkCampaignSchema.partial().parse(cleanUpdates);
      const campaign = await storage.updatePortalLinkCampaign(campaignId, req.session.userCompanyId, updates);
      
      if (!campaign) {
        return res.status(404).json({ error: "Campaign not found" });
      }
      
      res.json(campaign);
    } catch (error) {
      console.error("Failed to update portal campaign:", error);
      res.status(500).json({ error: "Failed to update portal campaign" });
    }
  });

  // Delete portal link campaign
  app.delete("/api/portal/campaigns/:campaignId", isAuthenticated, async (req: Request, res: Response) => {
    if (!req.session?.userId || !req.session.userCompanyId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      const campaignId = parseInt(req.params.campaignId);
      const deleted = await storage.deletePortalLinkCampaign(campaignId, req.session.userCompanyId);
      
      if (!deleted) {
        return res.status(404).json({ error: "Campaign not found" });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete portal campaign:", error);
      res.status(500).json({ error: "Failed to delete portal campaign" });
    }
  });

  // ========================================
  // Portal Email Templates Management
  // ========================================

  // Get all portal email templates for user's company
  app.get("/api/portal/email-templates", isAuthenticated, async (req: Request, res: Response) => {
    if (!req.session?.userId || !req.session.userCompanyId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      const templates = await storage.getPortalEmailTemplates(req.session.userCompanyId);
      res.json(templates);
    } catch (error) {
      console.error("Failed to fetch email templates:", error);
      res.status(500).json({ error: "Failed to fetch email templates" });
    }
  });

  // Create new portal email template
  app.post("/api/portal/email-templates", isAuthenticated, async (req: Request, res: Response) => {
    if (!req.session?.userId || !req.session.userCompanyId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      const templateData = insertPortalEmailTemplateSchema.parse({
        ...req.body,
        userCompanyId: req.session.userCompanyId,
        createdBy: req.session.userId
      });

      const template = await storage.createPortalEmailTemplate(templateData);
      res.status(201).json(template);
    } catch (error) {
      console.error("Failed to create email template:", error);
      res.status(500).json({ error: "Failed to create email template" });
    }
  });

  // Get specific portal email template
  app.get("/api/portal/email-templates/:templateId", isAuthenticated, async (req: Request, res: Response) => {
    if (!req.session?.userId || !req.session.userCompanyId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      const templateId = parseInt(req.params.templateId);
      const template = await storage.getPortalEmailTemplate(templateId, req.session.userCompanyId);
      
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }
      
      res.json(template);
    } catch (error) {
      console.error("Failed to fetch email template:", error);
      res.status(500).json({ error: "Failed to fetch email template" });
    }
  });

  // Update portal email template
  app.patch("/api/portal/email-templates/:templateId", isAuthenticated, async (req: Request, res: Response) => {
    if (!req.session?.userId || !req.session.userCompanyId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      const templateId = parseInt(req.params.templateId);
      const updates = insertPortalEmailTemplateSchema.partial().parse(req.body);
      
      const template = await storage.updatePortalEmailTemplate(templateId, req.session.userCompanyId, updates);
      
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }
      
      res.json(template);
    } catch (error) {
      console.error("Failed to update email template:", error);
      res.status(500).json({ error: "Failed to update email template" });
    }
  });

  // Delete portal email template
  app.delete("/api/portal/email-templates/:templateId", isAuthenticated, async (req: Request, res: Response) => {
    if (!req.session?.userId || !req.session.userCompanyId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      const templateId = parseInt(req.params.templateId);
      const deleted = await storage.deletePortalEmailTemplate(templateId, req.session.userCompanyId);
      
      if (!deleted) {
        return res.status(404).json({ error: "Template not found" });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete email template:", error);
      res.status(500).json({ error: "Failed to delete email template" });
    }
  });

  // ========================================
  // Portal Communications Log
  // ========================================

  // Get portal communications log
  app.get("/api/portal/communications", isAuthenticated, async (req: Request, res: Response) => {
    if (!req.session?.userId || !req.session.userCompanyId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      const { campaignId, targetContactId, communicationType } = req.query;
      
      const filters = {
        campaignId: campaignId ? parseInt(campaignId as string) : undefined,
        targetContactId: targetContactId ? parseInt(targetContactId as string) : undefined,
        communicationType: communicationType as string
      };

      const communications = await storage.getPortalCommunications(req.session.userCompanyId, filters);
      res.json(communications);
    } catch (error) {
      console.error("Failed to fetch portal communications:", error);
      res.status(500).json({ error: "Failed to fetch portal communications" });
    }
  });

  // ========================================
  // Portal Analytics
  // ========================================

  // Get portal analytics
  app.get("/api/portal/analytics", isAuthenticated, async (req: Request, res: Response) => {
    if (!req.session?.userId || !req.session.userCompanyId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      const { startDate, endDate, targetCompanyId, portalTokenId } = req.query;
      
      const filters = {
        startDate: startDate as string,
        endDate: endDate as string,
        targetCompanyId: targetCompanyId ? parseInt(targetCompanyId as string) : undefined,
        portalTokenId: portalTokenId ? parseInt(portalTokenId as string) : undefined
      };

      const analytics = await storage.getPortalAnalytics(req.session.userCompanyId, filters);
      res.json(analytics);
    } catch (error) {
      console.error("Failed to fetch portal analytics:", error);
      res.status(500).json({ error: "Failed to fetch portal analytics" });
    }
  });

  // ========================================
  // Send Campaign Emails
  // ========================================

  // Send campaign emails to selected contacts
  app.post("/api/portal/campaigns/:campaignId/send", isAuthenticated, async (req: Request, res: Response) => {
    if (!req.session?.userId || !req.session.userCompanyId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      const campaignId = parseInt(req.params.campaignId);
      const { targetContactIds, templateId, customSubject, customMessage } = req.body;

      // Get campaign and template
      const campaign = await storage.getPortalLinkCampaign(campaignId, req.session.userCompanyId);
      if (!campaign) {
        return res.status(404).json({ error: "Campaign not found" });
      }

      const template = templateId ? await storage.getPortalEmailTemplate(templateId, req.session.userCompanyId) : null;

      // Get target contacts
      const contacts = await Promise.all(
        targetContactIds.map((id: number) => storage.getTargetContact(id, req.session.userCompanyId!))
      );

      let successCount = 0;
      let errorCount = 0;

      // Send emails to each contact
      for (const contact of contacts) {
        if (!contact) continue;

        try {
          // For now, skip sending campaign emails since the portal token method doesn't exist
          errorCount++;
          continue;
          
          // TODO: Implement proper portal token retrieval or generation for campaign emails
          // const portalLink = `${process.env.REPLIT_DEV_DOMAIN}/portal/example-token`;

          // Prepare email content
          const subject = customSubject || template?.subject || campaign?.name || "Campaign Email";
          let message = customMessage || template?.bodyTemplate || campaign?.description || "";
          
          // Generate a placeholder portal link since we're skipping the actual send
          const portalLink = `${process.env.REPLIT_DEV_DOMAIN}/portal/example-token`;
          
          // Replace template variables
          message = message
            .replace(/\{contact_name\}/g, contact.firstName || "Contact")
            .replace(/\{company_name\}/g, contact.targetCompanyName || "")
            .replace(/\{portal_link\}/g, portalLink)
            .replace(/\{campaign_name\}/g, campaign?.name || "Campaign");

          // Send email - using sendPortalAccessLink instead
          await emailService.sendPortalAccessLink(
            contact.email!,
            contact.firstName || 'Contact',
            subject,
            portalLink,
            message,
            new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
          );

          // Log communication
          await storage.logPortalCommunication({
            campaignId: campaignId,
            targetContactId: contact.id,
            communicationType: "email",
            subject: subject,
            message: message,
            emailStatus: "sent",
            sentAt: new Date()
          });

          // Update template usage if template was used
          if (template && template.id) {
            await storage.incrementTemplateUsage(template.id);
          }

          successCount++;
        } catch (emailError) {
          console.error(`Failed to send email to ${contact.email}:`, emailError);
          errorCount++;
        }
      }

      res.json({
        success: true,
        sentCount: successCount,
        errorCount: errorCount,
        totalContacts: contacts.length
      });

    } catch (error) {
      console.error("Failed to send campaign emails:", error);
      res.status(500).json({ error: "Failed to send campaign emails" });
    }
  });

  // ========================================
  // STAGED DOCUMENT REQUIREMENTS SYSTEM
  // ========================================

  // Initialize standardized document requirements for a company
  app.post("/api/companies/:id/requirements/initialize-standard", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const targetCompanyId = parseInt(req.params.id);
      const userId = req.session.userId;
      const userCompanyId = req.session.userCompanyId;

      if (isNaN(targetCompanyId) || !userId || !userCompanyId) {
        return res.status(400).json({ message: "Invalid company ID or user not authenticated" });
      }

      const result = await storage.initializeStandardRequirements(targetCompanyId, userId);
      res.json(result);
    } catch (error) {
      console.error("Initialize standard requirements error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get company document requirements (standardized)
  app.get("/api/companies/:id/requirements", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const targetCompanyId = parseInt(req.params.id);
      const userCompanyId = req.session.userCompanyId;
      const stage = req.query.stage ? parseInt(req.query.stage as string) : null;

      if (isNaN(targetCompanyId) || !userCompanyId) {
        return res.status(400).json({ message: "Invalid company ID or user not authenticated" });
      }

      const requirements = await storage.getCompanyDocumentRequirements(targetCompanyId, userCompanyId, stage);
      res.json(requirements);
    } catch (error) {
      console.error("Get company document requirements error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });



  // Get stage progression status
  app.get("/api/companies/:id/stage-progression", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const targetCompanyId = parseInt(req.params.id);
      const userCompanyId = req.session.userCompanyId;

      if (isNaN(targetCompanyId) || !userCompanyId) {
        return res.status(400).json({ message: "Invalid company ID or user not authenticated" });
      }

      const progression = await storage.getDocumentStageProgression(targetCompanyId, userCompanyId);
      res.json(progression);
    } catch (error) {
      console.error("Get stage progression error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });



  // Update specific company requirement
  app.put("/api/companies/:id/requirements/:reqId", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const targetCompanyId = parseInt(req.params.id);
      const requirementId = parseInt(req.params.reqId);
      const userId = req.session.userId;

      if (isNaN(targetCompanyId) || isNaN(requirementId) || !userId) {
        return res.status(400).json({ message: "Invalid parameters or user not authenticated" });
      }

      const updates = req.body;
      const requirement = await storage.updateCompanyRequirement(requirementId, updates, userId);

      res.json(requirement);
    } catch (error) {
      console.error("Update company requirement error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });



  // Document tracking endpoints for enhanced portal functionality
  
  // Get Stage 1 requirements with progress for portal display
  app.get('/api/portal/:token/requirements/stage1', async (req: Request, res: Response) => {
    try {
      const { token } = req.params;
      
      // Verify portal token and get company information
      const tokenData = await storage.getValidPortalToken(token);
      if (!tokenData) {
        return res.status(404).json({ message: 'Invalid or expired portal token' });
      }
      
      // Get Stage 1 requirements with submission status
      const requirements = await storage.getStage1RequirementsForPortal(tokenData.target_company_id);
      
      // Calculate overall progress
      const totalRequirements = requirements.length;
      const completedRequirements = requirements.filter(req => 
        req.requirement_status === 'submitted' || req.requirement_status === 'approved'
      ).length;
      
      const progressPercentage = totalRequirements > 0 
        ? Math.round((completedRequirements / totalRequirements) * 100)
        : 0;
      
      res.json({
        company_name: tokenData.company_name,
        total_requirements: totalRequirements,
        completed_requirements: completedRequirements,
        progress_percentage: progressPercentage,
        overall_status: completedRequirements === totalRequirements ? 'complete' : 
                       completedRequirements > 0 ? 'in_progress' : 'not_started',
        requirements: requirements,
        portal_expires_at: tokenData.expires_at
      });
      
    } catch (error) {
      console.error('Portal requirements error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // REMOVED DUPLICATE ROUTE - Using the correct one below with portalUpload

  // Get overall progress for portal
  app.get('/api/portal/:token/progress', async (req: Request, res: Response) => {
    try {
      const { token } = req.params;
      
      // Verify portal token
      const tokenData = await storage.getValidPortalToken(token);
      if (!tokenData) {
        return res.status(404).json({ message: 'Invalid or expired portal token' });
      }
      
      // Get progress
      const progress = await storage.getStage1Progress(tokenData.target_company_id);
      
      res.json({
        company_name: tokenData.company_name,
        ...progress
      });
      
    } catch (error) {
      console.error('Portal progress error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Internal document tracking endpoints
  
  // Get detailed progress for company (internal users)
  app.get('/api/companies/:id/requirements/progress', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const targetCompanyId = parseInt(req.params.id);
      const userCompanyId = req.session.userCompanyId;
      
      // Verify company access
      const company = await storage.getTargetCompany(targetCompanyId, userCompanyId!);
      if (!company) {
        return res.status(404).json({ message: 'Company not found' });
      }
      
      // Get detailed progress
      const progress = await storage.getDetailedCompanyProgress(targetCompanyId);
      
      res.json({
        company: company,
        ...progress
      });
      
    } catch (error) {
      console.error('Company progress error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Get document progress dashboard (internal users)
  app.get('/api/dashboard/document-progress', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userCompanyId = req.session.userCompanyId;
      
      const result = await storage.getDocumentProgressDashboard(userCompanyId!);
      
      res.json(result);
      
    } catch (error) {
      console.error('Document progress dashboard error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Enhanced Portal API Routes for Stage 1 Document Tracking

  // Get Stage 1 requirements and progress for external portal
  app.get('/api/portal/:token/requirements/stage1', async (req: Request, res: Response) => {
    try {
      const token = req.params.token;
      
      // Validate token and get company data
      const tokenData = await storage.getValidPortalToken(token);
      if (!tokenData) {
        return res.status(401).json({ message: 'Invalid or expired portal token' });
      }

      // Get simple portal data
      const portalData = await storage.getSimplePortalData(tokenData.targetCompanyId);

      res.json(portalData);
    } catch (error) {
      console.error('Portal requirements error:', error);
      res.status(500).json({ message: 'Failed to load requirements' });
    }
  });

  // REMOVED: Old portal upload route - now using unified upload process via /api/portal/:token/submit

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
