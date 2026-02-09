import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authService } from '../services/auth.service';
import { sendSuccess, sendCreated, sendError } from '../utils/response';
import { UnauthorizedError } from '../utils/errors';
import { insertUserSchema } from '@shared/schema';

const router = Router();

const registerSchema = insertUserSchema.extend({
  companyName: z.string().min(1, 'Company name is required'),
  passwordHash: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string().min(8),
}).refine((data) => data.passwordHash === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

router.post('/register', async (req: Request, res: Response) => {
  try {
    const validatedData = registerSchema.parse(req.body);
    
    const result = await authService.register({
      email: validatedData.email,
      password: validatedData.passwordHash,
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
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    
    const result = await authService.login({ email, password });

    req.session.userId = result.user.id;
    req.session.userCompanyId = result.company?.id;

    sendSuccess(res, {
      message: 'Login successful',
      user: result.user,
      company: result.company,
    });
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/logout', (req: Request, res: Response) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
      return res.status(500).json({ message: 'Could not log out' });
    }
    sendSuccess(res, { message: 'Logged out successfully' });
  });
});

router.get('/me', async (req: Request, res: Response) => {
  try {
    const userId = req.session?.userId;
    if (!userId) {
      throw new UnauthorizedError();
    }

    const result = await authService.getCurrentUser(userId);
    sendSuccess(res, {
      id: result.user.id,
      email: result.user.email,
      firstName: result.user.firstName,
      lastName: result.user.lastName,
      company: result.company,
    });
  } catch (error) {
    sendError(res, error);
  }
});

export default router;
