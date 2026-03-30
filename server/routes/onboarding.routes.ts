import { Router, Request, Response } from 'express';
import { eq, and, count, inArray } from 'drizzle-orm';
import { db } from '../db';
import { users, userCompanies } from '@shared/schema/core';
import { targetCompanies, targetContacts } from '@shared/schema/deals';
import { documents, expertAnalysisResults } from '@shared/schema/documents';
import { dealModels } from '@shared/schema/deal-models';
import { dealDocuments } from '@shared/schema/deal-documents';
import { portalAccessTokens } from '@shared/schema/portal';
import { sendSuccess } from '../utils/response';
import { asyncHandler } from '../utils/async-handler';
import { UnauthorizedError } from '../utils/errors';

const router = Router();

const TOTAL_STEPS = 7;

router.get('/progress', asyncHandler(async (req: Request, res: Response) => {
  const userId = req.session?.userId;
  const userCompanyId = req.session?.userCompanyId;

  if (!userId || !userCompanyId) {
    throw new UnauthorizedError();
  }

  const [user] = await db
    .select({ onboardingCompleted: users.onboardingCompleted })
    .from(users)
    .where(eq(users.id, userId));

  if (user?.onboardingCompleted) {
    return sendSuccess(res, {
      steps: {
        createTarget: true,
        addContact: true,
        sendPortal: true,
        uploadDocuments: true,
        generateAnalysis: true,
        saveModel: true,
        generateDocument: true,
      },
      completedCount: TOTAL_STEPS,
      onboardingCompleted: true,
    });
  }

  const [targetResult] = await db
    .select({ count: count() })
    .from(targetCompanies)
    .where(eq(targetCompanies.userCompanyId, userCompanyId));
  const hasTarget = (targetResult?.count ?? 0) > 0;

  let hasContact = false;
  let hasPortal = false;
  let hasDocuments = false;
  let hasAnalysis = false;
  let hasModel = false;
  let hasDocument = false;

  if (hasTarget) {
    const [contactResult] = await db
      .select({ count: count() })
      .from(targetContacts)
      .innerJoin(targetCompanies, eq(targetContacts.targetCompanyId, targetCompanies.id))
      .where(and(
        eq(targetCompanies.userCompanyId, userCompanyId),
        eq(targetContacts.isPrimary, true)
      ));
    hasContact = (contactResult?.count ?? 0) > 0;

    const [portalResult] = await db
      .select({ count: count() })
      .from(portalAccessTokens)
      .where(eq(portalAccessTokens.userCompanyId, userCompanyId));
    hasPortal = (portalResult?.count ?? 0) > 0;

    const [docResult] = await db
      .select({ count: count() })
      .from(documents)
      .innerJoin(targetCompanies, eq(documents.targetCompanyId, targetCompanies.id))
      .where(eq(targetCompanies.userCompanyId, userCompanyId));
    hasDocuments = (docResult?.count ?? 0) > 0;

    const [analysisResult] = await db
      .select({ count: count() })
      .from(expertAnalysisResults)
      .innerJoin(targetCompanies, eq(expertAnalysisResults.targetCompanyId, targetCompanies.id))
      .where(and(
        eq(targetCompanies.userCompanyId, userCompanyId),
        eq(expertAnalysisResults.status, 'success')
      ));
    hasAnalysis = (analysisResult?.count ?? 0) > 0;

    const [modelResult] = await db
      .select({ count: count() })
      .from(dealModels)
      .innerJoin(targetCompanies, eq(dealModels.targetCompanyId, targetCompanies.id))
      .where(eq(targetCompanies.userCompanyId, userCompanyId));
    hasModel = (modelResult?.count ?? 0) > 0;

    const [dealDocResult] = await db
      .select({ count: count() })
      .from(dealDocuments)
      .where(and(
        eq(dealDocuments.userCompanyId, userCompanyId),
        inArray(dealDocuments.documentType, ['heads_of_terms', 'offer_letter'])
      ));
    hasDocument = (dealDocResult?.count ?? 0) > 0;
  }

  const steps = {
    createTarget: hasTarget,
    addContact: hasContact,
    sendPortal: hasPortal,
    uploadDocuments: hasDocuments,
    generateAnalysis: hasAnalysis,
    saveModel: hasModel,
    generateDocument: hasDocument,
  };

  const completedCount = Object.values(steps).filter(Boolean).length;

  sendSuccess(res, {
    steps,
    completedCount,
    onboardingCompleted: false,
  });
}));

router.post('/checklist-complete', asyncHandler(async (req: Request, res: Response) => {
  const userId = req.session?.userId;
  if (!userId) {
    throw new UnauthorizedError();
  }

  await db
    .update(users)
    .set({
      onboardingCompleted: true,
      onboardingCompletedAt: new Date(),
    })
    .where(eq(users.id, userId));

  const userCompanyId = req.session?.userCompanyId;
  if (userCompanyId) {
    const { track } = await import('../services/funnel.service');
    track(userCompanyId, userId, 'onboarding.completed', {});
  }

  sendSuccess(res, { message: 'Onboarding marked as complete' });
}));

router.post('/complete', asyncHandler(async (req: Request, res: Response) => {
  const userId = req.session?.userId;
  const userCompanyId = req.session?.userCompanyId;

  if (!userId) {
    throw new UnauthorizedError();
  }

  const { companyName, industry, companySize, role, hearAboutUs } = req.body as {
    companyName?: string;
    industry?: string;
    companySize?: string;
    role?: string;
    hearAboutUs?: string;
  };

  if (!companyName || !companyName.trim()) {
    return res.status(400).json({ error: 'validation', message: 'Company name is required.' });
  }
  if (!industry || !industry.trim()) {
    return res.status(400).json({ error: 'validation', message: 'Industry is required.' });
  }

  if (userCompanyId) {
    await db
      .update(userCompanies)
      .set({
        companyName: companyName.trim(),
        industry: industry.trim(),
        companySize: companySize?.trim() || null,
      })
      .where(eq(userCompanies.id, userCompanyId));
  }

  await db
    .update(users)
    .set({
      jobTitle: role?.trim() || null,
      hearAboutUs: hearAboutUs?.trim() || null,
      onboardingCompleted: true,
      onboardingCompletedAt: new Date(),
    })
    .where(eq(users.id, userId));

  if (userCompanyId) {
    const { track } = await import('../services/funnel.service');
    track(userCompanyId, userId, 'onboarding.completed', { industry, companySize, hearAboutUs });
  }

  sendSuccess(res, { success: true });
}));

export default router;
