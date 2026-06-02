import { chaseUpRepository } from '../repositories/chase-up.repository';
import { portalRequirementsRepository } from '../repositories/portal-requirements.repository';
import { portalRepository } from '../repositories/portal.repository';
import { emailRepository } from '../repositories/email.repository';
import { emailApiService } from './email.service';
import { BadRequestError, NotFoundError } from '../utils/errors';
import type { ChaseUpSchedule, InsertChaseUpSchedule } from '@shared/schema';
import { portalAccessTokens } from '@shared/schema';
import { db } from '../db';
import { eq } from 'drizzle-orm';

const EMAIL_TYPES = {
  1: { type: 'gentle', label: 'Gentle Reminder', subject: 'Friendly Reminder: Document Submission' },
  2: { type: 'firm', label: 'Firm Reminder', subject: 'Important: Document Submission Required' },
  3: { type: 'urgent', label: 'Urgent Reminder', subject: 'Urgent: Immediate Document Submission Required' },
  4: { type: 'final', label: 'Final Notice', subject: 'Final Notice: Document Submission Deadline' },
} as const;

export class ChaseUpService {
  async setPortalTimeframe(portalTokenId: number, timeframeDays: number, userId: number): Promise<ChaseUpSchedule> {
    const token = await portalRepository.getTokenById(portalTokenId);
    if (!token) throw new NotFoundError('Portal token not found');

    const existingSchedule = await chaseUpRepository.getScheduleByTokenId(portalTokenId);
    if (existingSchedule) {
      throw new BadRequestError('Chase-up schedule already exists for this portal link');
    }

    const submissionDeadline = new Date();
    submissionDeadline.setDate(submissionDeadline.getDate() + timeframeDays);
    const deadlineString = submissionDeadline.toISOString().split('T')[0];

    const schedule = await chaseUpRepository.createSchedule({
      portalTokenId,
      targetCompanyId: token.targetCompanyId,
      timeframeDays,
      submissionDeadline: deadlineString,
      createdBy: userId,
    });

    // Compute finalDeadlineDate = submissionDeadline + manualDeadlineDelayDays.
    // Rule D backstop: defence in depth in case Rule A regresses.
    const finalDeadline = new Date(deadlineString);
    finalDeadline.setDate(finalDeadline.getDate() + (schedule.manualDeadlineDelayDays || 11));
    const finalDeadlineString = finalDeadline.toISOString().split('T')[0];

    await chaseUpRepository.updateTokenDeadline(portalTokenId, deadlineString, finalDeadlineString);

    await chaseUpRepository.updateTokenChaseUpStatus(portalTokenId, 'within_timeframe', 'none');

    return schedule;
  }

  async extendTimeframe(portalTokenId: number, additionalDays: number, userId: number): Promise<ChaseUpSchedule | { extended: true; newExpiresAt: string }> {
    const [token] = await db.select().from(portalAccessTokens).where(eq(portalAccessTokens.id, portalTokenId));
    if (!token) throw new NotFoundError('Portal token not found');

    // Anchor the new expiry to whichever is later, the current expiry or now.
    // Guarantees "extend by N days" always yields N days of access from now,
    // even when the token has already expired. Applied to both paths (#203).
    const now = new Date();
    const base = token.expiresAt ? new Date(token.expiresAt) : now;
    const anchor = base > now ? new Date(base) : new Date(now);
    anchor.setDate(anchor.getDate() + additionalDays);

    const schedule = await chaseUpRepository.getScheduleByTokenId(portalTokenId);

    if (!schedule) {
      await db.update(portalAccessTokens).set({
        expiresAt: anchor,
        submissionDeadline: anchor.toISOString().split('T')[0],
      }).where(eq(portalAccessTokens.id, portalTokenId));

      return { extended: true, newExpiresAt: anchor.toISOString() };
    }

    const currentDeadline = new Date(schedule.submissionDeadline);
    currentDeadline.setDate(currentDeadline.getDate() + additionalDays);
    const newDeadlineString = currentDeadline.toISOString().split('T')[0];

    // Recompute finalDeadlineDate from new deadline. Backfills legacy nulls
    // on first extension, which is the desired behaviour.
    const newFinalDeadline = new Date(newDeadlineString);
    newFinalDeadline.setDate(newFinalDeadline.getDate() + (schedule.manualDeadlineDelayDays || 11));
    const newFinalDeadlineString = newFinalDeadline.toISOString().split('T')[0];

    await chaseUpRepository.updateTokenDeadline(portalTokenId, newDeadlineString, newFinalDeadlineString, anchor);

    const updated = await chaseUpRepository.updateSchedule(schedule.id, {
      submissionDeadline: newDeadlineString,
      timeframeDays: schedule.timeframeDays + additionalDays,
    });

    await chaseUpRepository.updateTokenChaseUpStatus(portalTokenId, 'within_timeframe', 'none');

    return updated!;
  }

  async stopChaseUp(portalTokenId: number, reason: string = 'manual_stop'): Promise<ChaseUpSchedule> {
    const schedule = await chaseUpRepository.getScheduleByTokenId(portalTokenId);
    if (!schedule) throw new NotFoundError('Chase-up schedule not found');

    const completed = await chaseUpRepository.completeSchedule(schedule.id, reason);
    await chaseUpRepository.updateTokenChaseUpStatus(portalTokenId, 'completed', 'none');

    return completed!;
  }

  async getChaseUpStatus(portalTokenId: number): Promise<any> {
    const schedule = await chaseUpRepository.getScheduleByTokenId(portalTokenId);
    if (!schedule) {
      return { hasSchedule: false };
    }

    const emails = await chaseUpRepository.getEmailsByTokenId(portalTokenId);
    const token = await portalRepository.getTokenById(portalTokenId);

    const today = new Date();
    const deadline = new Date(schedule.submissionDeadline);
    const daysRemaining = Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    const daysOverdue = daysRemaining < 0 ? Math.abs(daysRemaining) : 0;

    return {
      hasSchedule: true,
      scheduleId: schedule.id,
      timeframeDays: schedule.timeframeDays,
      submissionDeadline: schedule.submissionDeadline,
      isActive: schedule.isActive,
      isCompleted: schedule.isCompleted,
      completionReason: schedule.completionReason,
      daysRemaining: Math.max(0, daysRemaining),
      daysOverdue,
      chaseUpStatus: token?.chaseUpStatus || 'not_started',
      escalationLevel: token?.escalationLevel || 'none',
      emailsSent: emails.length,
      emails: emails.map(e => ({
        sequenceNumber: e.emailSequenceNumber,
        type: e.emailType,
        sentAt: e.sentAt,
        status: e.deliveryStatus,
      })),
    };
  }

  async processChaseUpSchedules(): Promise<{ processed: number; emailsSent: number }> {
    const overdueSchedules = await chaseUpRepository.getOverdueSchedules();
    let processed = 0;
    let emailsSent = 0;

    for (const schedule of overdueSchedules) {
      try {
        const result = await this.processSchedule(schedule);
        processed++;
        if (result.emailSent) emailsSent++;
      } catch (error) {
        console.error(`[CHASE-UP] Error processing schedule ${schedule.id}:`, error);
      }
    }

    return { processed, emailsSent };
  }

  private async processSchedule(schedule: ChaseUpSchedule): Promise<{ emailSent: boolean }> {
    // Rule B: terminate the schedule when every mandatory Stage 1 requirement
    // for this targetCompanyId is in a terminal status (submitted or approved).
    // Stage 1 only: chase-up is a Stage 1 collection tool. If Stage 2 chasing
    // is added later, chase_up_schedules will need a collectionStage column
    // and this call will need to read it. See action log #139.
    const allRequiredSubmitted = await portalRequirementsRepository.areAllMandatorySubmitted(
      schedule.targetCompanyId,
      1,
    );
    if (allRequiredSubmitted) {
      await chaseUpRepository.completeSchedule(schedule.id, 'all_required_submitted');
      await chaseUpRepository.clearTokenChaseStatus(schedule.portalTokenId, 'completed', 'none');
      return { emailSent: false };
    }

    // Rule D: time-based backstop. Terminate if today is past finalDeadlineDate.
    // Defence in depth: in normal operation Rule A fires first on day
    // manualDeadlineDelayDays. Rule D fires the day after (using > not >=) and
    // only catches cases where Rule A regressed or was bypassed. Skips when
    // finalDeadlineDate IS NULL: legacy schedules pre-Build 3 stay under Rule A
    // protection until extended, at which point extendTimeframe backfills the
    // column. See action log #139.
    const finalDeadlineDate = await chaseUpRepository.getTokenFinalDeadline(schedule.portalTokenId);
    if (finalDeadlineDate !== null) {
      const todayStr = new Date().toISOString().split('T')[0];
      if (todayStr > finalDeadlineDate) {
        await chaseUpRepository.completeSchedule(schedule.id, 'final_deadline_passed');
        await chaseUpRepository.clearTokenChaseStatus(schedule.portalTokenId, 'completed', 'none');
        return { emailSent: false };
      }
    }

    const today = new Date();
    const deadline = new Date(schedule.submissionDeadline);
    const daysOverdue = Math.floor((today.getTime() - deadline.getTime()) / (1000 * 60 * 60 * 24));

    const existingEmails = await chaseUpRepository.getEmailsByTokenId(schedule.portalTokenId);
    const sentSequences = new Set(existingEmails.map(e => e.emailSequenceNumber));

    let emailToSend: number | null = null;
    let requiresInternalAlert = false;

    if (daysOverdue >= (schedule.manualDeadlineDelayDays || 11)) {
      await chaseUpRepository.updateTokenChaseUpStatus(schedule.portalTokenId, 'manual_intervention', 'manual');
      await this.sendInternalAlert(schedule, 'manual_intervention');
      await chaseUpRepository.completeSchedule(schedule.id, 'manual_intervention');
      return { emailSent: false };
    }

    // Send the LOWEST unsent sequence whose threshold has been crossed,
    // not the highest. Catches up one step at a time across consecutive
    // cron runs after an outage, rather than jumping straight to Final
    // Notice as the first contact email.
    const sequenceConfig: Array<{ seq: number; threshold: number; alert: boolean }> = [
      { seq: 1, threshold: schedule.email1DelayDays ?? 0, alert: false },
      { seq: 2, threshold: schedule.email2DelayDays ?? 2, alert: false },
      { seq: 3, threshold: schedule.email3DelayDays ?? 5, alert: true },
      { seq: 4, threshold: schedule.email4DelayDays ?? 8, alert: true },
    ];

    for (const { seq, threshold, alert } of sequenceConfig) {
      if (daysOverdue >= threshold && !sentSequences.has(seq)) {
        emailToSend = seq;
        requiresInternalAlert = alert;
        break;
      }
    }

    if (emailToSend) {
      await this.sendChaseUpEmail(schedule, emailToSend, requiresInternalAlert);
      return { emailSent: true };
    }

    return { emailSent: false };
  }

  private async sendChaseUpEmail(schedule: ChaseUpSchedule, sequenceNumber: number, sendInternalAlert: boolean): Promise<void> {
    const details = await chaseUpRepository.getScheduleWithDetails(schedule.id);
    if (!details) return;

    const { token, company, contact } = details;
    const emailConfig = EMAIL_TYPES[sequenceNumber as keyof typeof EMAIL_TYPES];

    let emailRecord;
    try {
      emailRecord = await chaseUpRepository.createChaseUpEmail({
        portalTokenId: schedule.portalTokenId,
        targetCompanyId: schedule.targetCompanyId,
        emailSequenceNumber: sequenceNumber,
        emailType: emailConfig.type,
        emailSubject: `${emailConfig.subject} - ${company.companyName}`,
        sentToContacts: [contact.email || ''],
        deliveryStatus: 'pending',
        internalAlertSent: sendInternalAlert,
      });
    } catch (err: any) {
      // Unique-violation on (portal_token_id, email_sequence_number)
      // means a concurrent process already wrote this row and is
      // responsible for sending the email. Skip cleanly without
      // throwing or alerting. Matches the codebase catch pattern at
      // server/routes/public-waitlist.routes.ts:45.
      if (err?.code === '23505' && err?.constraint === 'chase_up_emails_token_seq_unique') {
        console.log(
          `[CHASE-UP] Seq ${sequenceNumber} for token ${schedule.portalTokenId} ` +
          `already written by concurrent process. Skipping send.`
        );
        return;
      }
      throw err;
    }

    try {
      if (contact.email) {
        const subject = `${emailConfig.subject} - ${company.companyName}`;
        const html = this.generateChaseUpEmailHtml(emailConfig.type, contact, company, schedule);
        
        await emailApiService.sendCustomEmail(contact.email, subject, html);
        
        await chaseUpRepository.updateEmail(emailRecord.id, {
          sentAt: new Date(),
          deliveryStatus: 'sent',
        });
      }

      await chaseUpRepository.updateTokenChaseUpStatus(schedule.portalTokenId, emailConfig.type, emailConfig.type);

      if (sendInternalAlert) {
        await this.sendInternalAlert(schedule, emailConfig.type);
      }
    } catch (error) {
      console.error(`[CHASE-UP] Failed to send ${emailConfig.type} email:`, error);
      await chaseUpRepository.updateEmail(emailRecord.id, {
        deliveryStatus: 'failed',
      });
    }
  }

  private async sendInternalAlert(schedule: ChaseUpSchedule, alertType: string): Promise<void> {
    try {
      const details = await chaseUpRepository.getScheduleWithDetails(schedule.id);
      if (!details) return;

      const { token, company, contact } = details;
      const teamEmails = await emailRepository.getTeamMemberEmails(token.userCompanyId);
      
      if (teamEmails.length === 0) return;

      const subject = alertType === 'manual_intervention'
        ? `[ACTION REQUIRED] Manual Intervention Needed - ${company.companyName}`
        : `[ALERT] Chase-up Escalation (${alertType}) - ${company.companyName}`;

      const html = this.generateInternalAlertHtml(alertType, company, contact, schedule);
      
      for (const teamMember of teamEmails) {
        await emailApiService.sendCustomEmail(teamMember.email, subject, html);
      }
    } catch (error) {
      console.error('[CHASE-UP] Failed to send internal alert:', error);
    }
  }

  private generateChaseUpEmailHtml(type: string, contact: any, company: any, schedule: ChaseUpSchedule): string {
    const contactName = `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || 'Contact';
    const deadlineDate = new Date(schedule.submissionDeadline).toLocaleDateString('en-GB', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });

    const templates: Record<string, { greeting: string; body: string; closing: string }> = {
      gentle: {
        greeting: `Dear ${contactName},`,
        body: `We hope this message finds you well. This is a friendly reminder regarding the document submission for ${company.companyName}. The agreed deadline was ${deadlineDate}, and we noticed that we haven't yet received all the required documents.`,
        closing: `If you have any questions or need assistance, please don't hesitate to reach out. We're here to help make this process as smooth as possible.`,
      },
      firm: {
        greeting: `Dear ${contactName},`,
        body: `We are following up regarding the outstanding document submission for ${company.companyName}. The deadline of ${deadlineDate} has now passed, and we require the documents to proceed with the next steps.`,
        closing: `Please prioritise this matter and submit the required documents at your earliest convenience. If there are any issues preventing submission, please contact us immediately.`,
      },
      urgent: {
        greeting: `Dear ${contactName},`,
        body: `This is an urgent reminder regarding the document submission for ${company.companyName}. The deadline of ${deadlineDate} has passed, and we still await the required documents. This delay is impacting our ability to proceed.`,
        closing: `Immediate action is required. Please submit the documents today or contact us urgently if there are any issues.`,
      },
      final: {
        greeting: `Dear ${contactName},`,
        body: `This is our final notice regarding the document submission for ${company.companyName}. Despite multiple reminders, we have not received the required documents. The original deadline was ${deadlineDate}.`,
        closing: `If we do not receive the documents within the next 3 business days, we may need to escalate this matter. Please treat this as a matter of priority.`,
      },
    };

    const template = templates[type] || templates.gentle;

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #2563eb; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9fafb; }
          .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>Document Submission Reminder</h2>
          </div>
          <div class="content">
            <p>${template.greeting}</p>
            <p>${template.body}</p>
            <p>${template.closing}</p>
            <p>Best regards,<br>The Team</p>
          </div>
          <div class="footer">
            <p>This is an automated message. Please do not reply directly to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private generateInternalAlertHtml(alertType: string, company: any, contact: any, schedule: ChaseUpSchedule): string {
    const contactName = `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || 'Unknown';
    const today = new Date();
    const deadline = new Date(schedule.submissionDeadline);
    const daysOverdue = Math.floor((today.getTime() - deadline.getTime()) / (1000 * 60 * 60 * 24));

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: ${alertType === 'manual_intervention' ? '#dc2626' : '#f59e0b'}; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9fafb; }
          .details { background-color: white; padding: 15px; border-radius: 8px; margin: 15px 0; }
          .details p { margin: 8px 0; }
          .label { font-weight: bold; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>${alertType === 'manual_intervention' ? 'Manual Intervention Required' : 'Chase-up Escalation Alert'}</h2>
          </div>
          <div class="content">
            <p>A document submission requires your attention:</p>
            <div class="details">
              <p><span class="label">Company:</span> ${company.companyName}</p>
              <p><span class="label">Contact:</span> ${contactName} (${contact.email || 'No email'})</p>
              <p><span class="label">Original Deadline:</span> ${new Date(schedule.submissionDeadline).toLocaleDateString()}</p>
              <p><span class="label">Days Overdue:</span> ${daysOverdue}</p>
              <p><span class="label">Escalation Level:</span> ${alertType.replace('_', ' ').toUpperCase()}</p>
            </div>
            ${alertType === 'manual_intervention' 
              ? '<p><strong>Action Required:</strong> Please review this case and take appropriate action. The automated chase-up sequence has been exhausted.</p>'
              : '<p>This is to keep you informed of the current escalation status. No immediate action may be required.</p>'
            }
          </div>
        </div>
      </body>
      </html>
    `;
  }

  async getChaseUpDashboard(userCompanyId: number): Promise<any[]> {
    return await chaseUpRepository.getChaseUpDashboard(userCompanyId);
  }

  async getHighPriorityAlerts(userCompanyId: number): Promise<any[]> {
    return await chaseUpRepository.getHighPriorityAlerts(userCompanyId);
  }
}

export const chaseUpService = new ChaseUpService();
