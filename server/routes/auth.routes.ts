import { Router, Request, Response } from 'express';
import { authService } from '../services/auth.service';
import { sendSuccess } from '../utils/response';
import { isAuthenticated, refreshSessionPermissions } from '../middleware/auth';
import { asyncHandler } from '../utils/async-handler';

const router = Router();

router.post('/logout', (req: Request, res: Response) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
      return res.status(500).json({ message: 'Could not log out' });
    }
    sendSuccess(res, { message: 'Logged out successfully' });
  });
});

router.get('/me', isAuthenticated, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.session.userId!;

  const result = await authService.getCurrentUser(userId);

  if (!req.session.permissionsCachedAt) {
    await refreshSessionPermissions(req);
  }

  sendSuccess(res, {
    id: result.user.id,
    email: result.user.email,
    firstName: result.user.firstName,
    lastName: result.user.lastName,
    isSystemAdmin: result.user.isSystemAdmin ?? false,
    onboardingCompleted: result.user.onboardingCompleted ?? false,
    checklistCompleted: result.user.checklistCompleted ?? false,
    company: result.company,
    permissions: req.session.permissions ?? null,
    viewingAs: req.session.adminViewingAsUserId
      ? {
          userId: req.session.adminViewingAsUserId,
          name: `${result.user.firstName ?? ''} ${result.user.lastName ?? ''}`.trim(),
          companyName: result.company?.companyName ?? null,
        }
      : null,
  });
}));

router.get('/csrf', isAuthenticated, (req: Request, res: Response) => {
  sendSuccess(res, { csrfToken: req.session.csrfToken });
});

export default router;
