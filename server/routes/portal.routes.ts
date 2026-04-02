import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { portalService } from '../services/portal.service';
import { sendSuccess, sendCreated } from '../utils/response';
import { asyncHandler } from '../utils/async-handler';
import { UnauthorizedError, BadRequestError } from '../utils/errors';
import { requirePermission } from '../middleware/auth';

const publicRouter = Router();

publicRouter.get('/validate/:token', asyncHandler(async (req: Request, res: Response) => {
  const data = await portalService.getTokenData(req.params.token, req.ip, req.get('User-Agent'));
  sendSuccess(res, data);
}));

publicRouter.get('/:token/submissions', asyncHandler(async (req: Request, res: Response) => {
  const submissions = await portalService.getSubmissionsByToken(req.params.token);
  sendSuccess(res, submissions);
}));

const authenticatedRouter = Router();

authenticatedRouter.get('/tokens', asyncHandler(async (req: Request, res: Response) => {
  const userCompanyId = req.session?.userCompanyId;
  if (!userCompanyId) throw new UnauthorizedError();
  const tokens = await portalService.getTokensForCompany(userCompanyId);
  sendSuccess(res, tokens);
}));

authenticatedRouter.post('/tokens', requirePermission('canCreateDeals'), asyncHandler(async (req: Request, res: Response) => {
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
}));

authenticatedRouter.delete('/tokens/:id', requirePermission('canCreateDeals'), asyncHandler(async (req: Request, res: Response) => {
  const userCompanyId = req.session?.userCompanyId;
  if (!userCompanyId) throw new UnauthorizedError();
  const tokenId = parseInt(req.params.id);
  if (isNaN(tokenId)) throw new BadRequestError('Invalid token ID');
  await portalService.deleteToken(tokenId, userCompanyId);
  sendSuccess(res, { message: 'Portal link removed successfully. Document history has been preserved.' });
}));

authenticatedRouter.post('/tokens/:id/reinstate', requirePermission('canCreateDeals'), asyncHandler(async (req: Request, res: Response) => {
  const userCompanyId = req.session?.userCompanyId;
  if (!userCompanyId) throw new UnauthorizedError();
  const tokenId = parseInt(req.params.id);
  if (isNaN(tokenId)) throw new BadRequestError('Invalid token ID');
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  await portalService.reinstateToken(tokenId, userCompanyId, baseUrl);
  sendSuccess(res, { message: 'Portal link reinstated and access email sent.' });
}));

authenticatedRouter.post('/tokens/:id/resend-email', requirePermission('canCreateDeals'), asyncHandler(async (req: Request, res: Response) => {
  const userCompanyId = req.session?.userCompanyId;
  if (!userCompanyId) throw new UnauthorizedError();
  const tokenId = parseInt(req.params.id);
  if (isNaN(tokenId)) throw new BadRequestError('Invalid token ID');
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  await portalService.resendPortalEmail(tokenId, userCompanyId, baseUrl);
  sendSuccess(res, { message: 'Portal access email sent successfully.' });
}));

authenticatedRouter.post('/review/:submissionId', asyncHandler(async (req: Request, res: Response) => {
  const userId = req.session?.userId;
  if (!userId) throw new UnauthorizedError();
  const submissionId = parseInt(req.params.submissionId);
  if (isNaN(submissionId)) throw new BadRequestError('Invalid submission ID');
  const { status } = z.object({ status: z.string() }).parse(req.body);
  const updated = await portalService.reviewSubmission(submissionId, status, userId);
  sendSuccess(res, updated);
}));

authenticatedRouter.get('/company/:companyId/tokens', asyncHandler(async (req: Request, res: Response) => {
  const userCompanyId = req.session?.userCompanyId;
  if (!userCompanyId) throw new UnauthorizedError();
  const targetCompanyId = parseInt(req.params.companyId);
  if (isNaN(targetCompanyId)) throw new BadRequestError('Invalid company ID');
  const tokens = await portalService.getActiveTokensForTargetCompany(targetCompanyId, userCompanyId);
  sendSuccess(res, { tokens });
}));

export { publicRouter as portalPublicRoutes };
export default authenticatedRouter;
