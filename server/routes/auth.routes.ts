  import { Router, Request, Response } from 'express';
  import { z } from 'zod';
  import { eq, sql } from 'drizzle-orm';
  import { authService } from '../services/auth.service';
  import { sendSuccess } from '../utils/response';
  import { isAuthenticated, refreshSessionPermissions } from '../middleware/auth';
  import { asyncHandler } from '../utils/async-handler';
  import { passwordResetService } from '../services/password-reset.service';
  import { authLimiter } from '../middleware/rate-limit';
  import { db } from '../db';
  import { users } from '@shared/schema/core';
  import { magicLinkService } from '../services/magic-link.service';
  import { emailApiService } from '../services/email.service';
  
  const router = Router();
  
  const loginSchema = z.object({
    email: z.string().email('Invalid email format'),
    password: z.string().min(1, 'Password is required'),
  });
  
  
  router.post('/login', authLimiter, asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = loginSchema.parse(req.body);
    
    const result = await authService.login({ email, password });
  
    req.session.userId = result.user.id;
    req.session.userCompanyId = result.company?.id;
    await refreshSessionPermissions(req);
  
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
  
  const forgotPasswordSchema = z.object({
    email: z.string().email('Invalid email format'),
  });
  
  router.post('/forgot-password', authLimiter, asyncHandler(async (req: Request, res: Response) => {
    const { email } = forgotPasswordSchema.parse(req.body);
    const baseUrl = process.env.APP_URL
      || (process.env.REPLIT_DOMAINS ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}` : null)
      || `${req.protocol}://${req.get('host')}`;
    await passwordResetService.requestReset(email, baseUrl);
    sendSuccess(res, { message: 'If an account exists with that email, a password reset link has been sent.' });
  }));
  
  const resetPasswordSchema = z.object({
    token: z.string().min(1),
    password: z.string().min(8, 'Password must be at least 8 characters'),
  });
  
  router.post('/reset-password', authLimiter, asyncHandler(async (req: Request, res: Response) => {
    const { token, password } = resetPasswordSchema.parse(req.body);
    await passwordResetService.resetPassword(token, password);
    sendSuccess(res, { message: 'Password has been reset successfully.' });
  }));
  
  router.get('/reset-password/validate', asyncHandler(async (req: Request, res: Response) => {
    const token = req.query.token as string;
    if (!token) {
      sendSuccess(res, { valid: false });
      return;
    }
    const result = await passwordResetService.validateToken(token);
    sendSuccess(res, { valid: result.valid });
  }));
  
  router.get('/magic', asyncHandler(async (req: Request, res: Response) => {
    const token = req.query.token as string;
    if (!token) {
      return res.redirect('/login?error=invalid');
    }
  
    const result = await magicLinkService.consumeMagicLink(token);
  
    if (result.valid) {
      const user = await db.query.users.findFirst({
        where: eq(users.id, result.userId),
      });
  
      if (!user) {
        return res.redirect('/auth/link-expired?reason=invalid');
      }
  
      req.session.userId = user.id;
      req.session.userCompanyId = user.userCompanyId ?? undefined;
      await refreshSessionPermissions(req);
  
      if (user.onboardingCompleted === false) {
        return res.redirect('/onboarding');
      }
      return res.redirect('/dashboard');
    }
  
    const reason = result.reason;
    if (reason === 'expired') {
      let emailParam = '';
      try {
        const { magicLinks } = await import('@shared/schema/core');
        const [link] = await db.select().from(magicLinks).where(eq(magicLinks.token, token));
        if (link) {
          const linkUser = await db.query.users.findFirst({ where: eq(users.id, link.userId) });
          if (linkUser?.email) {
            emailParam = `&email=${encodeURIComponent(linkUser.email)}`;
          }
        }
      } catch { /* ignore */ }
      return res.redirect(`/auth/link-expired?reason=expired${emailParam}`);
    }
    if (reason === 'already_used') {
      return res.redirect('/auth/link-expired?reason=used');
    }
    return res.redirect('/auth/link-expired?reason=invalid');
  }));
  
  router.post('/resend-magic-link', authLimiter, asyncHandler(async (req: Request, res: Response) => {
    const { email } = req.body as { email?: string };
  
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'missing_email', message: 'Email is required.' });
    }
  
    const rateCheck = await magicLinkService.checkResendRateLimit(email);
    if (!rateCheck.allowed) {
      return res.status(429).json({ error: 'rate_limited', message: 'Too many requests. Please wait before trying again.' });
    }
  
    const [user] = await db
      .select()
      .from(users)
      .where(sql`LOWER(${users.email}) = LOWER(${email.trim()})`);
  
    if (!user) {
      return res.status(200).json({ success: true, message: 'If an account exists for this email, a new link has been sent.' });
    }
  
    const magicLink = await magicLinkService.generateMagicLink(user.id, 'login');
  
    await emailApiService.sendMagicLinkEmail({
      to: user.email,
      firstName: user.firstName || 'there',
      magicLink,
    });
  
    console.log('[auth] Magic link resent to:', user.email);
    return res.status(200).json({ success: true, message: 'If an account exists for this email, a new link has been sent.' });
  }));
  
  export default router;
  