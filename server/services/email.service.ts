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
    const inviteUrl = `${baseUrl}/accept-invitation/${invitation.invitationToken}`;
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
}

export const emailApiService = new EmailApiService();
