import { stage1AnalysisRepository, type Stage1DocumentFile } from '../repositories/stage1-analysis.repository';
import { targetCompaniesRepository } from '../repositories/target-companies.repository';
import { runStage1GeminiAnalysis, getMimeTypeForFile, type FileInfo } from '../gemini-stage1-service';
import { NotFoundError } from '../utils/errors';
import { eventBus } from './event-bus.service';
import { config } from '../config';
import type { Stage1AnalysisEvent } from '@shared/schema';

interface CategoryCheckResult {
  shouldTrigger: boolean;
  status: string;
  categoryCounts?: Record<string, number>;
}

export class Stage1AnalysisService {
  async checkStage1RequirementsByCategory(targetCompanyId: number): Promise<CategoryCheckResult> {
    try {
      const companyAccountsCount = await stage1AnalysisRepository.getDocumentCountByCategory(targetCompanyId, 'Company Accounts');
      const requiredCategories = ['Profit & Loss', 'Balance Sheet', 'Staff Matrix', 'Sales Ledger', 'Asset Register'];
      const categoryCounts: Record<string, number> = {};
      for (const category of requiredCategories) {
        categoryCounts[category] = await stage1AnalysisRepository.getDocumentCountByCategory(targetCompanyId, category);
      }
      if (categoryCounts['Balance Sheet'] === 0) {
        const balanceSheetAnalysis = await stage1AnalysisRepository.getDocumentAnalysisResultsByType('balance_sheet', targetCompanyId);
        if (balanceSheetAnalysis.length > 0) categoryCounts['Balance Sheet'] = balanceSheetAnalysis.length;
      }
      const hasCompanyAccounts = companyAccountsCount >= 5;
      const hasAllCategories = requiredCategories.every(category => categoryCounts[category] > 0);
      const status = `Company Accounts: ${companyAccountsCount}/5, ` + requiredCategories.map(cat => `${cat}: ${categoryCounts[cat]}`).join(', ');
      return { shouldTrigger: hasCompanyAccounts && hasAllCategories, status, categoryCounts: { 'Company Accounts': companyAccountsCount, ...categoryCounts } };
    } catch (error) {
      console.error(`[STAGE1_ANALYSIS] Error checking category requirements:`, error);
      return { shouldTrigger: false, status: 'Error checking requirements' };
    }
  }

  async checkAndTriggerStage1Analysis(targetCompanyId: number, triggeredBy: number, bypassRequirements = false): Promise<{ triggered: boolean; eventId?: number; message: string }> {
    console.log(`[STAGE1_ANALYSIS] Checking completion status for company ${targetCompanyId}${bypassRequirements ? ' (bypassing requirements)' : ''}`);
    const targetCompany = await stage1AnalysisRepository.getTargetCompany(targetCompanyId);
    if (!targetCompany) throw new NotFoundError(`Company ${targetCompanyId} not found`);
    // When bypassRequirements is true, always allow re-triggering (user explicitly wants to run analysis again)
    if (!bypassRequirements) {
      const existingEvent = await stage1AnalysisRepository.getLatestStage1AnalysisEvent(targetCompanyId);
      if (existingEvent && existingEvent.webhookStatus === 'success') {
        const latestDocumentUpload = await stage1AnalysisRepository.getLatestDocumentUploadTime(targetCompanyId);
        if (latestDocumentUpload && existingEvent.createdAt) {
          const docUploadTime = new Date(latestDocumentUpload).getTime();
          const eventCreatedTime = new Date(existingEvent.createdAt).getTime();
          if (docUploadTime <= eventCreatedTime) {
            return { triggered: false, message: 'Stage 1 analysis already completed. No new documents since then.' };
          }
        } else {
          return { triggered: false, message: 'Stage 1 analysis already completed successfully.' };
        }
      }
    }
    if (!bypassRequirements) {
      const categoryCheck = await this.checkStage1RequirementsByCategory(targetCompanyId);
      if (!categoryCheck.shouldTrigger) {
        return { triggered: false, message: `Stage 1 requirements not met. Status: ${categoryCheck.status}` };
      }
    }
    const analysisData = await this.getConcatenatedAnalysisData(targetCompanyId, targetCompany);
    const stage1Event = await stage1AnalysisRepository.createStage1AnalysisEvent({ targetCompanyId, triggeredBy, concatenatedData: analysisData });
    console.log(`[STAGE1_ANALYSIS] Created stage 1 analysis event ${stage1Event.id} for company ${targetCompanyId}`);
    const sector = targetCompany.industry || '';
    setTimeout(() => { this.runGeminiAnalysis(stage1Event.id, targetCompanyId, targetCompany.companyName, sector); }, 100);
    
    // Auto-move company to "Under Review" stage when analysis is triggered
    targetCompaniesRepository.update(targetCompanyId, { stage: 'Under Review' }, targetCompany.userCompanyId).catch(err => {
      console.error(`[STAGE1_ANALYSIS] Failed to update company stage for analysis event ${stage1Event.id}:`, err.message);
    });
    
    return { triggered: true, eventId: stage1Event.id, message: 'Stage 1 analysis triggered successfully' };
  }

  private async getConcatenatedAnalysisData(targetCompanyId: number, targetCompany: any): Promise<any> {
    const [companyAccountsData, assetRegisterData, salesLedgerData, staffMatrixData, profitLossData, balanceSheetData] = await Promise.all([
      stage1AnalysisRepository.getDocumentAnalysisResultsByType('company_accounts', targetCompanyId),
      stage1AnalysisRepository.getDocumentAnalysisResultsByType('asset_register', targetCompanyId),
      stage1AnalysisRepository.getDocumentAnalysisResultsByType('sales_ledger', targetCompanyId),
      stage1AnalysisRepository.getDocumentAnalysisResultsByType('staff_matrix', targetCompanyId),
      stage1AnalysisRepository.getDocumentAnalysisResultsByType('profit_and_loss', targetCompanyId),
      stage1AnalysisRepository.getDocumentAnalysisResultsByType('balance_sheet', targetCompanyId),
    ]);
    const sector = targetCompany.industry || '';
    const subSector = targetCompany.subSector || '';
    return {
      company_name: targetCompany.companyName,
      sector, sub_sector: subSector || null, industry: subSector ? `${sector}- ${subSector}` : sector || null,
      company_accounts: companyAccountsData.map(d => d.analysisData).filter(Boolean),
      asset_register: assetRegisterData.map(d => d.analysisData).filter(Boolean),
      sales_ledger: salesLedgerData.map(d => d.analysisData).filter(Boolean),
      staff_matrix: staffMatrixData.map(d => d.analysisData).filter(Boolean),
      profit_and_loss: profitLossData.map(d => this.enhanceProfitLossData(d.analysisData)).filter(Boolean),
      balance_sheet: balanceSheetData.map(d => d.analysisData).filter(Boolean),
      timestamp: new Date().toISOString(),
      company_id: targetCompanyId
    };
  }

  private enhanceProfitLossData(analysisData: any): any {
    if (!analysisData) return analysisData;
    try {
      const enhanced = JSON.parse(JSON.stringify(analysisData));
      const calculateRatios = (pl: any) => {
        if (pl.revenue && pl.gross_profit && pl.revenue > 0) pl.gross_margin_percentage = Number(((pl.gross_profit / pl.revenue) * 100).toFixed(2));
        if (pl.revenue && pl.net_profit && pl.revenue > 0) pl.net_margin_percentage = Number(((pl.net_profit / pl.revenue) * 100).toFixed(2));
        if (pl.operating_profit && pl.interest_payable && pl.interest_payable > 0) pl.interest_coverage_ratio = Number((pl.operating_profit / pl.interest_payable).toFixed(2));
      };
      if (enhanced.years && typeof enhanced.years === 'object') {
        Object.keys(enhanced.years).forEach(year => { if (enhanced.years[year].profit_and_loss) calculateRatios(enhanced.years[year].profit_and_loss); });
      }
      if (enhanced.profit_and_loss) calculateRatios(enhanced.profit_and_loss);
      return enhanced;
    } catch { return analysisData; }
  }

  async runGeminiAnalysis(eventId: number, targetCompanyId: number, companyName: string, sector: string): Promise<void> {
    console.log(`[GEMINI_STAGE1_ANALYSIS] Starting Gemini analysis for event ${eventId}, company ${companyName}`);
    try {
      const documentFiles = await stage1AnalysisRepository.getStage1DocumentFiles(targetCompanyId);
      if (documentFiles.length === 0) {
        await stage1AnalysisRepository.updateStage1AnalysisEventStatus(eventId, 'failed', 'No documents found for analysis', new Date());
        return;
      }
      const baseUrl = config.baseUrl;
      const files: FileInfo[] = documentFiles.map(doc => ({ fileUrl: `${baseUrl}/api/public/documents/${doc.documentId}/download`, mimeType: getMimeTypeForFile(doc.mimeType), category: doc.category }));
      console.log(`[GEMINI_STAGE1_ANALYSIS] File URLs:`, files.map(f => f.fileUrl));
      const result = await runStage1GeminiAnalysis({ companyName, sector, files });
      if (result.success && result.markdown) {
        await stage1AnalysisRepository.updateStage1AnalysisEventStatus(eventId, 'success', result.markdown, new Date(), result.processingTime, result.usageMetadata);
        console.log(`[GEMINI_STAGE1_ANALYSIS] Analysis completed successfully for event ${eventId}`);
        this.notifyClients(targetCompanyId, eventId);
      } else {
        await stage1AnalysisRepository.updateStage1AnalysisEventStatus(eventId, 'failed', JSON.stringify({ error: result.error || 'Unknown error' }), new Date(), result.processingTime);
        console.error(`[GEMINI_STAGE1_ANALYSIS] Analysis failed for event ${eventId}: ${result.error}`);
      }
    } catch (error) {
      console.error(`[GEMINI_STAGE1_ANALYSIS] Error running analysis for event ${eventId}:`, error);
      await stage1AnalysisRepository.updateStage1AnalysisEventStatus(eventId, 'failed', JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), new Date());
    }
  }

  private notifyClients(targetCompanyId: number, eventId: number): void {
    eventBus.emit('document:update', {
      type: 'stage1_completed',
      targetCompanyId,
      eventId,
      timestamp: new Date(),
    });
  }

  async getStage1AnalysisEvents(targetCompanyId: number): Promise<Stage1AnalysisEvent[]> {
    return await stage1AnalysisRepository.getStage1AnalysisEventsByCompany(targetCompanyId);
  }

  async getLatestStage1Analysis(targetCompanyId: number): Promise<Stage1AnalysisEvent | null> {
    return await stage1AnalysisRepository.getLatestStage1AnalysisEvent(targetCompanyId);
  }
}

export const stage1AnalysisService = new Stage1AnalysisService();
