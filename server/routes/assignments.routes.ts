import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { assignmentsService } from '../services/assignments.service';
import { sendSuccess, sendCreated, sendError } from '../utils/response';
import { UnauthorizedError, BadRequestError } from '../utils/errors';
import { storage } from '../storage';

const router = Router();

router.post('/:dealId/assign', async (req: Request, res: Response) => {
  try {
    const userId = req.session?.userId;
    const userCompanyId = req.session?.userCompanyId;
    const dealId = parseInt(req.params.dealId);
    if (!userId || !userCompanyId) throw new UnauthorizedError();
    if (isNaN(dealId)) throw new BadRequestError('Invalid deal ID');
    const schema = z.object({
      userId: z.number(), role: z.string().default('analyst'), canEditCompany: z.boolean().default(true),
      canUploadDocuments: z.boolean().default(true), canCreateActivities: z.boolean().default(true), canManageContacts: z.boolean().default(true),
    });
    const data = schema.parse(req.body);
    const assignment = await assignmentsService.assignToDeal(
      dealId, data.userId, userId, userCompanyId, data.role, data.canEditCompany, data.canUploadDocuments,
      data.canCreateActivities, data.canManageContacts, storage.getUserWithPermissions.bind(storage)
    );
    sendCreated(res, assignment);
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/:dealId/team', async (req: Request, res: Response) => {
  try {
    const userCompanyId = req.session?.userCompanyId;
    const dealId = parseInt(req.params.dealId);
    if (!userCompanyId) throw new UnauthorizedError();
    if (isNaN(dealId)) throw new BadRequestError('Invalid deal ID');
    const assignments = await assignmentsService.getByDeal(dealId);
    sendSuccess(res, assignments);
  } catch (error) {
    sendError(res, error);
  }
});

router.delete('/:dealId/assign/:assigneeId', async (req: Request, res: Response) => {
  try {
    const userId = req.session?.userId;
    const dealId = parseInt(req.params.dealId);
    const assigneeId = parseInt(req.params.assigneeId);
    if (!userId) throw new UnauthorizedError();
    if (isNaN(dealId) || isNaN(assigneeId)) throw new BadRequestError('Invalid parameters');
    await assignmentsService.removeFromDeal(dealId, assigneeId, userId, storage.getUserWithPermissions.bind(storage));
    sendSuccess(res, { message: 'Team member removed from deal successfully' });
  } catch (error) {
    sendError(res, error);
  }
});

router.put('/:dealId/team/:assigneeId', async (req: Request, res: Response) => {
  try {
    const userId = req.session?.userId;
    const dealId = parseInt(req.params.dealId);
    const assigneeId = parseInt(req.params.assigneeId);
    if (!userId) throw new UnauthorizedError();
    if (isNaN(dealId) || isNaN(assigneeId)) throw new BadRequestError('Invalid parameters');
    const schema = z.object({
      role: z.string().optional(), canEditCompany: z.boolean().optional(), canUploadDocuments: z.boolean().optional(),
      canCreateActivities: z.boolean().optional(), canManageContacts: z.boolean().optional(),
    });
    const data = schema.parse(req.body);
    const updated = await assignmentsService.updatePermissions(
      dealId, assigneeId, userId, data.role, data.canEditCompany, data.canUploadDocuments,
      data.canCreateActivities, data.canManageContacts, storage.getUserWithPermissions.bind(storage)
    );
    sendSuccess(res, updated);
  } catch (error) {
    sendError(res, error);
  }
});

export default router;
