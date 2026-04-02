import { emailService as legacyEmailService } from '../email';
import { emailRepository } from '../repositories/email.repository';
import { NotFoundError, BadRequestError } from '../utils/errors';

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

    const planLabels: Record<string, string> = {
      CORE: 'Core',
      PROFESSIONAL: 'Professional',
      EXPERT: 'Expert',
      ENTERPRISE: 'Enterprise',
    };
    const planLabel = planLabels[planKey] || planKey;

    const planDescriptions: Record<string, string> = {
      CORE: '5 target companies &middot; Deal Modeller &middot; AI Screening',
      PROFESSIONAL: '20 target companies &middot; Full Expert Analysis &middot; Data Room &middot; Team Seats',
      EXPERT: '100 target companies &middot; All features &middot; Priority support',
    };
    const planDesc = planDescriptions[planKey] || '';

    function formatDate(d: Date): string {
      const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
      return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
    }

    let periodBox = '';
    if (freeMonths > 0) {
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + freeMonths);
      periodBox = `
        <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin: 20px 0;">
          <p style="margin: 0; color: #166534; font-size: 14px;">Your <strong>${freeMonths} months free</strong> period starts today. No charge until <strong>${formatDate(endDate)}</strong>.</p>
        </div>`;
    } else if (trialDays > 0) {
      const endDate = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000);
      periodBox = `
        <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 16px; margin: 20px 0;">
          <p style="margin: 0; color: #1e40af; font-size: 14px;">Your <strong>7-day free trial</strong> has started. You won't be charged until <strong>${formatDate(endDate)}</strong>.</p>
        </div>`;
    }

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
            <p style="margin: 0 0 16px; color: #1f2937; font-size: 16px;">Your <strong>${planLabel}</strong> plan is now active.</p>
            ${periodBox}
            <div style="text-align: center; margin: 28px 0;">
              <a href="${magicLink}" style="display: inline-block; background-color: #0f172a; color: #ffffff; text-decoration: none; padding: 16px 32px; border-radius: 8px; font-size: 16px; font-weight: 600;">Access Valoxi &rarr;</a>
            </div>
            <p style="margin: 0 0 16px; color: #6b7280; font-size: 13px;">This link expires in 72 hours. If it expires, visit the login page to request a new one.</p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
            ${planDesc ? `
            <div style="background-color: #f9fafb; border-radius: 8px; padding: 16px; margin: 0 0 16px;">
              <p style="margin: 0 0 4px; color: #374151; font-size: 13px; font-weight: 600;">${planLabel} Plan</p>
              <p style="margin: 0; color: #6b7280; font-size: 13px;">${planDesc}</p>
            </div>` : ''}
            <p style="margin: 0; color: #6b7280; font-size: 14px;">Questions? Reply to this email and we'll get back to you.</p>
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
      subject: 'Welcome to Valoxi — click here to access your account',
      html,
    });
    return { success, message: success ? 'Welcome email sent' : 'Failed to send welcome email' };
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
            <p style="margin: 0 0 16px; color: #1f2937; font-size: 16px;">Here's your login link. Click below to access your account.</p>
            <div style="text-align: center; margin: 28px 0;">
              <a href="${magicLink}" style="display: inline-block; background-color: #0f172a; color: #ffffff; text-decoration: none; padding: 16px 32px; border-radius: 8px; font-size: 16px; font-weight: 600;">Log In to Valoxi &rarr;</a>
            </div>
            <p style="margin: 0; color: #6b7280; font-size: 13px;">This link expires in 72 hours.</p>
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
      subject: 'Your Valoxi login link',
      html,
    });
    return { success, message: success ? 'Magic link email sent' : 'Failed to send magic link email' };
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
}

export const emailApiService = new EmailApiService();
