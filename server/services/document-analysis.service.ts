import { documentAnalysisRepository } from '../repositories/document-analysis.repository';
import { NotFoundError, ForbiddenError } from '../utils/errors';
import { storage } from '../storage';
import type { DocumentAnalysisResult, InsertDocumentAnalysisResult } from '@shared/schema';

interface AnalysisCompletionStatus {
  completedTypes: string[];
  missingTypes: string[];
  isComplete: boolean;
  completionPercentage: number;
  completedCount: number;
  totalCount: number;
}

export class DocumentAnalysisService {
  async getAnalysisForDocument(documentId: number, userCompanyId: number): Promise<DocumentAnalysisResult[]> {
    const doc = await documentAnalysisRepository.getDocumentById(documentId);
    if (!doc) throw new NotFoundError('Document not found');
    const company = await storage.getTargetCompany(doc.targetCompanyId, userCompanyId);
    if (!company) throw new ForbiddenError('Access denied');
    return await documentAnalysisRepository.getAnalysisResultsByDocumentId(documentId);
  }

  async getAnalysisByType(documentType: string, userCompanyId: number): Promise<DocumentAnalysisResult[]> {
    return await documentAnalysisRepository.getAnalysisResultsByType(documentType, userCompanyId);
  }

  async getAnalysisByTypeForCompany(documentType: string, targetCompanyId: number, userCompanyId: number): Promise<DocumentAnalysisResult[]> {
    const company = await storage.getTargetCompany(targetCompanyId, userCompanyId);
    if (!company) throw new ForbiddenError('Company not found or access denied');
    return await documentAnalysisRepository.getAnalysisResultsByTypeForCompany(documentType, targetCompanyId);
  }

  async getAllAnalysisForCompany(targetCompanyId: number, userCompanyId: number): Promise<DocumentAnalysisResult[]> {
    const company = await storage.getTargetCompany(targetCompanyId, userCompanyId);
    if (!company) throw new ForbiddenError('Company not found or access denied');
    return await documentAnalysisRepository.getAllAnalysisResultsForCompany(targetCompanyId);
  }

  async getCompletionStatus(targetCompanyId: number, userCompanyId: number): Promise<AnalysisCompletionStatus> {
    const company = await storage.getTargetCompany(targetCompanyId, userCompanyId);
    if (!company) throw new ForbiddenError('Company not found or access denied');
    return await this.calculateCompletionStatus(targetCompanyId);
  }

  private async calculateCompletionStatus(targetCompanyId: number): Promise<AnalysisCompletionStatus> {
    const requiredTypes = ['asset_register', 'sales_ledger', 'staff_matrix', 'profit_and_loss', 'balance_sheet'];
    const analysisTypes = await documentAnalysisRepository.getDistinctAnalysisTypesForCompany(targetCompanyId);
    
    // Filter out webhook-detected types for documents that were uploaded as "Company Accounts"
    const completedTypes = Array.from(new Set(
      analysisTypes
        .filter(a => a.documentCategory !== 'Company Accounts' && requiredTypes.includes(a.documentType))
        .map(a => a.documentType)
    ));
    
    // Count company accounts documents with company_accounts analysis
    const companyAccountsResults = await documentAnalysisRepository.getCompanyAccountsAnalysisCount(targetCompanyId);
    const companyAccountsCount = companyAccountsResults;
    
    // We need 5 company accounts documents + 5 main document types = 10 total
    const totalRequired = 10;
    const completedCount = completedTypes.length + Math.min(companyAccountsCount, 5); // Cap company accounts at 5
    
    // Missing regular types
    const missingTypes = requiredTypes.filter(type => !completedTypes.includes(type));
    
    // Add missing company accounts to missing types
    const missingCompanyAccounts = Math.max(0, 5 - companyAccountsCount);
    for (let i = 0; i < missingCompanyAccounts; i++) {
      missingTypes.push(`company_accounts_${i + 1}`);
    }
    
    // Build completed types array including company accounts
    const allCompletedTypes = [
      ...completedTypes,
      ...Array(Math.min(companyAccountsCount, 5)).fill('company_accounts').map((_, i) => `company_accounts_${i + 1}`)
    ];
    
    return {
      completedTypes: allCompletedTypes,
      missingTypes,
      isComplete: completedCount === totalRequired,
      completionPercentage: Math.round((completedCount / totalRequired) * 100),
      completedCount,
      totalCount: totalRequired,
    };
  }

  async getAnalysisSummaryForCompany(targetCompanyId: number, userCompanyId: number): Promise<Record<string, any>> {
    const company = await storage.getTargetCompany(targetCompanyId, userCompanyId);
    if (!company) throw new ForbiddenError('Company not found or access denied');
    const allResults = await documentAnalysisRepository.getAllAnalysisResultsForCompany(targetCompanyId);
    const byType: Record<string, DocumentAnalysisResult[]> = {};
    for (const result of allResults) {
      if (!byType[result.documentType]) byType[result.documentType] = [];
      byType[result.documentType].push(result);
    }
    const completion = await this.calculateCompletionStatus(targetCompanyId);
    return { byType, completion, totalResults: allResults.length };
  }

  async createAnalysisResult(result: InsertDocumentAnalysisResult): Promise<DocumentAnalysisResult> {
    return await documentAnalysisRepository.createAnalysisResult(result);
  }
}

export const documentAnalysisService = new DocumentAnalysisService();
