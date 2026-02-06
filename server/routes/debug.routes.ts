import { Router, Request, Response } from 'express';
import { eq, desc } from 'drizzle-orm';
import { db } from '../db';
import { stage1AnalysisEvents } from '@shared/schema';
import { sendSuccess, sendError } from '../utils/response';
import { documentAnalysisRepository } from '../repositories/document-analysis.repository';
import { stage1AnalysisService } from '../services/stage1-analysis.service';
import { stage1AnalysisRepository } from '../repositories/stage1-analysis.repository';

const router = Router();

router.get('/stage1-events/:id', async (req: Request, res: Response) => {
  try {
    const targetCompanyId = parseInt(req.params.id);
    
    const events = await db
      .select()
      .from(stage1AnalysisEvents)
      .where(eq(stage1AnalysisEvents.targetCompanyId, targetCompanyId))
      .orderBy(desc(stage1AnalysisEvents.createdAt));
    
    console.log(`[DEBUG] Found ${events.length} Stage 1 analysis events for company ${targetCompanyId}`);
    
    sendSuccess(res, { 
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
    sendError(res, error);
  }
});

router.post('/trigger-stage1/:id', async (req: Request, res: Response) => {
  try {
    const targetCompanyId = parseInt(req.params.id);

    console.log(`[MANUAL_TRIGGER] Starting Stage 1 analysis check for company ${targetCompanyId}`);
    
    const categoryCheck = await stage1AnalysisService.checkStage1RequirementsByCategory(targetCompanyId);
    console.log(`[MANUAL_TRIGGER] Category check result:`, categoryCheck);
    
    const companyAccountsData = await documentAnalysisRepository.getAnalysisResultsByTypeForCompany('company_accounts', targetCompanyId);
    const balanceSheetData = await documentAnalysisRepository.getAnalysisResultsByTypeForCompany('balance_sheet', targetCompanyId);
    const profitLossData = await documentAnalysisRepository.getAnalysisResultsByTypeForCompany('profit_and_loss', targetCompanyId);
    const assetRegisterData = await documentAnalysisRepository.getAnalysisResultsByTypeForCompany('asset_register', targetCompanyId);
    const salesLedgerData = await documentAnalysisRepository.getAnalysisResultsByTypeForCompany('sales_ledger', targetCompanyId);
    const staffMatrixData = await documentAnalysisRepository.getAnalysisResultsByTypeForCompany('staff_matrix', targetCompanyId);
    
    const analysisDataCounts = {
      company_accounts: companyAccountsData.length,
      balance_sheet: balanceSheetData.length,
      profit_and_loss: profitLossData.length,
      asset_register: assetRegisterData.length,
      sales_ledger: salesLedgerData.length,
      staff_matrix: staffMatrixData.length
    };
    
    console.log(`[MANUAL_TRIGGER] Available analysis data counts:`, analysisDataCounts);
    
    console.log(`[MANUAL_TRIGGER] Calling checkAndTriggerStage1Analysis for company ${targetCompanyId} with bypass=true`);
    await stage1AnalysisService.checkAndTriggerStage1Analysis(targetCompanyId, 2, true);
    console.log(`[MANUAL_TRIGGER] Completed checkAndTriggerStage1Analysis for company ${targetCompanyId}`);
    
    sendSuccess(res, { 
      message: 'Stage 1 analysis check triggered (bypassed requirements)',
      categoryCheck,
      analysisDataCounts
    });
  } catch (error) {
    console.error('[MANUAL_TRIGGER] Error triggering Stage 1 analysis:', error);
    sendError(res, error);
  }
});

if (process.env.NODE_ENV !== 'production') {
  router.post('/test/fresh-stage1-analysis/:companyId', async (req: Request, res: Response) => {
    try {
      const companyId = parseInt(req.params.companyId);
      if (isNaN(companyId)) {
        return res.status(400).json({ message: 'Invalid company ID' });
      }

      console.log(`[TEST] Manually triggering fresh Stage 1 analysis for company ${companyId}`);

      setTimeout(() => {
        stage1AnalysisService.checkAndTriggerStage1Analysis(companyId, 1);
      }, 100);

      sendSuccess(res, {
        success: true,
        message: `Fresh Stage 1 analysis triggered for company ${companyId}`
      });
    } catch (error) {
      console.error('Manual fresh analysis trigger error:', error);
      sendError(res, error);
    }
  });

  router.post('/test/inject-detailed-analysis/:eventId', async (req: Request, res: Response) => {
    try {
      const eventId = parseInt(req.params.eventId);
      const detailedData = req.body;

      if (isNaN(eventId)) {
        return res.status(400).json({ message: 'Invalid event ID' });
      }

      if (!detailedData) {
        return res.status(400).json({ message: 'No data provided' });
      }

      console.log(`[TEST] Injecting detailed analysis data for event ${eventId}`);

      await stage1AnalysisRepository.updateDetailedData(eventId, detailedData);

      console.log(`[TEST] Successfully stored detailed analysis data for event ${eventId}`);

      sendSuccess(res, {
        success: true,
        message: `Detailed analysis data injected for event ${eventId}`
      });
    } catch (error) {
      console.error('Failed to inject detailed analysis data:', error);
      sendError(res, error);
    }
  });
}

export default router;
