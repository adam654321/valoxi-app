import { emailService as legacyEmailService } from '../email';
import { emailRepository } from '../repositories/email.repository';
import { NotFoundError, BadRequestError } from '../utils/errors';
import { escapeHtml } from '../utils/html';
import { renderBrandedEmail, type EmailBlock } from './email-template';
import { config } from '../config';
import { nylasService, NylasGrantBrokenError } from './nylas.service';
import { nylasRepository } from '../repositories/nylas.repository';

interface SendInvitationResult { success: boolean; message: string }
interface SendPortalLinkResult { success: boolean; message: string }

export class EmailApiService {
  async sendTeamInvitation(invitationId: number, baseUrl: string): Promise<SendInvitationResult> {
    const invitation = await emailRepository.getInvitationById(invitationId);
    if (!invitation) throw new NotFoundError('Invitation not found');
    if (!invitation.email) throw new BadRequestError('Invitation has no email address');
    const inviter = invitation.invitedBy ? await emailRepository.getUserById(invitation.invitedBy) : null;
    const inviterName = inviter
      ? `${inviter.firstName || ''} ${inviter.lastName || ''}`.trim() || inviter.email
      : 'Team Admin';
    const companyName = await emailRepository.getUserCompanyName(invitation.userCompanyId) || 'Company';
    const inviteUrl = `${baseUrl}/invite/${invitation.invitationToken}`;
    const inviteeFirstName = (invitation as any).firstName || 'there';
    const success = await legacyEmailService.sendTeamInvitation(
      invitation.email,
      inviteeFirstName,
      inviterName,
      companyName,
      invitation.invitationToken,
      inviteUrl,
      invitation.invitedRole || 'Team Member',
      (invitation as any).invitationMessage || undefined
    );
    return { success, message: success ? 'Invitation email sent successfully' : 'Failed to send invitation email' };
  }

  async sendPortalAccessLink(
    portalTokenId: number,
    baseUrl: string,
    triggeringUserId: number,
    customMessage?: string,
  ): Promise<{
    success: boolean;
    message: string;
    sentVia: 'nylas' | 'resend';
    fromEmail: string;
    replyToEmail: string | null;
  }> {
    const token = await emailRepository.getPortalTokenById(portalTokenId);
    if (!token) throw new NotFoundError('Portal token not found');
    const contact = await emailRepository.getContactById(token.targetContactId);
    if (!contact || !contact.email) throw new BadRequestError('Contact has no email address');
    const company = await emailRepository.getTargetCompanyById(token.targetCompanyId);
    if (!company) throw new NotFoundError('Company not found');

    const contactName = `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || 'Contact';
    const portalUrl = `${baseUrl}/portal/${token.accessToken}`;
    const safeContactName = escapeHtml(contactName);
    const safeCompanyName = escapeHtml(company.companyName);
    const expiryText = token.expiresAt
      ? `This link expires on ${new Date(token.expiresAt).toLocaleDateString('en-GB')}.`
      : 'This link has a limited validity period.';
    const resolvedMessage = customMessage || token.customMessage || undefined;

    const blocks: EmailBlock[] = [
      { type: 'paragraph', text: `Hello ${safeContactName},` },
      { type: 'paragraph', text: `You have been given secure access to the document portal for the <strong style="color:#FFFFFF;">${safeCompanyName}</strong> transaction.` },
    ];
    if (resolvedMessage && resolvedMessage.trim()) {
      blocks.push({
        type: 'info_box',
        box: { tone: 'info', body: escapeHtml(resolvedMessage.trim()) },
      });
    }
    blocks.push({ type: 'cta', cta: { label: 'Access document portal', href: portalUrl } });
    blocks.push({ type: 'paragraph', text: `${expiryText} Please do not share this link.` });

    const html = renderBrandedEmail({
      preheader: `Secure document portal access for the ${company.companyName} transaction.`,
      eyebrow: 'Portal access',
      heading: 'Your document portal is ready',
      blocks,
      footerLine: 'You are receiving this because secure document portal access was granted to your email address.',
    });

    const sendResult = await this.sendCustomerFacingEmail({
      to: contact.email,
      subject: `Document Portal Access — ${company.companyName}`,
      html,
      userCompanyId: token.userCompanyId,
      triggeringUserId,
    });

    return {
      success: sendResult.success,
      message: sendResult.success ? 'Portal access email sent successfully' : 'Failed to send portal access email',
      sentVia: sendResult.sentVia,
      fromEmail: sendResult.fromEmail,
      replyToEmail: sendResult.replyToEmail,
    };
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

  async sendCustomerFacingEmail(params: {
    to: string;
    subject: string;
    html: string;
    userCompanyId: number;
    triggeringUserId: number;
  }): Promise<{
    success: boolean;
    sentVia: 'nylas' | 'resend';
    fromEmail: string;
    replyToEmail: string | null;
    messageId?: string;
  }> {
    const grant = await nylasRepository.getCompanyDefaultGrant(params.userCompanyId);

    if (grant) {
      const personalGrant = await nylasRepository.getPersonalDefaultGrant(params.triggeringUserId);
      const replyToEmail = personalGrant?.email ?? null;

      try {
        const result = await nylasService.sendEmail(grant.grantId, {
          subject: params.subject,
          to: [{ email: params.to }],
          body: params.html,
          isPlainText: false,
          ...(replyToEmail ? { replyTo: [{ email: replyToEmail }] } : {}),
        });
        await nylasRepository.bumpLastUsed(grant.grantId);
        console.log(`[EMAIL] Sent via Nylas grant ${grant.grantId} (${grant.email}) to ${params.to}, messageId=${result.messageId}`);
        return {
          success: true,
          sentVia: 'nylas',
          fromEmail: grant.email,
          replyToEmail,
          messageId: result.messageId,
        };
      } catch (err: any) {
        if (err instanceof NylasGrantBrokenError) {
          console.error(`[EMAIL] Nylas grant ${grant.grantId} broken (${err.upstreamStatus}), marking and falling back to Resend`);
          await nylasRepository.markBroken(grant.grantId, err.message);
        } else {
          console.error(`[EMAIL] Nylas send failed for grant ${grant.grantId}, falling back to Resend:`, err);
        }
      }
    }

    const success = await (legacyEmailService as any).sendEmail({
      to: params.to,
      subject: params.subject,
      html: params.html,
    });
    const fromEmail = process.env.SMTP_FROM_EMAIL || 'noreply@send.valoxi.ai';
    return {
      success,
      sentVia: 'resend',
      fromEmail,
      replyToEmail: null,
    };
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
      CORE: '3 target companies &middot; Deal Modeller &middot; AI Screening',
      PROFESSIONAL: '15 target companies &middot; Full Expert Analysis &middot; Data Room &middot; Team Seats',
      EXPERT: '50 target companies &middot; All features &middot; Priority support',
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
    blocks.push({ type: 'paragraph', text: 'This invitation expires in 7 days. If it expires, contact <a href="mailto:support@valoxi.ai" style="color:#E05115;text-decoration:none;">support@valoxi.ai</a> for a new one.' });

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
    const safeFirstName = escapeHtml(firstName);

    const planLabels: Record<string, string> = {
      CORE: 'Core', PROFESSIONAL: 'Professional', EXPERT: 'Expert', ENTERPRISE: 'Enterprise',
    };
    const planLabel = planLabels[planKey] || planKey;

    const appUrl = process.env.APP_URL || 'https://test.valoxi.ai';
    const loginUrl = `${appUrl}/login`;

    const blocks: EmailBlock[] = [
      { type: 'paragraph', text: `Hi ${safeFirstName},` },
      { type: 'paragraph', text: `We have linked your <strong style="color:#FFFFFF;">${planLabel}</strong> subscription to your existing Valoxi account. Sign in to access everything.` },
      { type: 'cta', cta: { label: 'Log in to Valoxi', href: loginUrl } },
    ];

    const html = renderBrandedEmail({
      preheader: `Your ${planLabel} subscription is now linked to your Valoxi account.`,
      eyebrow: 'Subscription linked',
      heading: 'Your payment has been linked',
      blocks,
      footerLine: 'You are receiving this because a subscription was linked to your Valoxi account.',
    });

    const success = await (legacyEmailService as any).sendEmail({
      to,
      subject: 'Your Valoxi payment has been linked',
      html,
    });
    return { success, message: success ? 'Payment linked email sent' : 'Failed to send payment linked email' };
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
    const safeFirstName = escapeHtml(firstName);

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

    const blocks: EmailBlock[] = [
      { type: 'paragraph', text: `Hi ${safeFirstName},` },
      { type: 'paragraph', text: `Your <strong style="color:#FFFFFF;">${planLabel}</strong> annual plan renews in 7 days.` },
      {
        type: 'info_box',
        box: {
          tone: 'info',
          body: `<strong>Renewal date:</strong> ${dateStr}<br><strong>Amount:</strong> ${amount}`,
        },
      },
      { type: 'paragraph', text: 'Your card on file will be charged automatically. If you need to update your payment details or make any changes, visit your billing page before the renewal date.' },
      { type: 'cta', cta: { label: 'Manage billing', href: billingUrl } },
    ];

    const html = renderBrandedEmail({
      preheader: `Your Valoxi ${planLabel} plan renews on ${dateStr}.`,
      eyebrow: 'Renewal notice',
      heading: 'Your plan renews in 7 days',
      blocks,
      footerLine: 'You are receiving this because you have an active Valoxi subscription.',
    });

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
    const safeFirstName = escapeHtml(firstName);

    const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const dateStr = `${endDate.getDate()} ${months[endDate.getMonth()]} ${endDate.getFullYear()}`;
    const safeDateStr = escapeHtml(dateStr);

    const appUrl = process.env.APP_URL || 'https://test.valoxi.ai';
    const billingUrl = `${appUrl}/billing`;

    const blocks: EmailBlock[] = [
      { type: 'paragraph', text: `Hi ${safeFirstName},` },
      { type: 'paragraph', text: `Your 3 month free period of Valoxi Core ends on <strong style="color:#FFFFFF;">${safeDateStr}</strong>. To keep your access active, add payment details before that date.` },
      { type: 'paragraph', text: 'When you add payment details, your 15 percent member discount applies automatically to your Core subscription and to any plan you upgrade to later.' },
      { type: 'cta', cta: { label: 'Add payment details', href: billingUrl } },
      {
        type: 'info_box',
        box: {
          tone: 'warning',
          body: `If you do not add payment details before ${safeDateStr}, your access will pause and your data will be preserved for 30 days. You can restore everything by signing back in with the same email and completing signup within that window.`,
        },
      },
    ];

    const html = renderBrandedEmail({
      preheader: `Your free period ends on ${dateStr}. Add payment details to keep your access active.`,
      eyebrow: 'Action required',
      heading: 'Your free period ends soon',
      blocks,
      footerLine: 'You are receiving this because you are on a Valoxi free period that is about to end.',
    });

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
    const safeFirstName = escapeHtml(firstName);

    const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const formatDate = (d: Date) => `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
    const safeEndDate = escapeHtml(formatDate(endDate));
    const safeRestoreByDate = escapeHtml(formatDate(restoreByDate));

    const appUrl = process.env.APP_URL || 'https://test.valoxi.ai';
    const signupUrl = `${appUrl}/sign-up`;

    const blocks: EmailBlock[] = [
      { type: 'paragraph', text: `Hi ${safeFirstName},` },
      { type: 'paragraph', text: `Your 3 month free period of Valoxi Core ended on <strong style="color:#FFFFFF;">${safeEndDate}</strong> and your access has now paused because no payment details were added.` },
      { type: 'paragraph', text: `Your data is preserved for 30 days. You can restore everything by signing back in with the same email and completing signup before <strong style="color:#FFFFFF;">${safeRestoreByDate}</strong>. After that date the account will be closed.` },
      { type: 'paragraph', text: 'If you want to continue with Valoxi, use the link below with the same email address.' },
      { type: 'cta', cta: { label: 'Restore your account', href: signupUrl } },
    ];

    const html = renderBrandedEmail({
      preheader: `Your Valoxi Core free period has ended. You have until ${formatDate(restoreByDate)} to restore.`,
      eyebrow: 'Access paused',
      heading: 'Your free period has ended',
      blocks,
      footerLine: 'You are receiving this because your Valoxi free period has ended.',
    });

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
    const safeFirstName = escapeHtml(firstName);
    const planLabels: Record<string, string> = {
      CORE: 'Core', PROFESSIONAL: 'Professional', EXPERT: 'Expert', ENTERPRISE: 'Enterprise',
    };
    const planLabel = planLabels[planKey] || planKey;
    const appUrl = process.env.APP_URL || 'https://test.valoxi.ai';
    const manageBillingUrl = billingUrl || `${appUrl}/billing`;

    const blocks: EmailBlock[] = [
      { type: 'paragraph', text: `Hi ${safeFirstName},` },
      { type: 'paragraph', text: `We could not collect payment for your <strong style="color:#FFFFFF;">${planLabel}</strong> plan.` },
      { type: 'paragraph', text: 'We will retry payment automatically. Your account has a 14 day grace period, so please update your payment method as soon as you can.' },
      { type: 'cta', cta: { label: 'Manage billing', href: manageBillingUrl } },
      { type: 'paragraph', text: 'If you have already updated your card, no further action is needed.' },
    ];

    const html = renderBrandedEmail({
      preheader: `Payment could not be collected for your Valoxi ${planLabel} plan.`,
      eyebrow: 'Payment failed',
      heading: 'We could not process your payment',
      blocks,
      footerLine: 'You are receiving this because a payment on your Valoxi subscription failed.',
    });

    const success = await (legacyEmailService as any).sendEmail({
      to,
      subject: `Payment failed for your Valoxi ${planLabel} plan`,
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
    const safeFirstName = escapeHtml(firstName);
    const planLabels: Record<string, string> = {
      CORE: 'Core', PROFESSIONAL: 'Professional', EXPERT: 'Expert', ENTERPRISE: 'Enterprise',
    };
    const planLabel = planLabels[planKey] || planKey;
    const appUrl = process.env.APP_URL || 'https://test.valoxi.ai';
    const manageBillingUrl = billingUrl || `${appUrl}/billing`;

    const blocks: EmailBlock[] = [
      { type: 'paragraph', text: `Hi ${safeFirstName},` },
      { type: 'paragraph', text: `Payment is still failing for your <strong style="color:#FFFFFF;">${planLabel}</strong> plan.` },
      {
        type: 'info_box',
        box: {
          tone: 'warning',
          body: 'Your subscription will be cancelled in 7 days unless payment succeeds. Please update your payment method to keep your account active.',
        },
      },
      { type: 'cta', cta: { label: 'Manage billing', href: manageBillingUrl } },
      { type: 'paragraph', text: 'We will keep retrying automatically during the grace period.' },
    ];

    const html = renderBrandedEmail({
      preheader: `Action needed: your Valoxi ${planLabel} subscription will be cancelled in 7 days.`,
      eyebrow: 'Action required',
      heading: 'Your subscription will be cancelled in 7 days',
      blocks,
      footerLine: 'You are receiving this because a payment on your Valoxi subscription continues to fail.',
    });

    const success = await (legacyEmailService as any).sendEmail({
      to,
      subject: `Action needed: your Valoxi ${planLabel} subscription will be cancelled in 7 days`,
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
    const safeFirstName = escapeHtml(firstName);
    const planLabels: Record<string, string> = {
      CORE: 'Core', PROFESSIONAL: 'Professional', EXPERT: 'Expert', ENTERPRISE: 'Enterprise',
    };
    const planLabel = planLabels[planKey] || planKey;
    const appUrl = process.env.APP_URL || 'https://test.valoxi.ai';
    const manageBillingUrl = billingUrl || `${appUrl}/billing`;

    const blocks: EmailBlock[] = [
      { type: 'paragraph', text: `Hi ${safeFirstName},` },
      { type: 'paragraph', text: `Your <strong style="color:#FFFFFF;">${planLabel}</strong> subscription has been cancelled because payment could not be collected during the grace period.` },
      { type: 'paragraph', text: 'Your data is preserved for 30 days. You can sign back in with the same email address and re-subscribe when you are ready to reactivate your account.' },
      { type: 'cta', cta: { label: 'Manage billing', href: manageBillingUrl } },
      { type: 'paragraph', text: 'If you need help, reply to this email and we will help you get back in.' },
    ];

    const html = renderBrandedEmail({
      preheader: `Your Valoxi ${planLabel} subscription has been cancelled.`,
      eyebrow: 'Subscription cancelled',
      heading: 'Your subscription has been cancelled',
      blocks,
      footerLine: 'You are receiving this because your Valoxi subscription was cancelled.',
    });

    const success = await (legacyEmailService as any).sendEmail({
      to,
      subject: `Your Valoxi ${planLabel} subscription has been cancelled`,
      html,
    });
    return { success, message: success ? 'Dunning cancellation email sent' : 'Failed to send dunning cancellation email' };
  }

  async sendMarketingConsentRequest(params: {
    to: string;
    firstName: string;
    consentUrl: string;
  }): Promise<SendInvitationResult> {
    const { to, firstName, consentUrl } = params;
    const safeFirstName = escapeHtml(firstName);

    const blocks: EmailBlock[] = [
      { type: 'paragraph', text: `Hi ${safeFirstName},` },
      {
        type: 'paragraph',
        text: "We're tightening up how we handle marketing emails to match what we promise in our privacy policy. Right now we don't have a record of whether you'd like to hear product news and updates from us, so we're asking explicitly.",
      },
      {
        type: 'paragraph',
        text: "If you'd like Valoxi product updates and useful resources by email, click the button below. We'll keep them occasional and you can unsubscribe at any time.",
      },
      {
        type: 'cta',
        cta: { label: 'Yes, send me product updates', href: consentUrl },
      },
      {
        type: 'paragraph',
        text: "If marketing emails aren't for you, you don't need to do anything. Closing this email keeps your current preference (no marketing emails). You'll still receive account, billing, and security emails from us regardless. Those aren't affected by this preference.",
      },
      { type: 'paragraph', text: 'Thanks,<br/>The Valoxi team' },
    ];

    const html = renderBrandedEmail({
      preheader: 'A quick yes-or-no on marketing emails. Doing nothing is fine.',
      eyebrow: 'Marketing preferences',
      heading: 'Quick yes-or-no on marketing emails',
      blocks,
      footerLine:
        'This is a one-off transactional email about your marketing preferences. We will not send another like it. Account, billing, and security emails are unaffected.',
    });

    const success = await (legacyEmailService as any).sendEmail({
      to,
      subject: 'Quick yes-or-no on marketing emails from Valoxi',
      html,
    });

    return {
      success,
      message: success
        ? 'Marketing consent request email sent'
        : 'Failed to send marketing consent request email',
    };
  }

  // 5D partner subsidy digest. ONE email per cron run listing the new members
  // billed this period and the total. Upfront model: each member is the full
  // free-period subsidy. Amounts are USD cents (5D is always billed USD).
  async sendTrialExtensionEmail(params: {
    to: string;
    firstName: string;
    newTrialEnd: Date;
  }): Promise<SendInvitationResult> {
    const { to, firstName, newTrialEnd } = params;
    const safeFirstName = escapeHtml(firstName);

    const formatDateTime = (d: Date): string => {
      const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()} at ${hh}:${mm}`;
    };

    const blocks: EmailBlock[] = [
      { type: 'paragraph', text: `Hi ${safeFirstName},` },
      { type: 'paragraph', text: 'We hope you have had a chance to explore Valoxi over the last 48 hours.' },
      { type: 'paragraph', text: 'We would love you to have a little more time, so we have added an extra 24 hours to your trial - no action needed on your part.' },
      {
        type: 'info_box',
        box: {
          tone: 'info',
          body: `Your trial now ends on <strong>${escapeHtml(formatDateTime(newTrialEnd))}</strong>.`,
        },
      },
      { type: 'paragraph', text: 'After that, your card will be charged and your subscription will begin automatically.' },
      { type: 'paragraph', text: 'If you have any questions or want to talk through what you have seen so far, just reply to this email.' },
      { type: 'paragraph', text: 'Adam Auty<br/>Founder, Valoxi' },
    ];

    const html = renderBrandedEmail({
      preheader: 'We have added an extra 24 hours to your Valoxi trial.',
      eyebrow: 'Trial extended',
      heading: 'You have got an extra 24 hours on us',
      blocks,
      footerLine: 'You are receiving this because you have an active Valoxi trial.',
    });

    const success = await (legacyEmailService as any).sendEmail({
      to,
      subject: 'You have got an extra 24 hours on us',
      html,
    });
    return { success, message: success ? 'Trial extension email sent' : 'Failed to send trial extension email' };
  }

  async sendTrialWarningEmail(params: {
    to: string;
    firstName: string;
    trialEndsAt: Date;
  }): Promise<SendInvitationResult> {
    const { to, firstName, trialEndsAt } = params;
    const safeFirstName = escapeHtml(firstName);

    const formatDateTime = (d: Date): string => {
      const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()} at ${hh}:${mm}`;
    };

    const appUrl = process.env.APP_URL || 'https://test.valoxi.ai';

    const blocks: EmailBlock[] = [
      { type: 'paragraph', text: `Hi ${safeFirstName},` },
      { type: 'paragraph', text: `Your free trial ends on <strong>${escapeHtml(formatDateTime(trialEndsAt))}</strong>.` },
      { type: 'paragraph', text: 'After that, your subscription will begin and your card will be charged automatically.' },
      { type: 'paragraph', text: `If you would like to cancel before then, you can do so from your <a href="${appUrl}/settings">account settings</a>.` },
      { type: 'paragraph', text: 'If you have any questions, just reply to this email.' },
      { type: 'paragraph', text: 'Adam Auty<br/>Founder, Valoxi' },
    ];

    const html = renderBrandedEmail({
      preheader: 'Your Valoxi free trial is ending soon.',
      eyebrow: 'Trial ending',
      heading: 'Your Valoxi trial ends soon',
      blocks,
      footerLine: 'You are receiving this because you have an active Valoxi trial.',
    });

    const success = await (legacyEmailService as any).sendEmail({
      to,
      subject: 'Your Valoxi trial ends soon',
      html,
    });
    return { success, message: success ? 'Trial warning email sent' : 'Failed to send trial warning email' };
  }

  async sendFiveDPartnerInvoice(params: {
    to: string;
    billingMonth: string; // 'YYYY-MM'
    members: Array<{ companyName: string | null; email: string | null; freeMonths: number; amountCents: number }>;
    totalCents: number;
  }): Promise<SendInvitationResult> {
    const { to, billingMonth, members, totalCents } = params;

    const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const [yr, mo] = billingMonth.split('-');
    const monthIdx = Math.max(0, Math.min(11, parseInt(mo, 10) - 1));
    const monthLabel = `${months[monthIdx]} ${yr}`;
    const fmt = (cents: number) => `$${(cents / 100).toFixed(2)}`;

    const lines = members
      .map((m) =>
        `${escapeHtml(m.companyName || 'Unknown company')} (${escapeHtml(m.email || 'no email')}) &mdash; ${m.freeMonths} months &mdash; <strong>${fmt(m.amountCents)}</strong>`
      )
      .join('<br>');

    const blocks: EmailBlock[] = [
      { type: 'paragraph', text: `New Valoxi 5D members for <strong style="color:#FFFFFF;">${escapeHtml(monthLabel)}</strong>. The 3 month free period is subsidised upfront at the discounted Core rate.` },
      {
        type: 'info_box',
        box: {
          tone: 'info',
          title: `New members this period: ${members.length}`,
          body: lines || 'No new members.',
        },
      },
      { type: 'paragraph', text: `<strong style="color:#FFFFFF;">Total due: ${fmt(totalCents)}</strong>` },
    ];

    const html = renderBrandedEmail({
      preheader: `Valoxi 5D subsidy invoice for ${monthLabel}: ${members.length} new members, ${fmt(totalCents)}.`,
      eyebrow: 'Subsidy invoice',
      heading: `5D New Member subsidy &mdash; ${monthLabel}`,
      blocks,
      footerLine: 'You are receiving this because you are the registered 5D partner billing contact.',
    });

    const success = await (legacyEmailService as any).sendEmail({
      to,
      subject: `Valoxi 5D New Member subsidy invoice — ${monthLabel}`,
      html,
    });
    return { success, message: success ? '5D partner invoice sent' : 'Failed to send 5D partner invoice' };
  }
}

export const emailApiService = new EmailApiService();
