import { Router, Request, Response } from 'express';
import { emailApiService } from '../services/email.service';
import { sendSuccess } from '../utils/response';
import { BadRequestError, UnauthorizedError, NotFoundError } from '../utils/errors';
import { asyncHandler } from '../utils/async-handler';
import { isSystemAdmin } from '../middleware/auth';
import { emailRepository } from '../repositories/email.repository';

const router = Router();

router.get('/test', asyncHandler(async (req: Request, res: Response) => {
  const result = await emailApiService.testConnection();
  sendSuccess(res, result);
}));

router.post('/invitation/:invitationId/send', asyncHandler(async (req: Request, res: Response) => {
  const invitationId = parseInt(req.params.invitationId);
  if (isNaN(invitationId)) throw new BadRequestError('Invalid invitation ID');
  const sessionCompanyId = req.session?.userCompanyId;
  if (!sessionCompanyId && !req.session?.isSystemAdmin) throw new UnauthorizedError();
  if (!req.session?.isSystemAdmin) {
    const invitation = await emailRepository.getInvitationById(invitationId);
    if (!invitation) throw new NotFoundError('Invitation not found');
    if (invitation.userCompanyId !== sessionCompanyId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
  }
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  const result = await emailApiService.sendTeamInvitation(invitationId, baseUrl);
  sendSuccess(res, result);
}));

router.post('/portal/:tokenId/send', asyncHandler(async (req: Request, res: Response) => {
  const tokenId = parseInt(req.params.tokenId);
  if (isNaN(tokenId)) throw new BadRequestError('Invalid token ID');
  const sessionCompanyId = req.session?.userCompanyId;
  if (!sessionCompanyId && !req.session?.isSystemAdmin) throw new UnauthorizedError();
  if (!req.session?.isSystemAdmin) {
    const token = await emailRepository.getPortalTokenById(tokenId);
    if (!token) throw new NotFoundError('Token not found');
    if (token.userCompanyId !== sessionCompanyId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
  }
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  const userId = req.session?.userId;
  if (!userId) throw new UnauthorizedError();
  const result = await emailApiService.sendPortalAccessLink(tokenId, baseUrl, userId, req.body.customMessage);
  sendSuccess(res, result);
}));

router.post('/document-notification', asyncHandler(async (req: Request, res: Response) => {
  const { targetCompanyId, documentName, documentCategory, contactName, submissionNotes } = req.body;
  if (!targetCompanyId || !documentName || !documentCategory || !contactName) {
    throw new BadRequestError('Missing required fields');
  }
  const sessionCompanyId = req.session?.userCompanyId;
  if (!sessionCompanyId && !req.session?.isSystemAdmin) throw new UnauthorizedError();
  if (!req.session?.isSystemAdmin) {
    const company = await emailRepository.getTargetCompanyById(targetCompanyId);
    if (!company) throw new NotFoundError('Target company not found');
    if (company.userCompanyId !== sessionCompanyId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
  }
  const result = await emailApiService.sendDocumentNotification(targetCompanyId, documentName, documentCategory, contactName, submissionNotes);
  sendSuccess(res, result);
}));

router.post('/send', isSystemAdmin, asyncHandler(async (req: Request, res: Response) => {
  const { to, subject, html } = req.body;
  const result = await emailApiService.sendCustomEmail(to, subject, html);
  sendSuccess(res, result);
}));

export default router;
