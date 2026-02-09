import { Router } from 'express';
import { dealDocumentService } from '../services/deal-document.service';
import { z } from 'zod';

const router = Router();
const publicRouter = Router();

router.get('/company/:targetCompanyId', async (req, res) => {
  try {
    const targetCompanyId = parseInt(req.params.targetCompanyId);
    const docs = await dealDocumentService.getDocumentsForCompany(targetCompanyId);
    res.json(docs);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/company/:targetCompanyId/:documentType', async (req, res) => {
  try {
    const targetCompanyId = parseInt(req.params.targetCompanyId);
    const documentType = req.params.documentType;
    const history = await dealDocumentService.getVersionHistory(targetCompanyId, documentType);
    res.json(history);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/download/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const doc = await dealDocumentService.getDocumentById(id);
    if (!doc || !doc.generatedFileUrl) {
      return res.status(404).json({ message: 'Document file not found' });
    }

    const fs = await import('fs/promises');
    const path = await import('path');
    const buffer = await fs.readFile(doc.generatedFileUrl);
    const filename = path.basename(doc.generatedFileUrl);

    const isPdf = filename.endsWith('.pdf');
    res.setHeader('Content-Type', isPdf
      ? 'application/pdf'
      : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const doc = await dealDocumentService.getDocumentById(id);
    if (!doc) return res.status(404).json({ message: 'Document not found' });
    const responses = await dealDocumentService.getDocumentResponses(id);
    res.json({ ...doc, responses });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

const createDocumentSchema = z.object({
  targetCompanyId: z.number(),
  documentType: z.enum(['nda', 'offer_letter', 'heads_of_terms']),
  dealModelId: z.number().optional(),
  portalTokenId: z.number().optional(),
  templateId: z.number().optional(),
  sectionConfig: z.any().optional(),
  documentData: z.any().optional(),
});

router.post('/', async (req, res) => {
  try {
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
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ message: 'Validation error', errors: error.errors });
    }
    res.status(500).json({ message: error.message });
  }
});

router.post('/:id/generate', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const dataOverrides = req.body.dataOverrides || {};
    const result = await dealDocumentService.generateDocumentFile(id, dataOverrides);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/:id/send', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const doc = await dealDocumentService.sendDocument(id);
    res.json(doc);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

router.post('/:id/withdraw', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const doc = await dealDocumentService.withdrawDocument(id);
    res.json(doc);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

router.post('/:id/new-version', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const userId = req.session.userId;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const doc = await dealDocumentService.createNewVersion(id, userId, req.body);
    res.status(201).json(doc);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

publicRouter.get('/:token', async (req, res) => {
  try {
    const token = req.params.token;

    const { portalService } = await import('../services/portal.service');
    const portalData = await portalService.getTokenData(token);
    if (!portalData) {
      return res.status(404).json({ message: 'Invalid or expired portal link' });
    }

    const docs = await dealDocumentService.getDocumentsForPortal(portalData.tokenId);
    const ndaAccepted = await dealDocumentService.isNdaAccepted(portalData.tokenId);

    res.json({ documents: docs, ndaAccepted });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

const respondSchema = z.object({
  responseType: z.enum(['accepted', 'rejected', 'countered']),
  comments: z.string().nullable().optional(),
  respondentName: z.string().min(1, 'Name is required'),
  respondentEmail: z.string().email().nullable().optional(),
});

publicRouter.post('/:token/:documentId/respond', async (req, res) => {
  try {
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
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ message: 'Validation error', errors: error.errors });
    }
    res.status(400).json({ message: error.message });
  }
});

publicRouter.get('/:token/:documentId/html', async (req, res) => {
  try {
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
    if (!doc.generatedFileUrl) {
      return res.status(404).json({ message: 'Document file not generated' });
    }

    await dealDocumentService.markViewed(documentId);

    const { dealDocumentTemplateService } = await import('../services/deal-document-template.service');
    const html = await dealDocumentTemplateService.convertToHtml(doc.generatedFileUrl);

    res.json({ html, documentData: doc.documentData });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

publicRouter.get('/:token/:documentId/download', async (req, res) => {
  try {
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
    if (!doc.generatedFileUrl) {
      return res.status(404).json({ message: 'Document file not found' });
    }

    await dealDocumentService.markViewed(documentId);

    const fs = await import('fs/promises');
    const path = await import('path');
    const buffer = await fs.readFile(doc.generatedFileUrl);
    const filename = path.basename(doc.generatedFileUrl);

    const isPdf = filename.endsWith('.pdf');
    res.setHeader('Content-Type', isPdf
      ? 'application/pdf'
      : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

export { publicRouter as publicDealDocumentRoutes };
export default router;
