import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { issueReports } from '@shared/schema/dashboard';
import { asyncHandler } from '../utils/async-handler';

const router = Router();

const createIssueReportSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  severity: z.enum(['low', 'medium', 'high']).default('medium'),
  pageUrl: z.string().max(500).optional(),
});

router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const validated = createIssueReportSchema.parse(req.body);

  const [report] = await db
    .insert(issueReports)
    .values({
      userId: req.session.userId ?? null,
      userCompanyId: req.session.userCompanyId ?? null,
      pageUrl: validated.pageUrl ?? null,
      userAgent: (req.headers['user-agent'] ?? '').slice(0, 500) || null,
      title: validated.title,
      description: validated.description ?? null,
      severity: validated.severity,
      status: 'open',
    })
    .returning({ id: issueReports.id, createdAt: issueReports.createdAt });

  return res.status(201).json({ success: true, data: report });
}));

export default router;
