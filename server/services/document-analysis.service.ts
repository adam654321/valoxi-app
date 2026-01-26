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
    const completedTypes = Array.from(new Set(
      analysisTypes.filter(a => a.documentCategory !== 'Company Accounts' && requiredTypes.includes(a.documentType)).map(a => a.documentType)
    ));
    const missingTypes = requiredTypes.filter(t => !completedTypes.includes(t));
    const completedCount = completedTypes.length;
    const totalCount = requiredTypes.length;
    return {
      completedTypes, missingTypes,
      isComplete: missingTypes.length === 0,
      completionPercentage: Math.round((completedCount / totalCount) * 100),
      completedCount, totalCount,
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
