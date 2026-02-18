import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { assignmentsService } from '../services/assignments.service';
import { sendSuccess, sendCreated } from '../utils/response';
import { UnauthorizedError, BadRequestError } from '../utils/errors';
import { usersRepository } from '../repositories/users.repository';
import { asyncHandler } from '../utils/async-handler';

const router = Router();

router.post('/:dealId/assign', asyncHandler(async (req: Request, res: Response) => {
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
    data.canCreateActivities, data.canManageContacts, usersRepository.getUserWithPermissions.bind(usersRepository)
  );
  sendCreated(res, assignment);
}));

router.get('/:dealId/team', asyncHandler(async (req: Request, res: Response) => {
  const userCompanyId = req.session?.userCompanyId;
  const dealId = parseInt(req.params.dealId);
  if (!userCompanyId) throw new UnauthorizedError();
  if (isNaN(dealId)) throw new BadRequestError('Invalid deal ID');
  const assignments = await assignmentsService.getByDeal(dealId);
  sendSuccess(res, assignments);
}));

router.delete('/:dealId/assign/:assigneeId', asyncHandler(async (req: Request, res: Response) => {
  const userId = req.session?.userId;
  const dealId = parseInt(req.params.dealId);
  const assigneeId = parseInt(req.params.assigneeId);
  if (!userId) throw new UnauthorizedError();
  if (isNaN(dealId) || isNaN(assigneeId)) throw new BadRequestError('Invalid parameters');
  await assignmentsService.removeFromDeal(dealId, assigneeId, userId, usersRepository.getUserWithPermissions.bind(usersRepository));
  sendSuccess(res, { message: 'Team member removed from deal successfully' });
}));

router.put('/:dealId/team/:assigneeId', asyncHandler(async (req: Request, res: Response) => {
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
    data.canCreateActivities, data.canManageContacts, usersRepository.getUserWithPermissions.bind(usersRepository)
  );
  sendSuccess(res, updated);
}));

export default router;
