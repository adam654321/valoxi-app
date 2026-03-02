import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { eq, count } from 'drizzle-orm';
import { authService } from '../services/auth.service';
import { sendSuccess, sendCreated } from '../utils/response';
import { UnauthorizedError } from '../utils/errors';
import { insertUserSchema } from '@shared/schema';
import { isAuthenticated, refreshSessionPermissions } from '../middleware/auth';
import { asyncHandler } from '../utils/async-handler';
import { passwordResetService } from '../services/password-reset.service';
import { authLimiter } from '../middleware/rate-limit';
import { db } from '../db';
import { pipelineStages } from '@shared/schema/deals';
import { emailService } from '../email';

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

router.post('/register', authLimiter, asyncHandler(async (req: Request, res: Response) => {
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
  await refreshSessionPermissions(req);

  if (result.company?.id) {
    seedDefaultPipelineStages(result.company.id).catch(err =>
      console.error('[REGISTRATION] Failed to seed pipeline stages:', err)
    );
  }

  sendWelcomeEmail(validatedData.email, validatedData.firstName).catch(err =>
    console.error('[REGISTRATION] Failed to send welcome email:', err)
  );

  sendCreated(res, {
    message: 'User created successfully',
    user: result.user,
    company: result.company,
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

async function seedDefaultPipelineStages(userCompanyId: number) {
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
    : process.env.APP_URL || 'https://app.rubicon.deals';

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to Rubicon</title>
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
            <h1>Welcome to Rubicon</h1>
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
              <a href="${appUrl}" class="button">Open Rubicon</a>
            </p>
            <p>Best regards,<br>The Rubicon Team</p>
          </div>
          <div class="footer">
            <p>Rubicon — Acquire Smarter, Faster.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  await emailService.sendEmail({
    to: email,
    subject: "Welcome to Rubicon — let's run your first deal",
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
