import { Router, Request, Response } from 'express';
import { dealDocumentService } from '../services/deal-document.service';
import { z } from 'zod';
import { asyncHandler } from '../utils/async-handler';
import { db } from '../db';
import { eq, and, isNotNull, desc } from 'drizzle-orm';
import { dealDocuments } from '@shared/schema/deal-documents';
import { targetCompanies } from '@shared/schema/deals';
import { sendSuccess } from '../utils/response';
import { UnauthorizedError } from '../utils/errors';
import { buildNdaHtml, buildOfferLetterHtml, buildHoTHtml, buildSignatureBlock } from '../utils/document-html-builders';
import { fileStorageService } from '../services/file-storage.service';
import { generatePdfFromHtml } from '../utils/pdf-generator';

const router = Router();
const publicRouter = Router();

router.get('/company/:targetCompanyId', asyncHandler(async (req, res) => {
  const userCompanyId = req.session.userCompanyId;
  if (!userCompanyId) return res.status(401).json({ message: 'Unauthorized' });
  const targetCompanyId = parseInt(req.params.targetCompanyId);
  if (isNaN(targetCompanyId)) return res.status(400).json({ message: 'Invalid company ID' });
  const docs = await dealDocumentService.getDocumentsForCompany(targetCompanyId, userCompanyId);
  res.json(docs);
}));

router.get('/company/:targetCompanyId/:documentType', asyncHandler(async (req, res) => {
  const userCompanyId = req.session.userCompanyId;
  if (!userCompanyId) return res.status(401).json({ message: 'Unauthorized' });
  const targetCompanyId = parseInt(req.params.targetCompanyId);
  if (isNaN(targetCompanyId)) return res.status(400).json({ message: 'Invalid company ID' });
  const documentType = req.params.documentType;
  const history = await dealDocumentService.getVersionHistory(targetCompanyId, documentType, userCompanyId);
  res.json(history);
}));

router.get('/download/:id', asyncHandler(async (req, res) => {
  const userCompanyId = req.session.userCompanyId;
  if (!userCompanyId) return res.status(401).json({ message: 'Unauthorized' });
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ message: 'Invalid document ID' });
  const doc = await dealDocumentService.getDocumentById(id);
  if (!doc || doc.userCompanyId !== userCompanyId) {
    return res.status(404).json({ message: 'Document not found' });
  }
  if (!doc.documentData) {
    return res.status(404).json({ message: 'Document data not available' });
  }

  let html: string;
  if (doc.documentType === 'nda') {
    html = buildNdaHtml(doc.documentData as any);
  } else if (doc.documentType === 'offer_letter') {
    html = buildOfferLetterHtml(doc.documentData as any);
  } else if (doc.documentType === 'heads_of_terms') {
    html = buildHoTHtml(doc.documentData as any);
  } else {
    return res.status(400).json({ message: 'Unsupported document type' });
  }

  const responses = await dealDocumentService.getDocumentResponses(doc.id);
  html += buildSignatureBlock(doc.documentType, doc.documentData as any, responses, doc.respondedAt);

  const pdfBuffer = await generatePdfFromHtml(html);

  const docTypeNames: Record<string, string> = {
    nda: 'NDA',
    offer_letter: 'Offer_Letter',
    heads_of_terms: 'Heads_of_Terms',
  };
  const sellerName = ((doc.documentData as any)?.sellerCompanyName || 'Document').replace(/\s+/g, '_');
  const filename = `${docTypeNames[doc.documentType] || 'Document'}_${sellerName}.pdf`;

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(pdfBuffer);
}));

router.post('/generate-hot', asyncHandler(async (req, res) => {
  const userId = req.session.userId;
  const userCompanyId = req.session.userCompanyId;
  if (!userId || !userCompanyId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const schema = z.object({
    targetCompanyId: z.number(),
    hotTerms: z.object({
      exclusivityPeriodDays: z.number().optional().default(90),
      nonCompetePeriodYears: z.number().optional().default(2),
      nonSolicitPeriodYears: z.number().optional().default(2),
      warrantyClaimPeriodMonths: z.number().optional().default(18),
      warrantyMinClaim: z.number().optional().default(5000),
      additionalConditions: z.string().optional(),
      targetCompletionWeeks: z.number().optional().default(12),
    }).optional().default({}),
  });

  const validated = schema.parse(req.body);

  const doc = await dealDocumentService.createHoTFromAcceptedOffer({
    targetCompanyId: validated.targetCompanyId,
    userCompanyId,
    createdBy: userId,
    hotTerms: validated.hotTerms,
  });

  res.status(201).json(doc);
}));

router.post('/send-offer', asyncHandler(async (req, res) => {
  const userId = req.session.userId;
  const userCompanyId = req.session.userCompanyId;
  if (!userId || !userCompanyId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const { targetCompanyId, dealModelId, portalTokenId } = req.body;

  if (!targetCompanyId || !dealModelId) {
    return res.status(400).json({ message: 'targetCompanyId and dealModelId are required' });
  }

  let resolvedPortalTokenId = portalTokenId;
  if (!resolvedPortalTokenId) {
    const { portalRepository } = await import('../repositories/portal.repository');
    const activeToken = await portalRepository.getActiveTokenForCompany(targetCompanyId);
    if (!activeToken) {
      return res.status(400).json({
        message: 'No active portal found for this company. Please create a portal first.'
      });
    }
    resolvedPortalTokenId = activeToken.id;
  }

  const doc = await dealDocumentService.createOfferFromDealModel({
    targetCompanyId,
    userCompanyId,
    dealModelId,
    portalTokenId: resolvedPortalTokenId,
    createdBy: userId,
  });

  const sent = await dealDocumentService.sendDocument(doc.id);

  res.status(201).json(sent);
}));

router.get('/pending-send', asyncHandler(async (req: Request, res: Response) => {
  const userCompanyId = req.session?.userCompanyId;
  if (!userCompanyId) throw new UnauthorizedError();

  const pending = await db
    .select({
      id: dealDocuments.id,
      documentType: dealDocuments.documentType,
      createdAt: dealDocuments.createdAt,
      targetCompanyId: dealDocuments.targetCompanyId,
      companyName: targetCompanies.companyName,
    })
    .from(dealDocuments)
    .innerJoin(targetCompanies, eq(dealDocuments.targetCompanyId, targetCompanies.id))
    .where(and(
      eq(dealDocuments.userCompanyId, userCompanyId),
      eq(dealDocuments.status, 'draft'),
      isNotNull(dealDocuments.generatedFileUrl),
    ))
    .orderBy(desc(dealDocuments.createdAt));

  sendSuccess(res, pending);
}));

router.get('/:id/html', asyncHandler(async (req, res) => {
  const documentId = parseInt(req.params.id);
  if (isNaN(documentId)) {
    return res.status(400).json({ message: 'Invalid document ID' });
  }

  const userCompanyId = req.session.userCompanyId;
  if (!userCompanyId) return res.status(401).json({ message: 'Unauthorized' });
  const doc = await dealDocumentService.getDocumentById(documentId);
  if (!doc || doc.userCompanyId !== userCompanyId) {
    return res.status(404).json({ message: 'Document not found' });
  }
  let html: string;

  if (doc.documentType === 'nda' && doc.documentData) {
    html = buildNdaHtml(doc.documentData as any);
  } else if (doc.documentType === 'offer_letter' && doc.documentData) {
    html = buildOfferLetterHtml(doc.documentData as any);
  } else if (doc.documentType === 'heads_of_terms' && doc.documentData) {
    html = buildHoTHtml(doc.documentData as any);
  } else {
    if (!doc.generatedFileUrl) {
      return res.status(404).json({ message: 'Document file not generated' });
    }
    const { dealDocumentTemplateService } = await import('../services/deal-document-template.service');
    html = await dealDocumentTemplateService.convertToHtml(doc.generatedFileUrl);
  }

  if (['nda', 'offer_letter', 'heads_of_terms'].includes(doc.documentType)) {
    const responses = await dealDocumentService.getDocumentResponses(documentId);
    const docData = doc.documentData as any;
    html += buildSignatureBlock(doc.documentType, docData, responses, doc.respondedAt);
  }

  res.json({ html, documentData: doc.documentData });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const userCompanyId = req.session.userCompanyId;
  if (!userCompanyId) return res.status(401).json({ message: 'Unauthorized' });
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ message: 'Invalid document ID' });
  const doc = await dealDocumentService.getDocumentById(id);
  if (!doc || doc.userCompanyId !== userCompanyId) return res.status(404).json({ message: 'Document not found' });
  const responses = await dealDocumentService.getDocumentResponses(id);
  res.json({ ...doc, responses });
}));

const createDocumentSchema = z.object({
  targetCompanyId: z.number(),
  documentType: z.enum(['nda', 'offer_letter', 'heads_of_terms']),
  dealModelId: z.number().optional(),
  portalTokenId: z.number().optional(),
  templateId: z.number().optional(),
  sectionConfig: z.any().optional(),
  documentData: z.any().optional(),
});

router.post('/', asyncHandler(async (req, res) => {
  const validated = createDocumentSchema.parse(req.body);
  const userId = req.session.userId;
  const userCompanyId = req.session.userCompanyId;
  if (!userId || !userCompanyId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const doc = await dealDocumentService.createDocument({
    ...validated,
    userCompanyId,
    createdBy: userId,
  });

  res.status(201).json(doc);
}));

router.post('/:id/generate', asyncHandler(async (req, res) => {
  const userCompanyId = req.session.userCompanyId;
  if (!userCompanyId) return res.status(401).json({ message: 'Unauthorized' });
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ message: 'Invalid document ID' });
  const existing = await dealDocumentService.getDocumentById(id);
  if (!existing || existing.userCompanyId !== userCompanyId) return res.status(404).json({ message: 'Document not found' });
  const dataOverrides = req.body.dataOverrides || {};
  const result = await dealDocumentService.generateDocumentFile(id, dataOverrides);
  res.json(result);
}));

router.post('/:id/send', asyncHandler(async (req, res) => {
  const userCompanyId = req.session.userCompanyId;
  if (!userCompanyId) return res.status(401).json({ message: 'Unauthorized' });
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ message: 'Invalid document ID' });
  const existing = await dealDocumentService.getDocumentById(id);
  if (!existing || existing.userCompanyId !== userCompanyId) return res.status(404).json({ message: 'Document not found' });
  const doc = await dealDocumentService.sendDocument(id);
  res.json(doc);
}));

router.post('/:id/withdraw', asyncHandler(async (req, res) => {
  const userCompanyId = req.session.userCompanyId;
  if (!userCompanyId) return res.status(401).json({ message: 'Unauthorized' });
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ message: 'Invalid document ID' });
  const existing = await dealDocumentService.getDocumentById(id);
  if (!existing || existing.userCompanyId !== userCompanyId) return res.status(404).json({ message: 'Document not found' });
  const doc = await dealDocumentService.withdrawDocument(id);
  res.json(doc);
}));

router.post('/:id/new-version', asyncHandler(async (req, res) => {
  const userId = req.session.userId;
  const userCompanyId = req.session.userCompanyId;
  if (!userId || !userCompanyId) return res.status(401).json({ message: 'Unauthorized' });
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ message: 'Invalid document ID' });
  const existing = await dealDocumentService.getDocumentById(id);
  if (!existing || existing.userCompanyId !== userCompanyId) return res.status(404).json({ message: 'Document not found' });
  const doc = await dealDocumentService.createNewVersion(id, userId, req.body);
  res.status(201).json(doc);
}));

publicRouter.get('/:token', asyncHandler(async (req, res) => {
  const token = req.params.token;

  const { portalService } = await import('../services/portal.service');
  const portalData = await portalService.getTokenData(token);
  if (!portalData) {
    return res.status(404).json({ message: 'Invalid or expired portal link' });
  }

  const docs = await dealDocumentService.getDocumentsForPortal(portalData.tokenId);
  const ndaAccepted = await dealDocumentService.isNdaAccepted(portalData.tokenId);

  const docsWithResponses = await Promise.all(
    docs.map(async (doc) => {
      const responses = await dealDocumentService.getDocumentResponses(doc.id);
      return { ...doc, responses };
    })
  );

  res.json({ documents: docsWithResponses, ndaAccepted });
}));

const respondSchema = z.object({
  responseType: z.enum(['accepted', 'rejected', 'countered']),
  comments: z.string().nullable().optional(),
  respondentName: z.string().min(1, 'Name is required'),
  respondentEmail: z.string().email().nullable().optional(),
});

publicRouter.post('/:token/:documentId/respond', asyncHandler(async (req, res) => {
  const token = req.params.token;
  const documentId = parseInt(req.params.documentId);

  const { portalService } = await import('../services/portal.service');
  const portalData = await portalService.getTokenData(token);
  if (!portalData) {
    return res.status(404).json({ message: 'Invalid or expired portal link' });
  }

  const doc = await dealDocumentService.getDocumentById(documentId);
  if (!doc || doc.portalTokenId !== portalData.tokenId) {
    return res.status(404).json({ message: 'Document not found' });
  }

  const validated = respondSchema.parse(req.body);

  const response = await dealDocumentService.recordResponse({
    documentId,
    responseType: validated.responseType,
    comments: validated.comments || undefined,
    respondentName: validated.respondentName,
    respondentEmail: validated.respondentEmail || undefined,
    respondentIp: req.ip || req.socket.remoteAddress,
    respondentUserAgent: req.headers['user-agent'],
  });

  await dealDocumentService.markViewed(documentId);

  res.json(response);
}));

publicRouter.get('/:token/:documentId/html', asyncHandler(async (req, res) => {
  const token = req.params.token;
  const documentId = parseInt(req.params.documentId);

  const { portalService } = await import('../services/portal.service');
  const portalData = await portalService.getTokenData(token);
  if (!portalData) {
    return res.status(404).json({ message: 'Invalid or expired portal link' });
  }

  const doc = await dealDocumentService.getDocumentById(documentId);
  if (!doc || doc.portalTokenId !== portalData.tokenId) {
    return res.status(404).json({ message: 'Document not found' });
  }
  await dealDocumentService.markViewed(documentId);

  let html: string;

  if (doc.documentType === 'nda' && doc.documentData) {
    html = buildNdaHtml(doc.documentData as any);
  } else if (doc.documentType === 'offer_letter' && doc.documentData) {
    html = buildOfferLetterHtml(doc.documentData as any);
  } else if (doc.documentType === 'heads_of_terms' && doc.documentData) {
    html = buildHoTHtml(doc.documentData as any);
  } else {
    if (!doc.generatedFileUrl) {
      return res.status(404).json({ message: 'Document file not generated' });
    }
    const { dealDocumentTemplateService } = await import('../services/deal-document-template.service');
    html = await dealDocumentTemplateService.convertToHtml(doc.generatedFileUrl);
  }

  if (['nda', 'offer_letter', 'heads_of_terms'].includes(doc.documentType)) {
    const responses = await dealDocumentService.getDocumentResponses(documentId);
    const docData = doc.documentData as any;
    html += buildSignatureBlock(doc.documentType, docData, responses, doc.respondedAt);
  }

  res.json({ html, documentData: doc.documentData });
}));


publicRouter.get('/:token/:documentId/download', asyncHandler(async (req, res) => {
  const token = req.params.token;
  const documentId = parseInt(req.params.documentId);

  const { portalService } = await import('../services/portal.service');
  const portalData = await portalService.getTokenData(token);
  if (!portalData) {
    return res.status(404).json({ message: 'Invalid or expired portal link' });
  }

  const doc = await dealDocumentService.getDocumentById(documentId);
  if (!doc || doc.portalTokenId !== portalData.tokenId) {
    return res.status(404).json({ message: 'Document not found' });
  }
  if (!doc.documentData) {
    return res.status(404).json({ message: 'Document data not available' });
  }

  await dealDocumentService.markViewed(documentId);

  let html: string;
  if (doc.documentType === 'nda') {
    html = buildNdaHtml(doc.documentData as any);
  } else if (doc.documentType === 'offer_letter') {
    html = buildOfferLetterHtml(doc.documentData as any);
  } else if (doc.documentType === 'heads_of_terms') {
    html = buildHoTHtml(doc.documentData as any);
  } else {
    return res.status(400).json({ message: 'Unsupported document type' });
  }

  const responses = await dealDocumentService.getDocumentResponses(doc.id);
  html += buildSignatureBlock(doc.documentType, doc.documentData as any, responses, doc.respondedAt);

  const pdfBuffer = await generatePdfFromHtml(html);

  const docTypeNames: Record<string, string> = {
    nda: 'NDA',
    offer_letter: 'Offer_Letter',
    heads_of_terms: 'Heads_of_Terms',
  };
  const sellerName = ((doc.documentData as any)?.sellerCompanyName || 'Document').replace(/\s+/g, '_');
  const filename = `${docTypeNames[doc.documentType] || 'Document'}_${sellerName}.pdf`;

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(pdfBuffer);
}));

export { publicRouter as publicDealDocumentRoutes };
export default router;
