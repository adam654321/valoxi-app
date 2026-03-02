import { Router, Request, Response } from 'express';
import { eq, and, count } from 'drizzle-orm';
import { db } from '../db';
import { users } from '@shared/schema/core';
import { targetCompanies } from '@shared/schema/deals';
import { documents, expertAnalysisResults } from '@shared/schema/documents';
import { dealModels } from '@shared/schema/deal-models';
import { dealDocuments } from '@shared/schema/deal-documents';
import { sendSuccess } from '../utils/response';
import { asyncHandler } from '../utils/async-handler';
import { UnauthorizedError } from '../utils/errors';

const router = Router();

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
        uploadDocuments: true,
        generateAnalysis: true,
        saveModel: true,
        generateDocument: true,
      },
      completedCount: 5,
      onboardingCompleted: true,
    });
  }

  const [targetResult] = await db
    .select({ count: count() })
    .from(targetCompanies)
    .where(eq(targetCompanies.userCompanyId, userCompanyId));
  const hasTarget = (targetResult?.count ?? 0) > 0;

  let hasDocuments = false;
  let hasAnalysis = false;
  let hasModel = false;
  let hasDocument = false;

  if (hasTarget) {
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
        eq(expertAnalysisResults.status, 'completed')
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
      .where(eq(dealDocuments.userCompanyId, userCompanyId));
    hasDocument = (dealDocResult?.count ?? 0) > 0;
  }

  const steps = {
    createTarget: hasTarget,
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

router.post('/complete', asyncHandler(async (req: Request, res: Response) => {
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

export default router;
