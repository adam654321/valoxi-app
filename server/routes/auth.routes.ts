import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { eq, count } from 'drizzle-orm';
import { authService } from '../services/auth.service';
import { sendSuccess, sendCreated } from '../utils/response';
import { UnauthorizedError } from '../utils/errors';
import { isAuthenticated, refreshSessionPermissions } from '../middleware/auth';
import { asyncHandler } from '../utils/async-handler';
import { passwordResetService } from '../services/password-reset.service';
import { authLimiter } from '../middleware/rate-limit';
import { db } from '../db';
import { pipelineStages } from '@shared/schema/deals';
import { emailService } from '../email';
import { promoCodeService } from '../services/promo-code.service';
import { billingService } from '../services/billing.service';

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
        message: 'Access to DealFlow AI is currently by invitation only. Please enter your invitation code to continue.',
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
    seedDefaultPipelineStages(result.company.id).catch(err =>
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
      const trialEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await billingService.createTrialSubscription(result.company.id, 7, trialEndsAt);
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

const DEFAULT_PIPELINE_STAGES = [
  { stageName: 'New Target', stageOrder: 1, description: 'Newly identified acquisition target' },
  { stageName: 'Initial Contact', stageOrder: 2, description: 'First outreach made to the target' },
  { stageName: 'Documents Requested', stageOrder: 3, description: 'Financial and operational documents requested' },
  { stageName: 'Under Review', stageOrder: 4, description: 'Documents and business under active review' },
  { stageName: 'Offer Stage', stageOrder: 5, description: 'Preparing or submitting an offer' },
  { stageName: 'Heads of Terms', stageOrder: 6, description: 'Negotiating and agreeing heads of terms' },
  { stageName: 'Due Diligence', stageOrder: 7, description: 'Formal due diligence in progress' },
  { stageName: 'Legal & Accounting', stageOrder: 8, description: 'Legal and accounting workstreams active' },
  { stageName: 'Completion', stageOrder: 9, description: 'Deal completing or completed' },
  { stageName: 'Not Qualified', stageOrder: 10, description: 'Target did not meet criteria' },
];

export async function seedDefaultPipelineStages(userCompanyId: number) {
  const [existing] = await db
    .select({ count: count() })
    .from(pipelineStages);

  if ((existing?.count ?? 0) > 0) {
    return;
  }

  await db.insert(pipelineStages).values(DEFAULT_PIPELINE_STAGES).onConflictDoNothing();
  console.log(`[REGISTRATION] Seeded default pipeline stages`);
}

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
        <title>Welcome to DealFlow AI</title>
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
            <h1>Welcome to DealFlow AI</h1>
          </div>
          <div class="content">
            <p>Hi ${firstName},</p>
            <p>Your account is set up and your free trial has started. You now have access to the full M&A deal management platform.</p>
            <p>Here's how to get started:</p>
            <div class="steps">
              <ol>
                <li><strong>Add your first target company</strong> — enter the business you're looking to acquire</li>
                <li><strong>Upload financial documents</strong> — add their accounts or financial statements</li>
                <li><strong>Generate your first expert analysis</strong> — let the AI produce a full commercial due diligence report</li>
              </ol>
            </div>
            <p style="text-align: center;">
              <a href="${appUrl}" class="button">Open DealFlow AI</a>
            </p>
            <p>Best regards,<br>The DealFlow AI Team</p>
          </div>
          <div class="footer">
            <p>DealFlow AI — Acquire Smarter, Faster.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  await emailService.sendEmail({
    to: email,
    subject: "Welcome to DealFlow AI — let's run your first deal",
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

export default router;
