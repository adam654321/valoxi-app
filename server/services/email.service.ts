import { emailService as legacyEmailService } from '../email';
import { emailRepository } from '../repositories/email.repository';
import { NotFoundError, BadRequestError } from '../utils/errors';
import { escapeHtml } from '../utils/html';
import { renderBrandedEmail, type EmailBlock } from './email-template';
import { config } from '../config';

interface SendInvitationResult { success: boolean; message: string }
interface SendPortalLinkResult { success: boolean; message: string }

export class EmailApiService {
  async sendTeamInvitation(invitationId: number, baseUrl: string): Promise<SendInvitationResult> {
    const invitation = await emailRepository.getInvitationById(invitationId);
    if (!invitation) throw new NotFoundError('Invitation not found');
    if (!invitation.email) throw new BadRequestError('Invitation has no email address');
    const inviter = invitation.invitedBy ? await emailRepository.getUserById(invitation.invitedBy) : null;
    const inviterName = inviter ? `${inviter.firstName || ''} ${inviter.lastName || ''}`.trim() || inviter.email : 'Team Admin';
    const companyName = await emailRepository.getUserCompanyName(invitation.userCompanyId) || 'Company';
    const inviteUrl = `${baseUrl}/invite/${invitation.invitationToken}`;
    const success = await legacyEmailService.sendTeamInvitation(invitation.email, inviterName, companyName, invitation.invitationToken, inviteUrl, invitation.invitedRole || 'Team Member');
    return { success, message: success ? 'Invitation email sent successfully' : 'Failed to send invitation email' };
  }

  async sendPortalAccessLink(portalTokenId: number, baseUrl: string, customMessage?: string): Promise<SendPortalLinkResult> {
    const token = await emailRepository.getPortalTokenById(portalTokenId);
    if (!token) throw new NotFoundError('Portal token not found');
    const contact = await emailRepository.getContactById(token.targetContactId);
    if (!contact || !contact.email) throw new BadRequestError('Contact has no email address');
    const company = await emailRepository.getTargetCompanyById(token.targetCompanyId);
    if (!company) throw new NotFoundError('Company not found');
    const contactName = `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || 'Contact';
    const portalUrl = `${baseUrl}/portal/${token.accessToken}`;
    const success = await legacyEmailService.sendPortalAccessLink(contact.email, contactName, company.companyName, portalUrl, customMessage || token.customMessage, token.expiresAt);
    return { success, message: success ? 'Portal access email sent successfully' : 'Failed to send portal access email' };
  }

  async sendDocumentNotification(targetCompanyId: number, documentName: string, documentCategory: string, contactName: string, submissionNotes?: string): Promise<SendPortalLinkResult> {
    const company = await emailRepository.getTargetCompanyById(targetCompanyId);
    if (!company) throw new NotFoundError('Company not found');
    const teamEmails = await emailRepository.getTeamMemberEmails(company.userCompanyId);
    if (teamEmails.length === 0) return { success: false, message: 'No team members to notify' };
    const success = await legacyEmailService.sendDocumentReceivedNotification(teamEmails.map(t => t.email), contactName, company.companyName, documentName, documentCategory, submissionNotes);
    return { success, message: success ? 'Notification sent to team' : 'Failed to send notification' };
  }

  async testConnection(): Promise<{ connected: boolean; message: string }> {
    const connected = await legacyEmailService.testConnection();
    return { connected, message: connected ? 'SMTP connection verified' : 'SMTP connection failed or not configured' };
  }

  async sendCustomEmail(to: string, subject: string, html: string): Promise<SendInvitationResult> {
    if (!to || !subject || !html) throw new BadRequestError('Missing required fields: to, subject, html');
    const success = await (legacyEmailService as any).sendEmail({ to, subject, html });
    return { success, message: success ? 'Email sent successfully' : 'Failed to send email' };
  }

  async sendWelcomeEmail(params: {
    to: string;
    firstName: string;
    planKey: string;
    magicLink: string;
    freeMonths: number;
    trialDays: number;
  }): Promise<SendInvitationResult> {
    const { to, firstName, planKey, magicLink, freeMonths, trialDays } = params;
    const safeFirstName = escapeHtml(firstName);

    const planLabels: Record<string, string> = {
      CORE: 'Core', PROFESSIONAL: 'Professional', EXPERT: 'Expert', ENTERPRISE: 'Enterprise',
    };
    const planLabel = planLabels[planKey] || planKey;

    const planDescriptions: Record<string, string> = {
      CORE: '5 target companies &middot; Deal Modeller &middot; AI Screening',
      PROFESSIONAL: '20 target companies &middot; Full Expert Analysis &middot; Data Room &middot; Team Seats',
      EXPERT: '100 target companies &middot; All features &middot; Priority support',
    };
    const planDesc = planDescriptions[planKey] || '';

    const formatDate = (d: Date): string => {
      const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
      return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
    };

    const blocks: EmailBlock[] = [
      { type: 'paragraph', text: `Hi ${safeFirstName},` },
      { type: 'paragraph', text: `Your <strong style="color:#FFFFFF;">${planLabel}</strong> plan is now active.` },
    ];

    if (freeMonths > 0) {
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + freeMonths);
      blocks.push({
        type: 'info_box',
        box: {
          tone: 'success',
          body: `Your <strong>${freeMonths} months free</strong> period starts today. No charge until <strong>${formatDate(endDate)}</strong>.`,
        },
      });
    } else if (trialDays > 0) {
      const endDate = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000);
      blocks.push({
        type: 'info_box',
        box: {
          tone: 'info',
          body: `Your <strong>${trialDays} day free trial</strong> has started. You will not be charged until <strong>${formatDate(endDate)}</strong>.`,
        },
      });
    }

    blocks.push({ type: 'cta', cta: { label: 'Access Valoxi', href: magicLink } });
    blocks.push({ type: 'paragraph', text: 'This link expires in 72 hours. If it expires, visit the login page to request a new one.' });

    if (planDesc) {
      blocks.push({ type: 'divider' });
      blocks.push({
        type: 'info_box',
        box: {
          tone: 'info',
          title: `${planLabel} plan`,
          body: planDesc,
        },
      });
    }

    const html = renderBrandedEmail({
      preheader: `Your Valoxi ${planLabel} plan is active. Click inside to access your account.`,
      eyebrow: 'Welcome',
      heading: `Welcome to Valoxi, ${safeFirstName}`,
      blocks,
      footerLine: 'You are receiving this because a Valoxi account was created for your email address.',
    });

    const success = await (legacyEmailService as any).sendEmail({
      to,
      subject: 'Welcome to Valoxi — click here to access your account',
      html,
    });
    return { success, message: success ? 'Welcome email sent' : 'Failed to send welcome email' };
  }

  async sendOnboardingWelcome(params: {
    to: string;
    firstName: string;
  }): Promise<SendInvitationResult> {
    const { to, firstName } = params;
    const appUrl = config.baseUrl;
    const safeFirstName = escapeHtml(firstName);

    const blocks: EmailBlock[] = [
      { type: 'paragraph', text: `Hi ${safeFirstName},` },
      { type: 'paragraph', text: 'Your account is set up and your free trial has started. You now have access to the full Valoxi platform.' },
      { type: 'heading', text: 'Get started in three steps' },
      {
        type: 'steps',
        steps: [
          { lead: 'Add your first target company', detail: 'Enter the business you are looking to acquire.' },
          { lead: 'Upload financial documents', detail: 'Add their accounts or financial statements.' },
          { lead: 'Generate your first expert analysis', detail: 'Let the AI produce a full commercial due diligence report.' },
        ],
      },
      { type: 'cta', cta: { label: 'Open Valoxi', href: appUrl } },
    ];

    const html = renderBrandedEmail({
      preheader: 'Your account is set up. Three quick steps to run your first deal.',
      eyebrow: 'Welcome',
      heading: "Let's run your first deal",
      blocks,
      footerLine: 'You are receiving this because you just set up a Valoxi account.',
    });

    const success = await (legacyEmailService as any).sendEmail({
      to,
      subject: "Welcome to Valoxi. Let's run your first deal",
      html,
    });
    return { success, message: success ? 'Welcome email sent' : 'Failed to send welcome email' };
  }

  async sendWaitlistInvitation(params: {
    to: string;
    firstName: string;
    invitedEmail: string;
    inviteUrl: string;
    promoBenefitSentence?: string | null;
    trialLineOverride?: string | null;
  }): Promise<SendInvitationResult> {
    const { to, firstName, invitedEmail, inviteUrl, promoBenefitSentence, trialLineOverride } = params;
    const safeFirstName = escapeHtml(firstName);
    const safeInvitedEmail = escapeHtml(invitedEmail);
    const trimmedBenefit = promoBenefitSentence?.trim();
    const trimmedTrialOverride = trialLineOverride?.trim();
    const trialLineText = trimmedTrialOverride
      ? escapeHtml(trimmedTrialOverride)
      : 'Your 24 hour free trial starts the moment you sign up.';

    const blocks: EmailBlock[] = [
      { type: 'paragraph', text: `Hi ${safeFirstName},` },
      { type: 'paragraph', text: 'Good news. The Valoxi team has approved your access.' },
      { type: 'paragraph', text: 'Valoxi is the AI-powered M&amp;A platform for UK SME acquisitions. You can run target company analysis, build deal models, manage due diligence, and generate deal documents.' },
    ];

    if (trimmedBenefit) {
      blocks.push({
        type: 'info_box',
        box: { tone: 'success', body: escapeHtml(trimmedBenefit) },
      });
    }

    blocks.push({ type: 'cta', cta: { label: 'Set up your account', href: inviteUrl } });

    blocks.push({
      type: 'info_box',
      box: {
        tone: 'warning',
        title: `Important. Sign up using this email: ${safeInvitedEmail}`,
        body: `You can sign up with a password, or with Google, Microsoft, or LinkedIn. Whichever method you choose, make sure the email on the account is ${safeInvitedEmail}. If you sign up with a different email, your account will not be linked to your approved access and you will need to request a new invitation.`,
      },
    });

    blocks.push({ type: 'paragraph', text: trialLineText });
    blocks.push({ type: 'paragraph', text: 'This invitation expires in 7 days. If it expires, contact <a href="mailto:support@valoxi.ai" style="color:#F97316;text-decoration:none;">support@valoxi.ai</a> for a new one.' });

    const html = renderBrandedEmail({
      preheader: 'Your Valoxi access is approved. Set up your account using the link inside.',
      eyebrow: 'Access approved',
      heading: 'Your Valoxi access is approved',
      blocks,
      footerLine: 'You are receiving this because your Valoxi waitlist application was approved.',
    });

    const success = await (legacyEmailService as any).sendEmail({
      to,
      subject: 'Your Valoxi access is approved',
      html,
    });
    return { success, message: success ? 'Waitlist invitation sent' : 'Failed to send waitlist invitation' };
  }

  async sendPaymentLinkedEmail(params: {
    to: string;
    firstName: string;
    planKey: string;
  }): Promise<SendInvitationResult> {
    const { to, firstName, planKey } = params;

    const planLabels: Record<string, string> = {
      CORE: 'Core',
      PROFESSIONAL: 'Professional',
      EXPERT: 'Expert',
      ENTERPRISE: 'Enterprise',
    };
    const planLabel = planLabels[planKey] || planKey;

    const appUrl = process.env.APP_URL || 'https://test.valoxi.ai';
    const loginUrl = `${appUrl}/login`;

    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%;">
        <tr>
          <td style="background-color: #0f172a; padding: 32px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700;">Valoxi</h1>
          </td>
        </tr>
        <tr>
          <td style="background-color: #ffffff; padding: 32px; border-left: 1px solid #e5e7eb; border-right: 1px solid #e5e7eb;">
            <p style="margin: 0 0 16px; color: #1f2937; font-size: 16px;">Hi ${firstName},</p>
            <p style="margin: 0 0 16px; color: #1f2937; font-size: 16px;">We've linked your <strong>${planLabel}</strong> subscription to your existing Valoxi account.</p>
            <p style="margin: 0 0 24px; color: #1f2937; font-size: 16px;">Log in at <a href="${loginUrl}" style="color: #2563eb;">${loginUrl}</a> to access your account.</p>
            <div style="text-align: center; margin: 28px 0;">
              <a href="${loginUrl}" style="display: inline-block; background-color: #0f172a; color: #ffffff; text-decoration: none; padding: 16px 32px; border-radius: 8px; font-size: 16px; font-weight: 600;">Log In Now &rarr;</a>
            </div>
          </td>
        </tr>
        <tr>
          <td style="background-color: #f9fafb; padding: 20px 32px; text-align: center; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb; border-top: none;">
            <p style="margin: 0; color: #9ca3af; font-size: 12px;">Valoxi &middot; Powered by ShiftOps Consulting</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    const success = await (legacyEmailService as any).sendEmail({
      to,
      subject: 'Your Valoxi payment has been linked',
      html,
    });
    return { success, message: success ? 'Payment linked email sent' : 'Failed to send payment linked email' };
  }
  async sendMagicLinkEmail(params: {
    to: string;
    firstName: string;
    magicLink: string;
  }): Promise<SendInvitationResult> {
    const { to, firstName, magicLink } = params;
    const safeFirstName = escapeHtml(firstName);

    const blocks: EmailBlock[] = [
      { type: 'paragraph', text: `Hi ${safeFirstName},` },
      { type: 'paragraph', text: 'Here is your Valoxi login link. Click below to access your account.' },
      { type: 'cta', cta: { label: 'Log in to Valoxi', href: magicLink } },
      { type: 'paragraph', text: 'This link expires in 72 hours. If you did not request this, you can safely ignore this email.' },
    ];

    const html = renderBrandedEmail({
      preheader: 'Your Valoxi login link is ready.',
      eyebrow: 'Login link',
      heading: 'Your Valoxi login link',
      blocks,
      footerLine: 'You are receiving this because a login link was requested for your Valoxi account.',
    });

    const success = await (legacyEmailService as any).sendEmail({
      to,
      subject: 'Your Valoxi login link',
      html,
    });
    return { success, message: success ? 'Magic link email sent' : 'Failed to send magic link email' };
  }

  async sendAdminSignInLink(params: {
    to: string;
    firstName: string;
    signInUrl: string;
  }): Promise<SendInvitationResult> {
    const { to, firstName, signInUrl } = params;
    const safeFirstName = escapeHtml(firstName);

    const blocks: EmailBlock[] = [
      { type: 'paragraph', text: `Hi ${safeFirstName},` },
      { type: 'paragraph', text: 'A Valoxi administrator has generated a one-time sign-in link for your account. Click the button below to access Valoxi.' },
      { type: 'cta', cta: { label: 'Sign in to Valoxi', href: signInUrl } },
      { type: 'paragraph', text: 'This link expires in 24 hours and can only be used once.' },
      { type: 'paragraph', text: 'If you did not expect this email, you can safely ignore it.' },
    ];

    const html = renderBrandedEmail({
      preheader: 'An administrator has generated a one-time sign-in link for your Valoxi account.',
      eyebrow: 'Admin sign-in',
      heading: 'Your Valoxi access link',
      blocks,
      footerLine: 'You are receiving this because an administrator generated a sign-in link for your account.',
    });

    const success = await (legacyEmailService as any).sendEmail({
      to,
      subject: 'Your Valoxi access link',
      html,
    });
    return { success, message: success ? 'Access link sent' : 'Failed to send access link' };
  }

  async sendRenewalWarningEmail(params: {
    to: string;
    firstName: string;
    planKey: string;
    renewalDate: Date;
    amountDue: number;
    currency: string;
  }): Promise<SendInvitationResult> {
    const { to, firstName, planKey, renewalDate, amountDue, currency } = params;

    const planLabels: Record<string, string> = {
      CORE: 'Core', PROFESSIONAL: 'Professional', EXPERT: 'Expert', ENTERPRISE: 'Enterprise',
    };
    const planLabel = planLabels[planKey] || planKey;

    const symbol = currency === 'gbp' ? '£' : '$';
    const amount = `${symbol}${(amountDue / 100).toFixed(2)}`;

    const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const dateStr = `${renewalDate.getDate()} ${months[renewalDate.getMonth()]} ${renewalDate.getFullYear()}`;

    const appUrl = process.env.APP_URL || 'https://test.valoxi.ai';
    const billingUrl = `${appUrl}/billing`;

    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%;">
        <tr>
          <td style="background-color: #0f172a; padding: 32px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700;">Valoxi</h1>
          </td>
        </tr>
        <tr>
          <td style="background-color: #ffffff; padding: 32px; border-left: 1px solid #e5e7eb; border-right: 1px solid #e5e7eb;">
            <p style="margin: 0 0 16px; color: #1f2937; font-size: 16px;">Hi ${firstName},</p>
            <p style="margin: 0 0 16px; color: #1f2937; font-size: 16px;">Your <strong>${planLabel}</strong> annual plan renews in 7 days.</p>
            <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 20px 0;">
              <p style="margin: 0 0 8px; color: #374151; font-size: 14px;"><strong>Renewal date:</strong> ${dateStr}</p>
              <p style="margin: 0; color: #374151; font-size: 14px;"><strong>Amount:</strong> ${amount}</p>
            </div>
            <p style="margin: 0 0 24px; color: #6b7280; font-size: 14px;">Your card on file will be charged automatically. If you need to update your payment details or make any changes, visit your billing page before the renewal date.</p>
            <div style="text-align: center; margin: 28px 0;">
              <a href="${billingUrl}" style="display: inline-block; background-color: #0f172a; color: #ffffff; text-decoration: none; padding: 16px 32px; border-radius: 8px; font-size: 16px; font-weight: 600;">Manage Billing &rarr;</a>
            </div>
          </td>
        </tr>
        <tr>
          <td style="background-color: #f9fafb; padding: 20px 32px; text-align: center; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb; border-top: none;">
            <p style="margin: 0; color: #9ca3af; font-size: 12px;">Valoxi &middot; Powered by ShiftOps Consulting</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    const success = await (legacyEmailService as any).sendEmail({
      to,
      subject: `Your Valoxi ${planLabel} plan renews in 7 days`,
      html,
    });
    return { success, message: success ? 'Renewal warning email sent' : 'Failed to send renewal warning email' };
  }

  async sendFreePeriodPaymentRequiredEmail(params: {
    to: string;
    firstName: string;
    endDate: Date;
  }): Promise<SendInvitationResult> {
    const { to, firstName, endDate } = params;

    const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const dateStr = `${endDate.getDate()} ${months[endDate.getMonth()]} ${endDate.getFullYear()}`;

    const appUrl = process.env.APP_URL || 'https://test.valoxi.ai';
    const billingUrl = `${appUrl}/billing`;

    const safeFirstName = escapeHtml(firstName);
    const safeDateStr = escapeHtml(dateStr);

    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Enter payment details to continue your Valoxi Core access</title></head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%;">
        <tr><td style="background-color: #0f172a; padding: 32px; text-align: center; border-radius: 8px 8px 0 0;"><h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700;">Valoxi</h1></td></tr>
        <tr>
          <td style="background-color: #ffffff; padding: 32px; border-left: 1px solid #e5e7eb; border-right: 1px solid #e5e7eb;">
            <h2 style="margin: 0 0 20px; color: #1f2937; font-size: 22px; font-weight: 600;">Your free period ends soon</h2>
            <p style="margin: 0 0 16px; color: #1f2937; font-size: 16px;">Hi ${safeFirstName},</p>
            <p style="margin: 0 0 16px; color: #1f2937; font-size: 16px;">Your 6 month free period of Valoxi Core ends on <strong>${safeDateStr}</strong>. To keep your access active, you need to add payment details before then.</p>
            <p style="margin: 0 0 24px; color: #1f2937; font-size: 16px;">When you add payment details, your 15 percent member discount applies automatically to your Core subscription and to any plan you upgrade to later.</p>
            <div style="text-align: center; margin: 28px 0;">
              <a href="${billingUrl}" style="display: inline-block; background-color: #0f172a; color: #ffffff; text-decoration: none; padding: 16px 32px; border-radius: 8px; font-size: 16px; font-weight: 600;">Add payment details</a>
            </div>
            <p style="margin: 0 0 16px; color: #6b7280; font-size: 14px;">If you do not add payment details before ${safeDateStr}, your access will pause and your data will be preserved for 30 days. You can restore everything by signing back in with the same email and completing signup within that window.</p>
            <p style="margin: 24px 0 0; color: #1f2937; font-size: 16px;">Thanks,<br>The Valoxi team</p>
          </td>
        </tr>
        <tr><td style="background-color: #f9fafb; padding: 20px 32px; text-align: center; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb; border-top: none;"><p style="margin: 0; color: #9ca3af; font-size: 12px;">Valoxi. Acquire Smarter, Faster.</p></td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    const success = await (legacyEmailService as any).sendEmail({
      to,
      subject: 'Enter payment details to continue your Valoxi Core access',
      html,
    });
    return { success, message: success ? 'Free-period payment-required email sent' : 'Failed to send free-period payment-required email' };
  }

  async sendFreePeriodCancellationEmail(params: {
    to: string;
    firstName: string;
    endDate: Date;
    restoreByDate: Date;
  }): Promise<SendInvitationResult> {
    const { to, firstName, endDate, restoreByDate } = params;

    const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const formatDate = (d: Date) => `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
    const endDateStr = formatDate(endDate);
    const restoreByDateStr = formatDate(restoreByDate);

    const appUrl = process.env.APP_URL || 'https://test.valoxi.ai';
    const signupUrl = `${appUrl}/sign-up`;

    const safeFirstName = escapeHtml(firstName);
    const safeEndDate = escapeHtml(endDateStr);
    const safeRestoreByDate = escapeHtml(restoreByDateStr);

    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Your Valoxi Core free period has ended</title></head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%;">
        <tr><td style="background-color: #0f172a; padding: 32px; text-align: center; border-radius: 8px 8px 0 0;"><h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700;">Valoxi</h1></td></tr>
        <tr>
          <td style="background-color: #ffffff; padding: 32px; border-left: 1px solid #e5e7eb; border-right: 1px solid #e5e7eb;">
            <h2 style="margin: 0 0 20px; color: #1f2937; font-size: 22px; font-weight: 600;">Your Valoxi Core free period has ended</h2>
            <p style="margin: 0 0 16px; color: #1f2937; font-size: 16px;">Hi ${safeFirstName},</p>
            <p style="margin: 0 0 16px; color: #1f2937; font-size: 16px;">Your 6 month free period of Valoxi Core ended on <strong>${safeEndDate}</strong> and your access has now paused because no payment details were added.</p>
            <p style="margin: 0 0 16px; color: #1f2937; font-size: 16px;">Your data is preserved for 30 days. You can restore everything by signing back in with the same email and completing signup before <strong>${safeRestoreByDate}</strong>. After that date the account will be closed.</p>
            <p style="margin: 0 0 24px; color: #1f2937; font-size: 16px;">If you want to continue with Valoxi, use the link below with the same email address.</p>
            <div style="text-align: center; margin: 28px 0;">
              <a href="${signupUrl}" style="display: inline-block; background-color: #0f172a; color: #ffffff; text-decoration: none; padding: 16px 32px; border-radius: 8px; font-size: 16px; font-weight: 600;">Restore your account</a>
            </div>
            <p style="margin: 24px 0 0; color: #1f2937; font-size: 16px;">Thanks,<br>The Valoxi team</p>
          </td>
        </tr>
        <tr><td style="background-color: #f9fafb; padding: 20px 32px; text-align: center; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb; border-top: none;"><p style="margin: 0; color: #9ca3af; font-size: 12px;">Valoxi. Acquire Smarter, Faster.</p></td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    const success = await (legacyEmailService as any).sendEmail({
      to,
      subject: 'Your Valoxi Core free period has ended',
      html,
    });
    return { success, message: success ? 'Free-period cancellation email sent' : 'Failed to send free-period cancellation email' };
  }

  async sendPaymentFailedEmail(params: {
    to: string;
    firstName: string;
    planKey: string;
    billingUrl?: string;
  }): Promise<SendInvitationResult> {
    const { to, firstName, planKey, billingUrl } = params;
    const planLabels: Record<string, string> = {
      CORE: 'Core', PROFESSIONAL: 'Professional', EXPERT: 'Expert', ENTERPRISE: 'Enterprise',
    };
    const planLabel = planLabels[planKey] || planKey;
    const appUrl = process.env.APP_URL || 'https://test.valoxi.ai';
    const manageBillingUrl = billingUrl || `${appUrl}/billing`;

    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%;">
        <tr><td style="background-color: #0f172a; padding: 32px; text-align: center; border-radius: 8px 8px 0 0;"><h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700;">Valoxi</h1></td></tr>
        <tr>
          <td style="background-color: #ffffff; padding: 32px; border-left: 1px solid #e5e7eb; border-right: 1px solid #e5e7eb;">
            <p style="margin: 0 0 16px; color: #1f2937; font-size: 16px;">Hi ${firstName},</p>
            <p style="margin: 0 0 16px; color: #1f2937; font-size: 16px;">We could not collect payment for your <strong>${planLabel}</strong> plan.</p>
            <p style="margin: 0 0 16px; color: #6b7280; font-size: 14px;">We will retry payment automatically. Your account has a 14 day grace period, so please update your payment method as soon as you can.</p>
            <div style="text-align: center; margin: 28px 0;">
              <a href="${manageBillingUrl}" style="display: inline-block; background-color: #0f172a; color: #ffffff; text-decoration: none; padding: 16px 32px; border-radius: 8px; font-size: 16px; font-weight: 600;">Manage Billing &rarr;</a>
            </div>
            <p style="margin: 0; color: #6b7280; font-size: 14px;">If you have already updated your card, no further action is needed.</p>
          </td>
        </tr>
        <tr><td style="background-color: #f9fafb; padding: 20px 32px; text-align: center; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb; border-top: none;"><p style="margin: 0; color: #9ca3af; font-size: 12px;">Valoxi. Acquire Smarter, Faster.</p></td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    const success = await (legacyEmailService as any).sendEmail({
      to,
      subject: `Payment failed for your Valoxi ${planKey} plan`,
      html,
    });
    return { success, message: success ? 'Payment failed email sent' : 'Failed to send payment failed email' };
  }

  async sendDunningDay7Email(params: {
    to: string;
    firstName: string;
    planKey: string;
    billingUrl?: string;
  }): Promise<SendInvitationResult> {
    const { to, firstName, planKey, billingUrl } = params;
    const planLabels: Record<string, string> = {
      CORE: 'Core', PROFESSIONAL: 'Professional', EXPERT: 'Expert', ENTERPRISE: 'Enterprise',
    };
    const planLabel = planLabels[planKey] || planKey;
    const appUrl = process.env.APP_URL || 'https://test.valoxi.ai';
    const manageBillingUrl = billingUrl || `${appUrl}/billing`;

    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%;">
        <tr><td style="background-color: #0f172a; padding: 32px; text-align: center; border-radius: 8px 8px 0 0;"><h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700;">Valoxi</h1></td></tr>
        <tr>
          <td style="background-color: #ffffff; padding: 32px; border-left: 1px solid #e5e7eb; border-right: 1px solid #e5e7eb;">
            <p style="margin: 0 0 16px; color: #1f2937; font-size: 16px;">Hi ${firstName},</p>
            <p style="margin: 0 0 16px; color: #1f2937; font-size: 16px;">Payment is still failing for your <strong>${planLabel}</strong> plan.</p>
            <p style="margin: 0 0 16px; color: #6b7280; font-size: 14px;">Your plan will be cancelled in 7 days unless payment succeeds. Please update your payment method to keep your account active.</p>
            <div style="text-align: center; margin: 28px 0;">
              <a href="${manageBillingUrl}" style="display: inline-block; background-color: #0f172a; color: #ffffff; text-decoration: none; padding: 16px 32px; border-radius: 8px; font-size: 16px; font-weight: 600;">Manage Billing &rarr;</a>
            </div>
            <p style="margin: 0; color: #6b7280; font-size: 14px;">We will keep retrying automatically during the grace period.</p>
          </td>
        </tr>
        <tr><td style="background-color: #f9fafb; padding: 20px 32px; text-align: center; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb; border-top: none;"><p style="margin: 0; color: #9ca3af; font-size: 12px;">Valoxi. Acquire Smarter, Faster.</p></td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    const success = await (legacyEmailService as any).sendEmail({
      to,
      subject: `Action needed: your Valoxi ${planKey} subscription will be cancelled in 7 days`,
      html,
    });
    return { success, message: success ? 'Day 7 dunning email sent' : 'Failed to send day 7 dunning email' };
  }

  async sendDunningCancellationEmail(params: {
    to: string;
    firstName: string;
    planKey: string;
    billingUrl?: string;
  }): Promise<SendInvitationResult> {
    const { to, firstName, planKey, billingUrl } = params;
    const planLabels: Record<string, string> = {
      CORE: 'Core', PROFESSIONAL: 'Professional', EXPERT: 'Expert', ENTERPRISE: 'Enterprise',
    };
    const planLabel = planLabels[planKey] || planKey;
    const appUrl = process.env.APP_URL || 'https://test.valoxi.ai';
    const manageBillingUrl = billingUrl || `${appUrl}/billing`;

    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%;">
        <tr><td style="background-color: #0f172a; padding: 32px; text-align: center; border-radius: 8px 8px 0 0;"><h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700;">Valoxi</h1></td></tr>
        <tr>
          <td style="background-color: #ffffff; padding: 32px; border-left: 1px solid #e5e7eb; border-right: 1px solid #e5e7eb;">
            <p style="margin: 0 0 16px; color: #1f2937; font-size: 16px;">Hi ${firstName},</p>
            <p style="margin: 0 0 16px; color: #1f2937; font-size: 16px;">Your <strong>${planLabel}</strong> subscription has been cancelled because payment could not be collected during the grace period.</p>
            <p style="margin: 0 0 16px; color: #6b7280; font-size: 14px;">Your data is preserved for 30 days. You can sign back in with the same email address and re-subscribe when you are ready to reactivate your account.</p>
            <div style="text-align: center; margin: 28px 0;">
              <a href="${manageBillingUrl}" style="display: inline-block; background-color: #0f172a; color: #ffffff; text-decoration: none; padding: 16px 32px; border-radius: 8px; font-size: 16px; font-weight: 600;">Manage Billing &rarr;</a>
            </div>
            <p style="margin: 0; color: #6b7280; font-size: 14px;">If you need help, reply to this email and we will help you get back in.</p>
          </td>
        </tr>
        <tr><td style="background-color: #f9fafb; padding: 20px 32px; text-align: center; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb; border-top: none;"><p style="margin: 0; color: #9ca3af; font-size: 12px;">Valoxi. Acquire Smarter, Faster.</p></td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    const success = await (legacyEmailService as any).sendEmail({
      to,
      subject: `Your Valoxi ${planKey} subscription has been cancelled`,
      html,
    });
    return { success, message: success ? 'Dunning cancellation email sent' : 'Failed to send dunning cancellation email' };
  }
}

export const emailApiService = new EmailApiService();
