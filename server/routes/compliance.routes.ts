import { Router, Request, Response } from 'express';
import { sendSuccess } from '../utils/response';
import { asyncHandler } from '../utils/async-handler';
import { UnauthorizedError } from '../utils/errors';
import {
  TERMS_VERSION,
  DPA_VERSION,
  hasAcceptedCurrent,
  recordAcceptance,
  type AcceptanceDocumentType,
} from '../services/compliance.service';

const router = Router();

router.get('/status', asyncHandler(async (req: Request, res: Response) => {
  const userId = req.session?.userId;
  if (!userId) {
    throw new UnauthorizedError();
  }

  const [termsOk, dpaOk] = await Promise.all([
    hasAcceptedCurrent(userId, 'terms'),
    hasAcceptedCurrent(userId, 'dpa'),
  ]);

  const missing: { documentType: AcceptanceDocumentType; version: string }[] = [];
  if (!termsOk) missing.push({ documentType: 'terms', version: TERMS_VERSION });
  if (!dpaOk) missing.push({ documentType: 'dpa', version: DPA_VERSION });

  sendSuccess(res, {
    allAccepted: missing.length === 0,
    missing,
    currentVersions: {
      terms: TERMS_VERSION,
      dpa: DPA_VERSION,
    },
  });
}));

router.post('/accept', asyncHandler(async (req: Request, res: Response) => {
  const userId = req.session?.userId;
  if (!userId) {
    throw new UnauthorizedError();
  }

  const { acceptTerms, acceptDpa } = req.body as {
    acceptTerms?: boolean;
    acceptDpa?: boolean;
  };

  if (acceptTerms !== true && acceptDpa !== true) {
    return res.status(400).json({ error: 'validation', message: 'No acceptance flags provided.' });
  }

  const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || null;
  const userAgent = req.headers['user-agent'] || null;

  if (acceptTerms === true) {
    const already = await hasAcceptedCurrent(userId, 'terms');
    if (!already) {
      await recordAcceptance({ userId, documentType: 'terms', version: TERMS_VERSION, ipAddress, userAgent });
    }
  }

  if (acceptDpa === true) {
    const already = await hasAcceptedCurrent(userId, 'dpa');
    if (!already) {
      await recordAcceptance({ userId, documentType: 'dpa', version: DPA_VERSION, ipAddress, userAgent });
    }
  }

  sendSuccess(res, { success: true });
}));

export default router;
