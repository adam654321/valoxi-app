import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { geminiClient } from '../services/gemini-client';
import { asyncHandler } from '../utils/async-handler';
import { sendSuccess } from '../utils/response';
import { BadRequestError } from '../utils/errors';
import { explainLimiter } from '../middleware/rate-limit';

const router = Router();

const explainRequestSchema = z.object({
  metricKey: z.string().min(1).max(100),
  metricValue: z.union([z.string(), z.number()]),
  context: z.object({
    companyName: z.string().min(1),
    sector: z.string().min(1),
    revenue: z.number().optional(),
    adjustedEbitda: z.number().optional(),
  }),
});

const SYSTEM_INSTRUCTION = `You are a financial education assistant helping a business acquirer understand a metric in their deal analysis.
Explain the metric in plain English, in the context of the specific company provided.
Do not give investment advice or recommendations.
Do not say whether the deal is good or bad.
Keep your explanation to 2–4 sentences.
End with one sentence explaining what a typical range looks like for a UK SME in this sector.`;

router.post('/metric', explainLimiter, asyncHandler(async (req: Request, res: Response) => {
  const parsed = explainRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new BadRequestError('Invalid request: ' + parsed.error.errors.map(e => e.message).join(', '));
  }

  const { metricKey, metricValue, context } = parsed.data;

  const contextParts = [`Company: ${context.companyName}`, `Sector: ${context.sector}`];
  if (context.revenue) contextParts.push(`Annual Revenue: £${context.revenue.toLocaleString()}`);
  if (context.adjustedEbitda) contextParts.push(`Adjusted EBITDA: £${context.adjustedEbitda.toLocaleString()}`);

  const prompt = `${SYSTEM_INSTRUCTION}

Context:
${contextParts.join('\n')}

The user is looking at the metric "${metricKey}" which currently shows a value of "${metricValue}".

Explain what this metric means and why it matters for someone evaluating this acquisition.`;

  const response = await geminiClient.generateContent({
    prompt,
    temperature: 0.3,
    service: 'explain_metric',
    userId: req.session?.userId,
    userCompanyId: req.session?.userCompanyId,
  });

  sendSuccess(res, { explanation: response.text.trim() });
}));

export default router;
