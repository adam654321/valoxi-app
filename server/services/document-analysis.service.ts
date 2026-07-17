import { documentAnalysisRepository } from '../repositories/document-analysis.repository';
import { targetCompaniesRepository } from '../repositories/target-companies.repository';
import { NotFoundError, ForbiddenError } from '../utils/errors';
import type { DocumentAnalysisResult, InsertDocumentAnalysisResult } from '@shared/schema';
import { computeCompletionStatus, type CompletionStatus } from '../../shared/utils/completion-status';

type AnalysisCompletionStatus = CompletionStatus;

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
    return await this.calculateCompletionStatus_impl(targetCompanyId);
  }

  /**
   * Server-side internal method — no user access check.
   * Used by file-analysis service to check completion after each upload.
   */
  async calculateCompletionStatusInternal(targetCompanyId: number): Promise<AnalysisCompletionStatus> {
    return await this.calculateCompletionStatus_impl(targetCompanyId);
  }

  /**
   * Returns document IDs that exist in the documents table for this company
   * but do NOT have any corresponding rows in document_analysis_results.
   * Used to identify documents that need their analysis re-triggered.
   */
  async getDocumentsMissingAnalysis(targetCompanyId: number): Promise<number[]> {
    const allDocuments = await documentAnalysisRepository.getAllDocumentsForCompany(targetCompanyId);
    const missingAnalysis: number[] = [];
    
    for (const doc of allDocuments) {
      const analysisResults = await documentAnalysisRepository.getAnalysisResultsByDocumentId(doc.id);
      if (!analysisResults || analysisResults.length === 0) {
        missingAnalysis.push(doc.id);
      }
    }
    
    return missingAnalysis;
  }

  private async calculateCompletionStatus_impl(targetCompanyId: number): Promise<AnalysisCompletionStatus> {
    const allDocuments = await documentAnalysisRepository.getAllDocumentsForCompany(targetCompanyId);
    const analysisTypes = await documentAnalysisRepository.getDistinctAnalysisTypesForCompany(targetCompanyId);
    return computeCompletionStatus(allDocuments, analysisTypes);
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
    const completion = await this.calculateCompletionStatus_impl(targetCompanyId);
    return { byType, completion, totalResults: allResults.length };
  }

  async createAnalysisResult(result: InsertDocumentAnalysisResult): Promise<DocumentAnalysisResult> {
    return await documentAnalysisRepository.createAnalysisResult(result);
  }
}

export const documentAnalysisService = new DocumentAnalysisService();
