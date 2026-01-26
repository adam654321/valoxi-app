import { Router, Request, Response } from 'express';
import { rolesService } from '../services/roles.service';
import { sendSuccess, sendError } from '../utils/response';
import { UnauthorizedError } from '../utils/errors';
import { z } from 'zod';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const roles = await rolesService.getUserRoles();
    sendSuccess(res, roles);
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/:roleName', async (req: Request, res: Response) => {
  try {
    const { roleName } = req.params;
    const role = await rolesService.getUserRole(roleName);
    sendSuccess(res, role);
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/user/:userId/permissions', async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId);
    const user = await rolesService.getUserWithPermissions(userId);
    sendSuccess(res, user);
  } catch (error) {
    sendError(res, error);
  }
});

router.put('/user/:userId', async (req: Request, res: Response) => {
  try {
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

    sendSuccess(res, updatedUser);
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/check/:permission', async (req: Request, res: Response) => {
  try {
    const userId = req.session?.userId;

    if (!userId) {
      throw new UnauthorizedError();
    }

    const { permission } = req.params;
    const hasPermission = await rolesService.checkPermission(userId, permission as any);

    sendSuccess(res, { hasPermission });
  } catch (error) {
    sendError(res, error);
  }
});

export default router;
