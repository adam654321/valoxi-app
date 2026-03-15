import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { eq, sql } from 'drizzle-orm';
import { authService } from '../services/auth.service';
import { sendSuccess, sendCreated } from '../utils/response';
import { UnauthorizedError } from '../utils/errors';
import { isAuthenticated, refreshSessionPermissions } from '../middleware/auth';
import { asyncHandler } from '../utils/async-handler';
import { passwordResetService } from '../services/password-reset.service';
import { authLimiter } from '../middleware/rate-limit';
import { db } from '../db';
import { users } from '@shared/schema/core';
import { seedDefaultPipelineStages } from '../scripts/seed-pipeline-stages';
import { escapeHtml } from '../utils/html';
import { emailService } from '../email';
import { promoCodeService } from '../services/promo-code.service';
import { billingService } from '../services/billing.service';
import { magicLinkService } from '../services/magic-link.service';
import { emailApiService } from '../services/email.service';

const router = Router();

const registerSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string().min(8),
  companyName: z.string().min(1, 'Company name is required'),
  promoCode: z.string().optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

router.post('/register', authLimiter, asyncHandler(async (req: Request, res: Response) => {
  const validatedData = registerSchema.parse(req.body);

  const { systemConfigService } = await import('../services/system-config.service');
  const registrationMode = await systemConfigService.getConfig('registration_mode');
  const isInviteOnly = registrationMode === 'invite_only';

  if (isInviteOnly) {
    const code = validatedData.promoCode?.trim();
    if (!code) {
      return res.status(403).json({
        success: false,
        error: 'invite_required',
        message: 'Access to Valoxi is currently by invitation only. Please enter your invitation code to continue.',
      });
    }

    const validation = await promoCodeService.validateCode(code);
    if (!validation.valid) {
      const reason = validation.reason || '';
      let errorCode = 'invalid_code';
      let errorMessage = 'This code is invalid. Please check and try again.';

      if (reason.includes('already been used')) {
        errorCode = 'code_used';
        errorMessage = 'This code has already been used. Each code is single-use only.';
      } else if (reason.includes('expired')) {
        errorCode = 'code_expired';
        errorMessage = 'This code has expired.';
      }

      return res.status(403).json({
        success: false,
        error: errorCode,
        message: errorMessage,
      });
    }
  }

  const result = await authService.register({
    email: validatedData.email,
    password: validatedData.password,
    firstName: validatedData.firstName,
    lastName: validatedData.lastName,
    companyName: validatedData.companyName,
  });

  req.session.userId = result.user.id;
  req.session.userCompanyId = result.company?.id;
  await refreshSessionPermissions(req);

  if (result.company?.id) {
    seedDefaultPipelineStages().catch(err =>
      console.error('[REGISTRATION] Failed to seed pipeline stages:', err)
    );
  }

  sendWelcomeEmail(validatedData.email, validatedData.firstName).catch(err =>
    console.error('[REGISTRATION] Failed to send welcome email:', err)
  );

  if (result.company?.id) {
    const { track } = await import('../services/funnel.service');
    track(result.company.id, result.user.id, 'user.registered', { sector: validatedData.companyName });
  }

  let promoApplied = false;
  let promoError: string | undefined;
  let discountDescription: string | undefined;

  if (validatedData.promoCode && validatedData.promoCode.trim() && result.company?.id) {
    try {
      const claimResult = await promoCodeService.claimCode(
        validatedData.promoCode,
        result.company.id,
        null
      );
      if (claimResult.success) {
        promoApplied = true;
        discountDescription = claimResult.discountDescription;
      } else {
        promoError = claimResult.reason || 'Could not apply promo code';
      }
    } catch (err) {
      console.error('[REGISTRATION] Promo code claim error:', err);
      promoError = 'Could not apply promo code';
    }
  }

  if (!promoApplied && result.company?.id) {
    try {
      const trialEndsAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
      await billingService.createTrialSubscription(result.company.id, 3, trialEndsAt);
    } catch (err) {
      console.error('[REGISTRATION] Failed to create trial subscription:', err);
    }
  }

  sendCreated(res, {
    message: 'User created successfully',
    user: result.user,
    company: result.company,
    promoApplied,
    promoError,
    discountDescription,
  });
}));

async function sendWelcomeEmail(email: string, firstName: string) {
  const appUrl = process.env.REPLIT_DEV_DOMAIN
    ? `https://${process.env.REPLIT_DEV_DOMAIN}`
    : process.env.APP_URL || 'https://app.dealflow.ai';

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to Valoxi</title>
        <style>
          .container { max-width: 600px; margin: 0 auto; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
          .header { background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #ffffff; padding: 30px; border: 1px solid #e1e5e9; }
          .button { display: inline-block; padding: 14px 32px; background: #1e40af; color: white; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
          .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 14px; color: #6c757d; border-radius: 0 0 8px 8px; }
          .steps { background: #f0f7ff; padding: 20px; border-radius: 6px; margin: 20px 0; }
          .steps ol { margin: 0; padding-left: 20px; }
          .steps li { margin-bottom: 8px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to Valoxi</h1>
          </div>
          <div class="content">
            <p>Hi ${escapeHtml(firstName)},</p>
            <p>Your account is set up and your free trial has started. You now have access to the full Valoxi platform.</p>
            <p>Here's how to get started:</p>
            <div class="steps">
              <ol>
                <li><strong>Add your first target company</strong> — enter the business you're looking to acquire</li>
                <li><strong>Upload financial documents</strong> — add their accounts or financial statements</li>
                <li><strong>Generate your first expert analysis</strong> — let the AI produce a full commercial due diligence report</li>
              </ol>
            </div>
            <p style="text-align: center;">
              <a href="${appUrl}" class="button">Open Valoxi</a>
            </p>
            <p>Best regards,<br>The Valoxi Team</p>
          </div>
          <div class="footer">
            <p>Valoxi — Acquire Smarter, Faster.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  await emailService.sendEmail({
    to: email,
    subject: "Welcome to Valoxi — let's run your first deal",
    html,
  });
  console.log(`[REGISTRATION] Welcome email sent to ${email}`);
}

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

router.get('/me', asyncHandler(async (req: Request, res: Response) => {
  const userId = req.session?.userId;
  if (!userId) {
    throw new UnauthorizedError();
  }

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
    betaNdaSigned: result.user.betaNdaSigned ?? false,
    company: result.company,
    permissions: req.session.permissions ?? null,
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
  const baseUrl = `${req.protocol}://${req.get('host')}`;
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

const betaNdaSchema = z.object({
  signerName: z.string().min(2, 'Please enter your full name'),
});

router.post('/beta-nda/sign', isAuthenticated, asyncHandler(async (req: Request, res: Response) => {
  const { signerName } = betaNdaSchema.parse(req.body);
  const userId = req.session.userId!;

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId));

  if (!user) throw new UnauthorizedError();
  if (user.betaNdaSigned) {
    return sendSuccess(res, { message: 'NDA already signed' });
  }

  await db
    .update(users)
    .set({ betaNdaSigned: true, betaNdaSignedAt: new Date() })
    .where(eq(users.id, userId));

  const signedDate = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  const ndaEmailHtml = (recipientName: string) => `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <tr><td style="background:#0f172a;padding:32px;text-align:center;border-radius:8px 8px 0 0;">
          <h1 style="margin:0;color:#fff;font-size:24px;font-weight:700;">Valoxi</h1>
          <p style="margin:8px 0 0;color:#94a3b8;font-size:14px;">Beta Testing Non-Disclosure Agreement</p>
        </td></tr>
        <tr><td style="background:#fff;padding:32px;border-left:1px solid #e5e7eb;border-right:1px solid #e5e7eb;">
          <p style="margin:0 0 16px;color:#1f2937;font-size:16px;">Dear ${recipientName},</p>
          <p style="margin:0 0 16px;color:#1f2937;font-size:16px;">This email confirms that the Valoxi Beta Testing Non-Disclosure Agreement has been signed. Please retain this copy for your records.</p>
          <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:20px;margin:20px 0;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="width:50%;padding:8px;vertical-align:top;">
                  <p style="margin:0 0 4px;color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;">DISCLOSING PARTY</p>
                  <p style="margin:0 0 4px;color:#1f2937;font-size:14px;font-weight:600;">ShiftOps Consulting Ltd (Valoxi)</p>
                  <p style="margin:0 0 4px;color:#374151;font-size:14px;">Signed by: Adam Auty</p>
                  <p style="margin:0 0 4px;color:#374151;font-size:14px;">Title: Director</p>
                  <p style="margin:0;color:#374151;font-size:14px;">Date: ${signedDate}</p>
                </td>
                <td style="width:50%;padding:8px;vertical-align:top;">
                  <p style="margin:0 0 4px;color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;">RECEIVING PARTY</p>
                  <p style="margin:0 0 4px;color:#1f2937;font-size:14px;font-weight:600;">${signerName}</p>
                  <p style="margin:0 0 4px;color:#374151;font-size:14px;">Email: ${user.email}</p>
                  <p style="margin:0;color:#374151;font-size:14px;">Date: ${signedDate}</p>
                </td>
              </tr>
            </table>
          </div>
          <p style="margin:0 0 16px;color:#6b7280;font-size:13px;">By electronically accepting this agreement, both parties confirm their agreement to the terms of the Valoxi Beta Testing Non-Disclosure Agreement Version 1.0, March 2026.</p>
          <p style="margin:0;color:#6b7280;font-size:13px;">For questions, contact: <a href="mailto:hello@valoxi.ai" style="color:#2563eb;">hello@valoxi.ai</a></p>
        </td></tr>
        <tr><td style="background:#f9fafb;padding:20px 32px;text-align:center;border-radius:0 0 8px 8px;border:1px solid #e5e7eb;border-top:none;">
          <p style="margin:0;color:#9ca3af;font-size:12px;">Valoxi &middot; A trading name of ShiftOps Consulting Ltd &middot; Registered in England &amp; Wales</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  await (emailService as any).sendEmail({
    to: user.email,
    subject: 'Valoxi Beta NDA — Your signed copy',
    html: ndaEmailHtml(`${user.firstName} ${user.lastName}`),
    fromName: 'Valoxi (ShiftOps Consulting Ltd)',
  });

  await (emailService as any).sendEmail({
    to: 'hello@valoxi.ai',
    subject: `Beta NDA signed — ${signerName} (${user.email})`,
    html: ndaEmailHtml(signerName),
    fromName: 'Valoxi (ShiftOps Consulting Ltd)',
  });

  sendSuccess(res, { message: 'NDA signed successfully' });
}));

export default router;
