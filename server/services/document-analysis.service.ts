import { documentAnalysisRepository } from '../repositories/document-analysis.repository';
import { targetCompaniesRepository } from '../repositories/target-companies.repository';
import { NotFoundError, ForbiddenError } from '../utils/errors';
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
    const company = await targetCompaniesRepository.getById(doc.targetCompanyId, userCompanyId);
    if (!company) throw new ForbiddenError('Access denied');
    return await documentAnalysisRepository.getAnalysisResultsByDocumentId(documentId);
  }

  async getAnalysisByType(documentType: string, userCompanyId: number): Promise<DocumentAnalysisResult[]> {
    return await documentAnalysisRepository.getAnalysisResultsByType(documentType, userCompanyId);
  }

  async getAnalysisByTypeForCompany(documentType: string, targetCompanyId: number, userCompanyId: number): Promise<DocumentAnalysisResult[]> {
    const company = await targetCompaniesRepository.getById(targetCompanyId, userCompanyId);
    if (!company) throw new ForbiddenError('Company not found or access denied');
    return await documentAnalysisRepository.getAnalysisResultsByTypeForCompany(documentType, targetCompanyId);
  }

  async getAllAnalysisForCompany(targetCompanyId: number, userCompanyId: number): Promise<DocumentAnalysisResult[]> {
    const company = await targetCompaniesRepository.getById(targetCompanyId, userCompanyId);
    if (!company) throw new ForbiddenError('Company not found or access denied');
    return await documentAnalysisRepository.getAllAnalysisResultsForCompany(targetCompanyId);
  }

  async getCompletionStatus(targetCompanyId: number, userCompanyId: number): Promise<AnalysisCompletionStatus> {
    const company = await targetCompaniesRepository.getById(targetCompanyId, userCompanyId);
    if (!company) throw new ForbiddenError('Company not found or access denied');
    return await this.calculateCompletionStatus(targetCompanyId);
  }

  private async calculateCompletionStatus(targetCompanyId: number): Promise<AnalysisCompletionStatus> {
    const requiredTypes = ['asset_register', 'sales_ledger', 'staff_matrix', 'profit_and_loss', 'balance_sheet'];
    const categoryToType: Record<string, string> = {
      'Asset Register': 'asset_register',
      'Sales Ledger': 'sales_ledger', 
      'Staff Matrix': 'staff_matrix',
      'Profit & Loss': 'profit_and_loss',
      'Balance Sheet': 'balance_sheet',
    };
    
    // Get ALL documents for this company (immediate feedback on upload)
    const allDocuments = await documentAnalysisRepository.getAllDocumentsForCompany(targetCompanyId);
    
    // Get analysis results to verify/override categorization
    const analysisTypes = await documentAnalysisRepository.getDistinctAnalysisTypesForCompany(targetCompanyId);
    
    // Build a map of document ID to its analyzed type
    const analyzedDocTypes = new Map<number, string>();
    for (const result of analysisTypes) {
      if (result.documentId && result.documentType) {
        analyzedDocTypes.set(result.documentId, result.documentType);
      }
    }
    
    // Count completed types - use analysis result if available, otherwise use document category
    const completedTypesSet = new Set<string>();
    let companyAccountsCount = 0;
    
    for (const doc of allDocuments) {
      const analyzedType = analyzedDocTypes.get(doc.id);
      
      if (doc.documentCategory === 'Company Accounts') {
        // Company Accounts - count towards the 5 company accounts slots
        companyAccountsCount++;
      } else if (analyzedType && requiredTypes.includes(analyzedType)) {
        // Has analysis - use the analyzed type
        completedTypesSet.add(analyzedType);
      } else if (doc.documentCategory) {
        // No analysis yet - use document category for immediate feedback
        const mappedType = categoryToType[doc.documentCategory];
        if (mappedType && requiredTypes.includes(mappedType)) {
          completedTypesSet.add(mappedType);
        }
      }
    }
    
    const completedTypes = Array.from(completedTypesSet);
    
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
    const company = await targetCompaniesRepository.getById(targetCompanyId, userCompanyId);
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
