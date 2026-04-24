import { Resend } from 'resend';
import { renderBrandedEmail, type EmailBlock } from './services/email-template';

interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
}

class EmailService {
  private resend: Resend | null = null;
  private fromEmail: string;

  constructor() {
    this.fromEmail = process.env.SMTP_FROM_EMAIL || 'noreply@send.valoxi.ai';
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.warn('Email service not configured — RESEND_API_KEY missing');
      return;
    }
    this.resend = new Resend(apiKey);
    console.log('Resend email service initialised');
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    if (!this.resend) {
      console.error('Resend not configured — email not sent');
      return false;
    }
    try {
      const { data, error } = await this.resend.emails.send({
        from: options.from || this.fromEmail,
        to: Array.isArray(options.to) ? options.to : [options.to],
        subject: options.subject,
        html: options.html,
      });
      if (error) {
        console.error('Resend send error:', error);
        return false;
      }
      console.log('Email sent via Resend:', data?.id);
      return true;
    } catch (err) {
      console.error('Resend exception:', err);
      return false;
    }
  }

  async sendTeamInvitation(
    inviteEmail: string,
    inviterName: string,
    companyName: string,
    inviteToken: string,
    inviteUrl: string,
    roleName: string
  ): Promise<boolean> {
    const safeInviterName = this.escapeHtml(inviterName);
    const safeCompanyName = this.escapeHtml(companyName);
    const safeRoleName = this.escapeHtml(roleName);

    const blocks: EmailBlock[] = [
      { type: 'paragraph', text: 'Hello,' },
      { type: 'paragraph', text: `<strong style="color:#FFFFFF;">${safeInviterName}</strong> has invited you to join the <strong style="color:#FFFFFF;">${safeCompanyName}</strong> team on Valoxi.` },
      {
        type: 'info_box',
        box: {
          tone: 'info',
          body: `<strong>Role:</strong> ${safeRoleName}<br><strong>Company:</strong> ${safeCompanyName}`,
        },
      },
      { type: 'cta', cta: { label: 'Accept invitation', href: inviteUrl } },
      { type: 'paragraph', text: 'This invitation expires in 7 days.' },
    ];

    const html = renderBrandedEmail({
      preheader: `${inviterName} has invited you to join ${companyName} on Valoxi.`,
      eyebrow: 'Team invitation',
      heading: `Join ${safeCompanyName} on Valoxi`,
      blocks,
      footerLine: 'You are receiving this because a Valoxi user invited you to join their team.',
    });

    return this.sendEmail({
      to: inviteEmail,
      subject: `You're invited to join ${companyName} on Valoxi`,
      html,
    });
  }

  async sendPortalAccessLink(
    contactEmail: string,
    contactName: string,
    companyName: string,
    portalUrl: string,
    customMessage?: string,
    expiresAt?: Date
  ): Promise<boolean> {
    const safeContactName = this.escapeHtml(contactName);
    const safeCompanyName = this.escapeHtml(companyName);
    const expiryText = expiresAt
      ? `This link expires on ${expiresAt.toLocaleDateString('en-GB')}.`
      : 'This link has a limited validity period.';

    const blocks: EmailBlock[] = [
      { type: 'paragraph', text: `Hello ${safeContactName},` },
      { type: 'paragraph', text: `You have been given secure access to the document portal for the <strong style="color:#FFFFFF;">${safeCompanyName}</strong> transaction.` },
    ];

    if (customMessage && customMessage.trim()) {
      blocks.push({
        type: 'info_box',
        box: { tone: 'info', body: this.escapeHtml(customMessage.trim()) },
      });
    }

    blocks.push({ type: 'cta', cta: { label: 'Access document portal', href: portalUrl } });
    blocks.push({ type: 'paragraph', text: `${expiryText} Please do not share this link.` });

    const html = renderBrandedEmail({
      preheader: `Secure document portal access for the ${companyName} transaction.`,
      eyebrow: 'Portal access',
      heading: 'Your document portal is ready',
      blocks,
      footerLine: 'You are receiving this because secure document portal access was granted to your email address.',
    });

    return this.sendEmail({
      to: contactEmail,
      subject: `Document Portal Access — ${companyName}`,
      html,
    });
  }

  async sendDocumentReceivedNotification(
    teamEmails: string[],
    contactName: string,
    companyName: string,
    documentName: string,
    documentCategory: string,
    submissionNotes?: string
  ): Promise<boolean> {
    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <tr><td style="background-color:#0f172a;padding:32px;text-align:center;border-radius:8px 8px 0 0;">
          <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;">Valoxi</h1>
        </td></tr>
        <tr><td style="background-color:#ffffff;padding:32px;border-left:1px solid #e5e7eb;border-right:1px solid #e5e7eb;">
          <p style="margin:0 0 16px;color:#1f2937;font-size:16px;">A new document has been submitted via the seller portal.</p>
          <div style="background-color:#f9fafb;border-radius:8px;padding:16px;margin:20px 0;">
            <p style="margin:0 0 8px;color:#374151;font-size:14px;"><strong>From:</strong> ${contactName}</p>
            <p style="margin:0 0 8px;color:#374151;font-size:14px;"><strong>Company:</strong> ${companyName}</p>
            <p style="margin:0 0 8px;color:#374151;font-size:14px;"><strong>Document:</strong> ${documentName}</p>
            <p style="margin:0 0 ${submissionNotes ? '8px' : '0'};color:#374151;font-size:14px;"><strong>Category:</strong> ${documentCategory}</p>
            ${submissionNotes ? `<p style="margin:0;color:#374151;font-size:14px;"><strong>Notes:</strong> ${submissionNotes}</p>` : ''}
          </div>
          <p style="margin:0;color:#6b7280;font-size:14px;">The document is available in the target company's document section.</p>
        </td></tr>
        <tr><td style="background-color:#f9fafb;padding:20px 32px;text-align:center;border-radius:0 0 8px 8px;border:1px solid #e5e7eb;border-top:none;">
          <p style="margin:0;color:#9ca3af;font-size:12px;">Valoxi.ai</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
    return this.sendEmail({
      to: teamEmails,
      subject: `New document received: ${documentName} from ${contactName}`,
      html,
    });
  }

  async testConnection(): Promise<boolean> {
    if (!this.resend) return false;
    try {
      const { error } = await this.resend.emails.send({
        from: this.fromEmail,
        to: ['delivered@resend.dev'],
        subject: 'Valoxi connection test',
        html: '<p>Connection test</p>',
      });
      return !error;
    } catch {
      return false;
    }
  }

  private escapeHtml(str: string): string {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}

export const emailService = new EmailService();
