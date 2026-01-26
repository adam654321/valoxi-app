import { Router, Request, Response } from 'express';
import { emailApiService } from '../services/email.service';
import { sendSuccess, sendError } from '../utils/response';
import { BadRequestError, UnauthorizedError } from '../utils/errors';

const router = Router();

router.get('/test', async (req: Request, res: Response) => {
  try {
    const result = await emailApiService.testConnection();
    sendSuccess(res, result);
  } catch (error) { sendError(res, error); }
});

router.post('/invitation/:invitationId/send', async (req: Request, res: Response) => {
  try {
    const invitationId = parseInt(req.params.invitationId);
    if (isNaN(invitationId)) throw new BadRequestError('Invalid invitation ID');
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const result = await emailApiService.sendTeamInvitation(invitationId, baseUrl);
    sendSuccess(res, result);
  } catch (error) { sendError(res, error); }
});

router.post('/portal/:tokenId/send', async (req: Request, res: Response) => {
  try {
    const tokenId = parseInt(req.params.tokenId);
    if (isNaN(tokenId)) throw new BadRequestError('Invalid token ID');
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const result = await emailApiService.sendPortalAccessLink(tokenId, baseUrl, req.body.customMessage);
    sendSuccess(res, result);
  } catch (error) { sendError(res, error); }
});

router.post('/document-notification', async (req: Request, res: Response) => {
  try {
    const { targetCompanyId, documentName, documentCategory, contactName, submissionNotes } = req.body;
    if (!targetCompanyId || !documentName || !documentCategory || !contactName) {
      throw new BadRequestError('Missing required fields');
    }
    const result = await emailApiService.sendDocumentNotification(targetCompanyId, documentName, documentCategory, contactName, submissionNotes);
    sendSuccess(res, result);
  } catch (error) { sendError(res, error); }
});

router.post('/send', async (req: Request, res: Response) => {
  try {
    const { to, subject, html } = req.body;
    const result = await emailApiService.sendCustomEmail(to, subject, html);
    sendSuccess(res, result);
  } catch (error) { sendError(res, error); }
});

export default router;
