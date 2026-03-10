import { Router } from 'express';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import multer from 'multer';
import { Client } from '@replit/object-storage';
import { db } from '../db';
import { betaFeedback } from '@shared/schema/dashboard';
import { users } from '@shared/schema/core';
import { systemConfigService } from '../services/system-config.service';
import { emailService } from '../email';
import { config } from '../config';
import { escapeHtml } from '../utils/html';
import { asyncHandler } from '../utils/async-handler';
import { sendSuccess, sendError } from '../utils/response';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PNG, JPEG, WebP, and GIF images are allowed'));
    }
  },
});

function createStorageClient(): Client {
  const bucketId = process.env.BETA_FEEDBACK_BUCKET_ID;
  const client = new Client(bucketId ? { bucketId } : undefined);
  (client as any).state?.promise?.catch?.(() => {});
  return client;
}

const createFeedbackSchema = z.object({
  type: z.enum(['bug', 'comment', 'suggestion', 'other']),
  severity: z.enum(['low', 'medium', 'high', 'critical']).optional().nullable(),
  title: z.string().min(1).max(255),
  description: z.string().min(1),
  pageUrl: z.string().max(500).optional().nullable(),
  pageTitle: z.string().max(255).optional().nullable(),
});

router.post('/', upload.single('screenshot'), asyncHandler(async (req, res) => {
  const enabled = await systemConfigService.getConfig('beta_feedback_enabled');
  if (enabled === 'false') {
    return res.status(403).json({ success: false, message: 'Beta feedback is currently disabled' });
  }

  const body = createFeedbackSchema.parse(req.body);

  const [user] = await db.select().from(users).where(eq(users.id, req.session.userId!));
  if (!user) {
    return res.status(401).json({ success: false, message: 'User not found' });
  }

  let screenshotUrl: string | null = null;
  if (req.file) {
    try {
      const ext = req.file.originalname?.split('.').pop() || 'png';
      const key = `.private/beta-feedback/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      await createStorageClient().uploadFromBytes(key, req.file.buffer);
      screenshotUrl = key;
    } catch (storageErr) {
      console.warn('[beta-feedback] Screenshot upload skipped — storage not configured:',
        storageErr instanceof Error ? storageErr.message : storageErr);
    }
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
    screenshotUrl,
    status: 'open',
  }).returning();

  const severityText = body.severity
    ? `<p><strong>Severity:</strong> ${body.severity}</p>`
    : '';
  const pageText = body.pageUrl
    ? `<p><strong>Page:</strong> ${escapeHtml(body.pageTitle || body.pageUrl)}</p>`
    : '';
  const screenshotText = screenshotUrl
    ? `<p><strong>Screenshot:</strong> Attached (view in admin panel)</p>`
    : '';

  try {
    await emailService.sendEmail({
      to: 'adam@shiftopsconsulting.com',
      subject: `[Beta Feedback] ${body.type.toUpperCase()}: ${escapeHtml(body.title)}`,
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
                  <p><strong>Title:</strong> ${escapeHtml(body.title)}</p>
                  <p><strong>Reporter:</strong> ${escapeHtml(user.firstName)} ${escapeHtml(user.lastName)} (${escapeHtml(user.email)})</p>
                  ${pageText}
                  ${screenshotText}
                </div>
                <p><strong>Description:</strong></p>
                <p>${escapeHtml(body.description).replace(/\n/g, '<br>')}</p>
              </div>
              <div class="footer">
                <p>Feedback ID: #${inserted.id}</p>
              </div>
            </div>
          </body>
        </html>
      `,
    });
  } catch (emailErr) {
    console.error('Failed to send feedback email:', emailErr);
  }

  sendSuccess(res, inserted, 201);
}));

router.get('/screenshot/:key(*)', asyncHandler(async (req, res) => {
  const key = req.params.key;
  if (!key.startsWith('.private/beta-feedback/')) {
    return res.status(403).json({ success: false, message: 'Invalid path' });
  }

  try {
    const { data } = await getStorageClient().downloadAsBytes(key);
    const ext = key.split('.').pop()?.toLowerCase() || 'png';
    const mimeMap: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' };
    res.setHeader('Content-Type', mimeMap[ext] || 'image/png');
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.send(Buffer.from(data));
  } catch {
    res.status(404).json({ success: false, message: 'Screenshot not found' });
  }
}));

export default router;
