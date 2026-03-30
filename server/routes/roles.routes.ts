import { Router, Request, Response } from 'express';
import { rolesService } from '../services/roles.service';
import { invalidateUserPermissions } from '../middleware/auth';
import { sendSuccess } from '../utils/response';
import { UnauthorizedError } from '../utils/errors';
import { z } from 'zod';
import { asyncHandler } from '../utils/async-handler';

const router = Router();

router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const roles = await rolesService.getUserRoles();
  sendSuccess(res, roles);
}));

router.get('/:roleName', asyncHandler(async (req: Request, res: Response) => {
  const { roleName } = req.params;
  const role = await rolesService.getUserRole(roleName);
  sendSuccess(res, role);
}));

router.get('/user/:userId/permissions', asyncHandler(async (req: Request, res: Response) => {
  const userId = parseInt(req.params.userId);
  const user = await rolesService.getUserWithPermissions(userId);
  sendSuccess(res, user);
}));

router.put('/user/:userId', asyncHandler(async (req: Request, res: Response) => {
  const requestingUserId = req.session?.userId;
  const userCompanyId = req.session?.userCompanyId;
  const targetUserId = parseInt(req.params.userId);

  if (!requestingUserId || !userCompanyId) {
    throw new UnauthorizedError();
  }

  const updateSchema = z.object({
    role: z.string().min(1, 'Role is required'),
  });

  const { role } = updateSchema.parse(req.body);

  const updatedUser = await rolesService.updateUserRole(
    targetUserId,
    role,
    userCompanyId,
    requestingUserId
  );

  invalidateUserPermissions(targetUserId);

  sendSuccess(res, updatedUser);
}));

router.get('/check/:permission', asyncHandler(async (req: Request, res: Response) => {
  const userId = req.session?.userId;

  if (!userId) {
    throw new UnauthorizedError();
  }

  const { permission } = req.params;
  const hasPermission = await rolesService.checkPermission(userId, permission as any);

  sendSuccess(res, { hasPermission });
}));

export default router;
