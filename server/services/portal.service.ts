import { randomUUID } from 'crypto';
import { portalRepository } from '../repositories/portal.repository';
import { BadRequestError, NotFoundError, ForbiddenError } from '../utils/errors';
import type { PortalAccessToken, ExternalDocumentSubmission, InsertPortalAccessToken, InsertExternalDocumentSubmission } from '@shared/schema';

export class PortalService {
  async validateToken(accessToken: string, ipAddress?: string, userAgent?: string): Promise<PortalAccessToken> {
    if (!accessToken) throw new BadRequestError('Access token is required');
    const token = await portalRepository.validateToken(accessToken);
    if (!token) throw new NotFoundError('Invalid or expired access token');
    await portalRepository.updateTokenAccess(token.id, ipAddress, userAgent);
    await portalRepository.logActivity({
      portalTokenId: token.id, targetContactId: token.targetContactId, activityType: 'portal_access',
      activityDescription: 'Portal accessed via token validation', ipAddress, userAgent,
    });
    return token;
  }

  async getTokenData(accessToken: string, ipAddress?: string, userAgent?: string) {
    const token = await this.validateToken(accessToken, ipAddress, userAgent);
    return {
      valid: true, tokenId: token.id, companyId: token.targetCompanyId, contactId: token.targetContactId,
      allowedActions: JSON.parse(token.allowedActions || '{}'), customMessage: token.customMessage,
      portalBranding: token.portalBranding ? JSON.parse(token.portalBranding) : null,
    };
  }

  async createToken(data: { userCompanyId: number; targetCompanyId: number; targetContactId: number; createdBy: number; expiresInDays?: number; allowedActions?: any; customMessage?: string; }): Promise<PortalAccessToken> {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (data.expiresInDays || 30));
    return await portalRepository.createToken({
      accessToken: randomUUID(), userCompanyId: data.userCompanyId, targetCompanyId: data.targetCompanyId,
      targetContactId: data.targetContactId, createdBy: data.createdBy, isActive: true, expiresAt,
      allowedActions: JSON.stringify(data.allowedActions || { upload: true, view: true }), customMessage: data.customMessage,
    });
  }

  async getTokensForCompany(userCompanyId: number) {
    return await portalRepository.getTokensForCompany(userCompanyId);
  }

  async deactivateToken(tokenId: number, userCompanyId: number): Promise<boolean> {
    const token = await portalRepository.getTokenById(tokenId);
    if (!token) throw new NotFoundError('Token not found');
    if (token.userCompanyId !== userCompanyId) throw new ForbiddenError('Not authorized to deactivate this token');
    return await portalRepository.deactivateToken(tokenId);
  }

  async getSubmissionsByToken(accessToken: string): Promise<ExternalDocumentSubmission[]> {
    const token = await portalRepository.validateToken(accessToken);
    if (!token) throw new NotFoundError('Invalid or expired access token');
    return await portalRepository.getSubmissionsByToken(token.id);
  }

  async reviewSubmission(submissionId: number, status: string, reviewedBy: number): Promise<ExternalDocumentSubmission> {
    const updated = await portalRepository.updateSubmissionStatus(submissionId, status, reviewedBy);
    if (!updated) throw new NotFoundError('Submission not found');
    return updated;
  }

  async logActivity(portalTokenId: number, targetContactId: number, activityType: string, activityDescription: string, ipAddress?: string, userAgent?: string): Promise<void> {
    await portalRepository.logActivity({ portalTokenId, targetContactId, activityType, activityDescription, ipAddress, userAgent });
  }
}

export const portalService = new PortalService();
