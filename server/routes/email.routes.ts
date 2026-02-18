import { Router, Request, Response } from 'express';
import { emailApiService } from '../services/email.service';
import { sendSuccess } from '../utils/response';
import { BadRequestError, UnauthorizedError } from '../utils/errors';
import { asyncHandler } from '../utils/async-handler';

const router = Router();

router.get('/test', asyncHandler(async (req: Request, res: Response) => {
  const result = await emailApiService.testConnection();
  sendSuccess(res, result);
}));

router.post('/invitation/:invitationId/send', asyncHandler(async (req: Request, res: Response) => {
  const invitationId = parseInt(req.params.invitationId);
  if (isNaN(invitationId)) throw new BadRequestError('Invalid invitation ID');
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  const result = await emailApiService.sendTeamInvitation(invitationId, baseUrl);
  sendSuccess(res, result);
}));

router.post('/portal/:tokenId/send', asyncHandler(async (req: Request, res: Response) => {
  const tokenId = parseInt(req.params.tokenId);
  if (isNaN(tokenId)) throw new BadRequestError('Invalid token ID');
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  const result = await emailApiService.sendPortalAccessLink(tokenId, baseUrl, req.body.customMessage);
  sendSuccess(res, result);
}));

router.post('/document-notification', asyncHandler(async (req: Request, res: Response) => {
  const { targetCompanyId, documentName, documentCategory, contactName, submissionNotes } = req.body;
  if (!targetCompanyId || !documentName || !documentCategory || !contactName) {
    throw new BadRequestError('Missing required fields');
  }
  const result = await emailApiService.sendDocumentNotification(targetCompanyId, documentName, documentCategory, contactName, submissionNotes);
  sendSuccess(res, result);
}));

router.post('/send', asyncHandler(async (req: Request, res: Response) => {
  const { to, subject, html } = req.body;
  const result = await emailApiService.sendCustomEmail(to, subject, html);
  sendSuccess(res, result);
}));

export default router;
