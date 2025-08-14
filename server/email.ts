import nodemailer from 'nodemailer';

interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
}

interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
}

class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  private fromEmail: string;

  constructor() {
    this.fromEmail = process.env.SMTP_FROM_EMAIL || 'noreply@yourcompany.com';
    this.setupTransporter();
  }

  private setupTransporter() {
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = process.env.SMTP_PORT;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;

    if (!smtpHost || !smtpPort || !smtpUser || !smtpPass) {
      console.warn('Email service not configured - missing SMTP environment variables');
      return;
    }

    const config: EmailConfig = {
      host: smtpHost,
      port: parseInt(smtpPort),
      secure: parseInt(smtpPort) === 465, // true for 465, false for other ports
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    };

    this.transporter = nodemailer.createTransport(config);
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    if (!this.transporter) {
      console.error('Email transporter not configured');
      return false;
    }

    try {
      const mailOptions = {
        from: options.from || this.fromEmail,
        to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
        subject: options.subject,
        html: options.html,
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log('Email sent successfully:', info.messageId);
      return true;
    } catch (error) {
      console.error('Failed to send email:', error);
      return false;
    }
  }

  // Team invitation email
  async sendTeamInvitation(
    inviteEmail: string, 
    inviterName: string, 
    companyName: string,
    inviteToken: string,
    inviteUrl: string,
    roleName: string
  ): Promise<boolean> {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Team Invitation</title>
          <style>
            .container { max-width: 600px; margin: 0 auto; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #ffffff; padding: 30px; border: 1px solid #e1e5e9; }
            .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
            .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 14px; color: #6c757d; border-radius: 0 0 8px 8px; }
            .highlight { background: #f8f9fa; padding: 15px; border-left: 4px solid #667eea; margin: 15px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎉 You're Invited to Join Our Team!</h1>
            </div>
            <div class="content">
              <p>Hello,</p>
              
              <p><strong>${inviterName}</strong> has invited you to join the <strong>${companyName}</strong> team on our M&A CRM platform.</p>
              
              <div class="highlight">
                <p><strong>Your Role:</strong> ${roleName}</p>
                <p><strong>Company:</strong> ${companyName}</p>
              </div>
              
              <p>Click the button below to accept your invitation and set up your account:</p>
              
              <p style="text-align: center;">
                <a href="${inviteUrl}" class="button">Accept Invitation & Join Team</a>
              </p>
              
              <p><small><strong>Note:</strong> This invitation link will expire in 7 days. If you need a new invitation, please contact ${inviterName}.</small></p>
              
              <p>Welcome to the team!</p>
              
              <p>Best regards,<br>
              The ${companyName} Team</p>
            </div>
            <div class="footer">
              <p>This is an automated email from your M&A CRM system.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail({
      to: inviteEmail,
      subject: `🎉 You're invited to join ${companyName}`,
      html
    });
  }

  // Portal access link email
  async sendPortalAccessLink(
    contactEmail: string,
    contactName: string,
    companyName: string,
    portalUrl: string,
    customMessage?: string,
    expiresAt?: Date
  ): Promise<boolean> {
    const expiryText = expiresAt ? 
      `This secure link expires on ${expiresAt.toLocaleDateString()} at ${expiresAt.toLocaleTimeString()}.` :
      'This secure link has a limited validity period.';

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Secure Document Portal Access</title>
          <style>
            .container { max-width: 600px; margin: 0 auto; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
            .header { background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #ffffff; padding: 30px; border: 1px solid #e1e5e9; }
            .button { display: inline-block; padding: 15px 30px; background: #28a745; color: white; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
            .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 14px; color: #6c757d; border-radius: 0 0 8px 8px; }
            .security-notice { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 6px; margin: 20px 0; }
            .custom-message { background: #e3f2fd; border-left: 4px solid #2196f3; padding: 15px; margin: 15px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔐 Secure Document Portal Access</h1>
            </div>
            <div class="content">
              <p>Hello ${contactName},</p>
              
              <p>You now have secure access to our document portal for the ${companyName} transaction.</p>
              
              ${customMessage ? `
                <div class="custom-message">
                  <p><strong>Message from your deal team:</strong></p>
                  <p>${customMessage}</p>
                </div>
              ` : ''}
              
              <p>Use this portal to:</p>
              <ul>
                <li>📤 Upload required documents securely</li>
                <li>📋 View document requirements and status</li>
                <li>💬 Submit notes and additional information</li>
                <li>📊 Track your submission progress</li>
              </ul>
              
              <p style="text-align: center;">
                <a href="${portalUrl}" class="button">Access Document Portal</a>
              </p>
              
              <div class="security-notice">
                <p><strong>🔒 Security Notice:</strong></p>
                <p>This is a secure, encrypted portal designed specifically for your transaction. ${expiryText}</p>
                <p>Do not share this link with anyone else.</p>
              </div>
              
              <p>If you have any questions or need assistance, please contact your deal team directly.</p>
              
              <p>Best regards,<br>
              The ${companyName} Deal Team</p>
            </div>
            <div class="footer">
              <p>This is a secure communication from your M&A CRM system.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail({
      to: contactEmail,
      subject: `🔐 Secure Document Portal Access - ${companyName}`,
      html
    });
  }

  // Portal document received notification (internal)
  async sendDocumentReceivedNotification(
    teamEmails: string[],
    contactName: string,
    companyName: string,
    documentName: string,
    documentCategory: string,
    submissionNotes?: string
  ): Promise<boolean> {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>New Document Received</title>
          <style>
            .container { max-width: 600px; margin: 0 auto; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
            .header { background: linear-gradient(135deg, #17a2b8 0%, #138496 100%); color: white; padding: 25px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #ffffff; padding: 25px; border: 1px solid #e1e5e9; }
            .document-details { background: #f8f9fa; padding: 20px; border-radius: 6px; margin: 15px 0; }
            .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 14px; color: #6c757d; border-radius: 0 0 8px 8px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>📄 New Document Received</h1>
            </div>
            <div class="content">
              <p>A new document has been submitted through the external document portal.</p>
              
              <div class="document-details">
                <p><strong>From:</strong> ${contactName}</p>
                <p><strong>Company:</strong> ${companyName}</p>
                <p><strong>Document:</strong> ${documentName}</p>
                <p><strong>Category:</strong> ${documentCategory}</p>
                ${submissionNotes ? `<p><strong>Notes:</strong> ${submissionNotes}</p>` : ''}
              </div>
              
              <p>The document has been automatically added to your CRM system and is available for review in the target company's document section.</p>
              
              <p>Best regards,<br>
              Your M&A CRM System</p>
            </div>
            <div class="footer">
              <p>This is an automated notification from your M&A CRM system.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail({
      to: teamEmails,
      subject: `📄 New Document: ${documentName} from ${contactName}`,
      html
    });
  }

  // Test email connection
  async testConnection(): Promise<boolean> {
    if (!this.transporter) {
      return false;
    }

    try {
      await this.transporter.verify();
      console.log('SMTP connection verified successfully');
      return true;
    } catch (error) {
      console.error('SMTP connection failed:', error);
      return false;
    }
  }
}

export const emailService = new EmailService();