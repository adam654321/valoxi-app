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

router.post('/send-offer', async (req, res) => {
  try {
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
  } catch (error: any) {
    console.error('[DEAL_DOCS] Send offer error:', error);
    res.status(500).json({ message: error.message });
  }
});

router.get('/:id/html', async (req, res) => {
  try {
    const documentId = parseInt(req.params.id);
    if (isNaN(documentId)) {
      return res.status(400).json({ message: 'Invalid document ID' });
    }

    const doc = await dealDocumentService.getDocumentById(documentId);
    if (!doc) {
      return res.status(404).json({ message: 'Document not found' });
    }
    if (!doc.generatedFileUrl) {
      return res.status(404).json({ message: 'Document file not generated' });
    }

    const { dealDocumentTemplateService } = await import('../services/deal-document-template.service');
    const html = await dealDocumentTemplateService.convertToHtml(doc.generatedFileUrl);

    res.json({ html });
  } catch (error: any) {
    console.error('[DEAL_DOCS] HTML preview error:', error);
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

    let html: string;

    if (doc.documentType === 'offer_letter' && doc.documentData) {
      html = buildOfferLetterHtml(doc.documentData as any);
    } else {
      const { dealDocumentTemplateService } = await import('../services/deal-document-template.service');
      html = await dealDocumentTemplateService.convertToHtml(doc.generatedFileUrl);
    }

    res.json({ html, documentData: doc.documentData });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

function buildOfferLetterHtml(data: any): string {
  const raw = data._raw || {};

  const fmt = (val: any) => {
    const num = Number(val) || 0;
    return new Intl.NumberFormat('en-GB', {
      style: 'currency', currency: 'GBP',
      minimumFractionDigits: 0, maximumFractionDigits: 0,
    }).format(num);
  };

  const breakdownLines: string[] = [];
  breakdownLines.push(`Enterprise Value (Adjusted EBITDA × ${raw.ebitdaMultiple || 0} multiple): <strong>${fmt(raw.enterpriseValue)}</strong>`);
  if (raw.excessCash > 0) breakdownLines.push(`Plus Excess Cash: <strong>${fmt(raw.excessCash)}</strong>`);
  if (raw.propertyValue > 0) breakdownLines.push(`Plus Property Value: <strong>${fmt(raw.propertyValue)}</strong>`);
  if (raw.primaryDebt > 0) breakdownLines.push(`Less Primary Debt: <strong>(${fmt(raw.primaryDebt)})</strong>`);
  if (raw.otherDebt > 0) breakdownLines.push(`Less Other Debt: <strong>(${fmt(raw.otherDebt)})</strong>`);
  if (raw.corpTaxDue > 0) breakdownLines.push(`Less Corporation Tax Due: <strong>(${fmt(raw.corpTaxDue)})</strong>`);
  if (raw.workingCapitalAdj > 0) breakdownLines.push(`Less Working Capital Adjustment: <strong>(${fmt(raw.workingCapitalAdj)})</strong>`);

  let paymentHtml = '';
  if (raw.dayOnePayment > 0) {
    paymentHtml += `<p>Payment due to the seller at closing: <strong>${fmt(raw.dayOnePayment)}</strong></p>`;
  }
  if (raw.deferredAmount > 0) {
    paymentHtml += `<p>Deferred consideration: <strong>${fmt(raw.deferredAmount)}</strong></p>`;
    if (raw.deferredTerms) {
      paymentHtml += `<p>Deferred terms: ${raw.deferredTerms}</p>`;
    }
  }
  if (raw.earnoutMaximum > 0) {
    paymentHtml += `<p>Earnout (maximum): <strong>${fmt(raw.earnoutMaximum)}</strong></p>`;
    if (raw.earnoutMetric) {
      paymentHtml += `<p>Earnout details: ${raw.earnoutMetric}</p>`;
    }
    if (raw.earnoutTermMonths > 0) {
      paymentHtml += `<p>Earnout period: ${raw.earnoutTermMonths} months</p>`;
    }
  }

  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.6;">
      <p><strong>${data.sellerCompanyName || ''}</strong></p>
      <p>${data.sellerAddress || ''}</p>
      <p>${data.currentDate || ''}</p>
      <br/>
      <p><strong>Re: ${data.sellerCompanyName || ''}</strong></p>
      <br/>
      <p>Further to our conversations, I have the pleasure of enclosing an offer for 100% of the share capital of ${data.sellerCompanyName || ''}.</p>
      <br/>
      <h3 style="margin-bottom: 8px;">The total offer price is ${data.offerPrice || fmt(raw.offerPrice)}</h3>
      <br/>
      <p><strong>This is comprised as follows:</strong></p>
      <table style="border-collapse: collapse; width: 100%; max-width: 500px; margin: 12px 0;">
        ${breakdownLines.map(line => `<tr><td style="padding: 4px 0;">${line}</td></tr>`).join('\n')}
        <tr><td style="padding: 8px 0; border-top: 2px solid #333;"><strong>Total Offer Price: ${data.offerPrice || fmt(raw.offerPrice)}</strong></td></tr>
      </table>
      <br/>
      ${paymentHtml ? `<p><strong>Payment Structure:</strong></p>${paymentHtml}<br/>` : ''}
      <p>This offer is subject to due diligence and legal contract. I trust this offer meets with your approval and await your response. Following the acceptance of this offer, a heads of terms document will be submitted and negotiated to include agreements on working capital, exclusivity period and a timetable for due diligence and legal contract.</p>
      <br/>
      <p>Yours sincerely,</p>
      <br/>
      <p><strong>${data.buyerSignatoryName || ''}</strong></p>
      <p>${data.buyerSignatoryTitle || ''}</p>
      <p>${data.buyerCompanyName || ''}</p>
    </div>
  `;
}

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
