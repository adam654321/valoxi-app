import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { portalService } from '../services/portal.service';
import { sendSuccess, sendCreated, sendError } from '../utils/response';
import { UnauthorizedError, BadRequestError } from '../utils/errors';

const router = Router();

router.get('/validate/:token', async (req: Request, res: Response) => {
  try {
    const data = await portalService.getTokenData(req.params.token, req.ip, req.get('User-Agent'));
    sendSuccess(res, data);
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/tokens', async (req: Request, res: Response) => {
  try {
    const userCompanyId = req.session?.userCompanyId;
    if (!userCompanyId) throw new UnauthorizedError();
    const tokens = await portalService.getTokensForCompany(userCompanyId);
    sendSuccess(res, tokens);
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/tokens', async (req: Request, res: Response) => {
  try {
    const userId = req.session?.userId;
    const userCompanyId = req.session?.userCompanyId;
    if (!userId || !userCompanyId) throw new UnauthorizedError();
    const schema = z.object({
      targetCompanyId: z.number(), targetContactId: z.number(), expiresInDays: z.number().optional(),
      allowedActions: z.any().optional(), customMessage: z.string().optional(), timeframeDays: z.number().min(1).max(90).optional(),
    });
    const data = schema.parse(req.body);
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const token = await portalService.createToken({
      userCompanyId, targetCompanyId: data.targetCompanyId, targetContactId: data.targetContactId,
      createdBy: userId, expiresInDays: data.expiresInDays, allowedActions: data.allowedActions, customMessage: data.customMessage,
      timeframeDays: data.timeframeDays,
    }, baseUrl);
    sendCreated(res, token);
  } catch (error) {
    sendError(res, error);
  }
});

router.delete('/tokens/:id', async (req: Request, res: Response) => {
  try {
    const userCompanyId = req.session?.userCompanyId;
    if (!userCompanyId) throw new UnauthorizedError();
    const tokenId = parseInt(req.params.id);
    if (isNaN(tokenId)) throw new BadRequestError('Invalid token ID');
    await portalService.deleteToken(tokenId, userCompanyId);
    sendSuccess(res, { message: 'Portal link removed successfully. Document history has been preserved.' });
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/tokens/:id/reinstate', async (req: Request, res: Response) => {
  try {
    const userCompanyId = req.session?.userCompanyId;
    if (!userCompanyId) throw new UnauthorizedError();
    const tokenId = parseInt(req.params.id);
    if (isNaN(tokenId)) throw new BadRequestError('Invalid token ID');
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    await portalService.reinstateToken(tokenId, userCompanyId, baseUrl);
    sendSuccess(res, { message: 'Portal link reinstated and access email sent.' });
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/tokens/:id/resend-email', async (req: Request, res: Response) => {
  try {
    const userCompanyId = req.session?.userCompanyId;
    if (!userCompanyId) throw new UnauthorizedError();
    const tokenId = parseInt(req.params.id);
    if (isNaN(tokenId)) throw new BadRequestError('Invalid token ID');
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    await portalService.resendPortalEmail(tokenId, userCompanyId, baseUrl);
    sendSuccess(res, { message: 'Portal access email sent successfully.' });
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/:token/submissions', async (req: Request, res: Response) => {
  try {
    const submissions = await portalService.getSubmissionsByToken(req.params.token);
    sendSuccess(res, submissions);
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/review/:submissionId', async (req: Request, res: Response) => {
  try {
    const userId = req.session?.userId;
    if (!userId) throw new UnauthorizedError();
    const submissionId = parseInt(req.params.submissionId);
    if (isNaN(submissionId)) throw new BadRequestError('Invalid submission ID');
    const { status } = z.object({ status: z.string() }).parse(req.body);
    const updated = await portalService.reviewSubmission(submissionId, status, userId);
    sendSuccess(res, updated);
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/company/:companyId/tokens', async (req: Request, res: Response) => {
  try {
    const userCompanyId = req.session?.userCompanyId;
    if (!userCompanyId) throw new UnauthorizedError();
    const targetCompanyId = parseInt(req.params.companyId);
    if (isNaN(targetCompanyId)) throw new BadRequestError('Invalid company ID');
    const tokens = await portalService.getActiveTokensForTargetCompany(targetCompanyId, userCompanyId);
    sendSuccess(res, { tokens });
  } catch (error) {
    sendError(res, error);
  }
});

export default router;
