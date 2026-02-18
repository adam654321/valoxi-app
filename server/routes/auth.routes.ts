import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authService } from '../services/auth.service';
import { sendSuccess, sendCreated } from '../utils/response';
import { UnauthorizedError } from '../utils/errors';
import { insertUserSchema } from '@shared/schema';
import { isAuthenticated } from '../middleware/auth';
import { asyncHandler } from '../utils/async-handler';
import { rolesService } from '../services/roles.service';

const router = Router();

const registerSchema = insertUserSchema.extend({
  companyName: z.string().min(1, 'Company name is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string().min(8),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

router.post('/register', asyncHandler(async (req: Request, res: Response) => {
  const validatedData = registerSchema.parse(req.body);
  
  const result = await authService.register({
    email: validatedData.email,
    password: validatedData.password,
    firstName: validatedData.firstName,
    lastName: validatedData.lastName,
    companyName: validatedData.companyName,
  });

  req.session.userId = result.user.id;
  req.session.userCompanyId = result.company?.id;

  sendCreated(res, {
    message: 'User created successfully',
    user: result.user,
    company: result.company,
  });
}));

router.post('/login', asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = loginSchema.parse(req.body);
  
  const result = await authService.login({ email, password });

  req.session.userId = result.user.id;
  req.session.userCompanyId = result.company?.id;

  sendSuccess(res, {
    message: 'Login successful',
    user: result.user,
    company: result.company,
  });
}));

router.post('/logout', (req: Request, res: Response) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
      return res.status(500).json({ message: 'Could not log out' });
    }
    sendSuccess(res, { message: 'Logged out successfully' });
  });
});

router.get('/me', asyncHandler(async (req: Request, res: Response) => {
  const userId = req.session?.userId;
  if (!userId) {
    throw new UnauthorizedError();
  }

  const result = await authService.getCurrentUser(userId);

  let permissions = null;
  try {
    const userWithPerms = await rolesService.getUserWithPermissions(userId);
    permissions = userWithPerms.permissions ?? null;
  } catch {
    permissions = null;
  }

  sendSuccess(res, {
    id: result.user.id,
    email: result.user.email,
    firstName: result.user.firstName,
    lastName: result.user.lastName,
    isSystemAdmin: result.user.isSystemAdmin ?? false,
    company: result.company,
    permissions,
  });
}));

router.get('/csrf', isAuthenticated, (req: Request, res: Response) => {
  sendSuccess(res, { csrfToken: req.session.csrfToken });
});

export default router;
