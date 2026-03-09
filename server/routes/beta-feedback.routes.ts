import { Router } from 'express';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { betaFeedback } from '@shared/schema/dashboard';
import { users } from '@shared/schema/core';
import { systemConfigService } from '../services/system-config.service';
import { emailService } from '../email';
import { asyncHandler } from '../utils/async-handler';
import { sendSuccess, sendError } from '../utils/response';

const router = Router();

const createFeedbackSchema = z.object({
  type: z.enum(['bug', 'comment', 'suggestion', 'other']),
  severity: z.enum(['low', 'medium', 'high', 'critical']).optional().nullable(),
  title: z.string().min(1).max(255),
  description: z.string().min(1),
  pageUrl: z.string().max(500).optional().nullable(),
  pageTitle: z.string().max(255).optional().nullable(),
});

router.post('/', asyncHandler(async (req, res) => {
  const enabled = await systemConfigService.getConfig('beta_feedback_enabled');
  if (enabled === 'false') {
    return res.status(403).json({ success: false, message: 'Beta feedback is currently disabled' });
  }

  const body = createFeedbackSchema.parse(req.body);

  const [user] = await db.select().from(users).where(eq(users.id, req.session.userId!));
  if (!user) {
    return res.status(401).json({ success: false, message: 'User not found' });
  }

  const [inserted] = await db.insert(betaFeedback).values({
    userId: user.id,
    userCompanyId: user.userCompanyId || user.currentCompanyId,
    reporterEmail: user.email,
    reporterName: `${user.firstName} ${user.lastName}`,
    type: body.type,
    severity: body.severity || null,
    title: body.title,
    description: body.description,
    pageUrl: body.pageUrl || null,
    pageTitle: body.pageTitle || null,
    userAgent: req.headers['user-agent']?.substring(0, 500) || null,
    status: 'open',
  }).returning();

  const severityText = body.severity ? `<p><strong>Severity:</strong> ${body.severity}</p>` : '';
  const pageText = body.pageUrl ? `<p><strong>Page:</strong> ${body.pageTitle || body.pageUrl}</p>` : '';

  await emailService.sendEmail({
    to: 'hello@valoxi.ai',
    subject: `[Beta Feedback] ${body.type.toUpperCase()}: ${body.title}`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            .container { max-width: 600px; margin: 0 auto; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
            .header { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 25px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #ffffff; padding: 25px; border: 1px solid #e1e5e9; }
            .details { background: #f8f9fa; padding: 20px; border-radius: 6px; margin: 15px 0; }
            .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 14px; color: #6c757d; border-radius: 0 0 8px 8px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Beta Feedback Received</h1>
            </div>
            <div class="content">
              <div class="details">
                <p><strong>Type:</strong> ${body.type}</p>
                ${severityText}
                <p><strong>Title:</strong> ${body.title}</p>
                <p><strong>Reporter:</strong> ${user.firstName} ${user.lastName} (${user.email})</p>
                ${pageText}
              </div>
              <p><strong>Description:</strong></p>
              <p>${body.description.replace(/\n/g, '<br>')}</p>
            </div>
            <div class="footer">
              <p>Feedback ID: #${inserted.id}</p>
            </div>
          </div>
        </body>
      </html>
    `,
  });

  sendSuccess(res, inserted, 201);
}));

export default router;
