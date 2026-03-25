import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { eq, sql } from 'drizzle-orm';
import { authService } from '../services/auth.service';
import { sendSuccess, sendCreated } from '../utils/response';
import { UnauthorizedError } from '../utils/errors';
import { isAuthenticated, refreshSessionPermissions } from '../middleware/auth';
import { validateCsrfToken } from '../middleware/csrf';
import { asyncHandler } from '../utils/async-handler';
import { passwordResetService } from '../services/password-reset.service';
import { authLimiter } from '../middleware/rate-limit';
import { db } from '../db';
import { users } from '@shared/schema/core';
import { seedDefaultPipelineStages } from '../scripts/seed-pipeline-stages';
import { escapeHtml } from '../utils/html';
import { config } from '../config';
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
  const appUrl = config.baseUrl;

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

const betaNdaSchema = z.object({
  signerName: z.string().min(2, 'Please enter your full name'),
});

router.post('/beta-nda/sign', isAuthenticated, validateCsrfToken, asyncHandler(async (req: Request, res: Response) => {
  const { signerName } = betaNdaSchema.parse(req.body);
  const userId = req.session.userId!;

  const signerIp = (req.ip ?? req.socket.remoteAddress ?? '').replace(/^::ffff:/, '');

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
    .set({
      betaNdaSigned: true,
      betaNdaSignedAt: new Date(),
      betaNdaSignerName: signerName,
      betaNdaSignerIp: signerIp || null,
    })
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
          <p style="margin:0;color:#6b7280;font-size:13px;">For questions, contact: <a href="mailto:adam@shiftopsconsulting.com" style="color:#2563eb;">adam@shiftopsconsulting.com</a></p>
        </td></tr>
        <tr>
          <td style="background-color: #ffffff; padding: 32px; border-left: 1px solid #e5e7eb; border-right: 1px solid #e5e7eb;">
            <p style="margin: 0 0 16px; color: #374151; font-size: 14px; font-weight: 600; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px;">Full Agreement Text</p>
            <p style="margin: 0 0 12px; color: #374151; font-size: 13px; font-weight: 600;">1. Background</p>
            <p style="margin: 0 0 8px; color: #6b7280; font-size: 13px; line-height: 1.6;">1.1 Valoxi has developed a proprietary artificial intelligence platform that delivers institutional-grade mergers and acquisitions due diligence analysis (the "Platform"). The Platform is currently in pre-launch beta testing.</p>
            <p style="margin: 0 0 8px; color: #6b7280; font-size: 13px; line-height: 1.6;">1.2 Valoxi wishes to invite selected individuals to participate in its beta testing programme (the "Beta Programme") to evaluate the Platform and provide feedback.</p>
            <p style="margin: 0 0 16px; color: #6b7280; font-size: 13px; line-height: 1.6;">1.3 In connection with the Beta Programme, Valoxi will disclose to the Receiving Party certain Confidential Information (as defined below). This Agreement governs the use and protection of that information.</p>
            <p style="margin: 0 0 12px; color: #374151; font-size: 13px; font-weight: 600;">2. Definitions</p>
            <p style="margin: 0 0 8px; color: #6b7280; font-size: 13px; line-height: 1.6;">"Confidential Information" means all information disclosed by Valoxi to the Receiving Party, whether in written, electronic, oral, or visual form, in connection with the Beta Programme, including without limitation: the Platform, its features, functionality, user interface, and analytical outputs; software architecture, algorithms, data models, and AI methodologies; product roadmap, development plans, and unreleased features; business strategy, commercial terms, pricing, and competitive positioning; and any other information designated as confidential or that a reasonable person would understand to be confidential given the nature of the information and circumstances of disclosure.</p>
            <p style="margin: 0 0 8px; color: #6b7280; font-size: 13px; line-height: 1.6;">"Beta Period" means the period commencing on the date of this Agreement and ending on the earlier of: (a) the public commercial launch of the Platform; or (b) written notice from Valoxi terminating the Beta Programme.</p>
            <p style="margin: 0 0 16px; color: #6b7280; font-size: 13px; line-height: 1.6;">"Permitted Purpose" means the evaluation of the Platform solely for the purposes of the Beta Programme and the provision of feedback to Valoxi.</p>
            <p style="margin: 0 0 12px; color: #374151; font-size: 13px; font-weight: 600;">3. Confidentiality Obligations</p>
            <p style="margin: 0 0 8px; color: #6b7280; font-size: 13px; line-height: 1.6;">3.1 The Receiving Party agrees to: keep all Confidential Information strictly confidential; use Confidential Information solely for the Permitted Purpose; not disclose Confidential Information to any third party without Valoxi's prior written consent; apply at least the same degree of care to the Confidential Information as the Receiving Party applies to its own confidential information, and in any event no less than reasonable care; notify Valoxi promptly upon becoming aware of any actual or suspected unauthorised disclosure of Confidential Information.</p>
            <p style="margin: 0 0 16px; color: #6b7280; font-size: 13px; line-height: 1.6;">3.2 The obligations in clause 3.1 do not apply to information which: is or becomes publicly available other than through breach of this Agreement; was already known to the Receiving Party prior to disclosure; is independently developed by the Receiving Party without reference to the Confidential Information; is required to be disclosed by law or court order, provided the Receiving Party gives Valoxi prompt written notice.</p>
            <p style="margin: 0 0 12px; color: #374151; font-size: 13px; font-weight: 600;">4. Beta Testing Obligations</p>
            <p style="margin: 0 0 8px; color: #6b7280; font-size: 13px; line-height: 1.6;">4.1 The Receiving Party agrees to: use the Platform solely for evaluation and testing purposes during the Beta Period; provide honest feedback to Valoxi; report any bugs, errors, or unexpected behaviour promptly; not use the Platform to process live deals, client data, or information belonging to third parties unless expressly agreed in writing by Valoxi.</p>
            <p style="margin: 0 0 16px; color: #6b7280; font-size: 13px; line-height: 1.6;">4.2 The Receiving Party acknowledges that the Platform is pre-release software and may contain defects. Valoxi does not warrant that the Platform will be error-free, complete, or fit for any particular purpose during the Beta Period.</p>
            <p style="margin: 0 0 12px; color: #374151; font-size: 13px; font-weight: 600;">5. Intellectual Property</p>
            <p style="margin: 0 0 8px; color: #6b7280; font-size: 13px; line-height: 1.6;">5.1 All intellectual property rights in and to the Platform, the Confidential Information, and any improvements or modifications made by Valoxi remain the exclusive property of Valoxi.</p>
            <p style="margin: 0 0 8px; color: #6b7280; font-size: 13px; line-height: 1.6;">5.2 Any feedback, suggestions, ideas, or recommendations provided by the Receiving Party may be used by Valoxi without restriction. The Receiving Party hereby assigns to Valoxi all rights in and to such Feedback.</p>
            <p style="margin: 0 0 16px; color: #6b7280; font-size: 13px; line-height: 1.6;">5.3 Nothing in this Agreement grants the Receiving Party any licence or right to use Valoxi's intellectual property, trade marks, or brand materials without prior written consent.</p>
            <p style="margin: 0 0 12px; color: #374151; font-size: 13px; font-weight: 600;">6. Data Protection</p>
            <p style="margin: 0 0 8px; color: #6b7280; font-size: 13px; line-height: 1.6;">6.1 The parties acknowledge that any personal data processed in connection with the Beta Programme will be processed in accordance with applicable data protection legislation, including the UK GDPR and the Data Protection Act 2018.</p>
            <p style="margin: 0 0 16px; color: #6b7280; font-size: 13px; line-height: 1.6;">6.2 The Receiving Party agrees not to upload or input any personal data of third parties into the Platform during the Beta Period without the express knowledge and consent of those individuals.</p>
            <p style="margin: 0 0 12px; color: #374151; font-size: 13px; font-weight: 600;">7. Disclaimer and Limitation of Liability</p>
            <p style="margin: 0 0 8px; color: #6b7280; font-size: 13px; line-height: 1.6;">7.1 The Platform and all analysis outputs are provided for informational purposes only. Nothing produced by the Platform constitutes financial advice, investment advice, legal advice, or professional due diligence. The Receiving Party should not rely solely on Platform outputs when making investment or acquisition decisions.</p>
            <p style="margin: 0 0 16px; color: #6b7280; font-size: 13px; line-height: 1.6;">7.2 To the fullest extent permitted by law, Valoxi shall not be liable for any loss or damage arising from the Receiving Party's use of the Platform during the Beta Period.</p>
            <p style="margin: 0 0 12px; color: #374151; font-size: 13px; font-weight: 600;">8. Term and Return of Information</p>
            <p style="margin: 0 0 8px; color: #6b7280; font-size: 13px; line-height: 1.6;">8.1 This Agreement commences on the date of signature and continues until the end of the Beta Period. Confidentiality obligations survive termination for a period of three (3) years.</p>
            <p style="margin: 0 0 16px; color: #6b7280; font-size: 13px; line-height: 1.6;">8.2 Upon request by Valoxi, the Receiving Party shall promptly return or destroy all Confidential Information in its possession.</p>
            <p style="margin: 0 0 12px; color: #374151; font-size: 13px; font-weight: 600;">9. General</p>
            <p style="margin: 0 0 8px; color: #6b7280; font-size: 13px; line-height: 1.6;">9.1 This Agreement is governed by the laws of England and Wales. The parties submit to the exclusive jurisdiction of the courts of England and Wales.</p>
            <p style="margin: 0 0 8px; color: #6b7280; font-size: 13px; line-height: 1.6;">9.2 This Agreement constitutes the entire agreement between the parties with respect to its subject matter.</p>
            <p style="margin: 0 0 16px; color: #6b7280; font-size: 13px; line-height: 1.6;">9.3 No amendment to this Agreement is effective unless made in writing and signed by both parties.</p>
            <p style="margin: 0; color: #9ca3af; font-size: 12px; border-top: 1px solid #e5e7eb; padding-top: 12px;">Version 1.0, March 2026</p>
          </td>
        </tr>
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
    to: 'adam@shiftopsconsulting.com',
    subject: `Beta NDA signed — ${signerName} (${user.email})`,
    html: ndaEmailHtml(signerName),
    fromName: 'Valoxi (ShiftOps Consulting Ltd)',
  });

  sendSuccess(res, { message: 'NDA signed successfully' });
}));

export default router;
