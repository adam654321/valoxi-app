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

router.post('/generate-hot', async (req, res) => {
  try {
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
  } catch (error: any) {
    console.error('[DEAL_DOCS] Generate HoT error:', error);
    res.status(error.message?.includes('Cannot generate') ? 400 : 500).json({ message: error.message });
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

    let html: string;

    if (doc.documentType === 'offer_letter' && doc.documentData) {
      html = buildOfferLetterHtml(doc.documentData as any);
    } else if (doc.documentType === 'heads_of_terms' && doc.documentData) {
      html = buildHoTHtml(doc.documentData as any);
    } else {
      const { dealDocumentTemplateService } = await import('../services/deal-document-template.service');
      html = await dealDocumentTemplateService.convertToHtml(doc.generatedFileUrl);
    }

    res.json({ html, documentData: doc.documentData });
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

    const docsWithResponses = await Promise.all(
      docs.map(async (doc) => {
        const responses = await dealDocumentService.getDocumentResponses(doc.id);
        return { ...doc, responses };
      })
    );

    res.json({ documents: docsWithResponses, ndaAccepted });
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
    } else if (doc.documentType === 'heads_of_terms' && doc.documentData) {
      html = buildHoTHtml(doc.documentData as any);
    } else {
      const { dealDocumentTemplateService } = await import('../services/deal-document-template.service');
      html = await dealDocumentTemplateService.convertToHtml(doc.generatedFileUrl);
    }

    if (['nda', 'offer_letter', 'heads_of_terms'].includes(doc.documentType)) {
      const responses = await dealDocumentService.getDocumentResponses(documentId);
      const docData = doc.documentData as any;
      html += buildSignatureBlock(doc.documentType, docData, responses, doc.respondedAt);
    }

    res.json({ html, documentData: doc.documentData });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

function buildSignatureBlock(documentType: string, docData: any, responses: any[], respondedAt: Date | null): string {
  const sellerResponse = responses.length > 0 ? responses[0] : null;
  const isSigned = !!sellerResponse || !!respondedAt;
  const signedDate = sellerResponse
    ? new Date(sellerResponse.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : respondedAt
      ? new Date(respondedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
      : '';

  const buyerName = docData?.buyerSignatoryName || '';
  const buyerTitle = docData?.buyerSignatoryTitle || '';
  const buyerCompany = docData?.buyerCompanyName || '';
  const sellerName = sellerResponse?.respondentName || '';
  const sellerCompany = docData?.sellerCompanyName || '';

  const docTitleMap: Record<string, string> = {
    'nda': 'Non-Disclosure Agreement',
    'offer_letter': 'Offer Letter',
    'heads_of_terms': 'Heads of Terms',
  };
  const docTitle = docTitleMap[documentType] || 'Agreement';

  const buyerLabelMap: Record<string, string> = {
    'nda': 'Disclosing Party (Buyer)',
    'offer_letter': 'Buyer',
    'heads_of_terms': 'Buyer',
  };
  const sellerLabelMap: Record<string, string> = {
    'nda': 'Receiving Party (Seller)',
    'offer_letter': 'Seller',
    'heads_of_terms': 'Seller',
  };

  return `
    <div style="margin-top: 40px; padding-top: 30px; border-top: 2px solid #333;">
      <h2 style="text-align: center; font-size: 16px; font-weight: 700; margin-bottom: 30px; text-transform: uppercase; letter-spacing: 1px;">Execution</h2>
      <p style="margin-bottom: 24px; font-size: 13px;">IN WITNESS WHEREOF, the parties hereto have executed this ${docTitle} as of the date last signed below.</p>
      <div style="display: flex; justify-content: space-between; gap: 40px;">
        <div style="flex: 1; border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px; background: #fafafa;">
          <p style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #666; margin-bottom: 12px; font-weight: 600;">${buyerLabelMap[documentType] || 'Buyer'}</p>
          <div style="border-bottom: 1px solid #333; padding-bottom: 4px; margin-bottom: 8px; min-height: 28px;">
            <span style="font-family: 'Brush Script MT', 'Segoe Script', cursive; font-size: 22px; color: #1a3a5c;">${buyerName}</span>
          </div>
          <p style="font-size: 13px; margin: 4px 0;"><strong>Name:</strong> ${buyerName}</p>
          <p style="font-size: 13px; margin: 4px 0;"><strong>Title:</strong> ${buyerTitle}</p>
          <p style="font-size: 13px; margin: 4px 0;"><strong>Company:</strong> ${buyerCompany}</p>
          <p style="font-size: 13px; margin: 4px 0;"><strong>Date:</strong> ${docData?.currentDate || ''}</p>
        </div>
        <div style="flex: 1; border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px; background: #fafafa;">
          <p style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #666; margin-bottom: 12px; font-weight: 600;">${sellerLabelMap[documentType] || 'Seller'}</p>
          ${sellerName ? `
            <div style="border-bottom: 1px solid #333; padding-bottom: 4px; margin-bottom: 8px; min-height: 28px;">
              <span style="font-family: 'Brush Script MT', 'Segoe Script', cursive; font-size: 22px; color: #1a3a5c;">${sellerName}</span>
            </div>
            <p style="font-size: 13px; margin: 4px 0;"><strong>Name:</strong> ${sellerName}</p>
          ` : `
            <div style="border-bottom: 1px solid #ccc; padding-bottom: 4px; margin-bottom: 8px; min-height: 28px;"></div>
            <p style="font-size: 13px; margin: 4px 0;"><strong>Name:</strong> _______________</p>
          `}
          <p style="font-size: 13px; margin: 4px 0;"><strong>Company:</strong> ${sellerCompany}</p>
          <p style="font-size: 13px; margin: 4px 0;"><strong>Date:</strong> ${isSigned ? signedDate : '_______________'}</p>
        </div>
      </div>
      ${isSigned ? `
        <div style="margin-top: 20px; padding: 12px 16px; background: #f0f7f0; border: 1px solid #c3e6c3; border-radius: 6px; text-align: center;">
          <p style="font-size: 12px; color: #2d6a2d; margin: 0;">
            ✓ This document was electronically signed and executed on <strong>${signedDate}</strong>
          </p>
        </div>
      ` : ''}
    </div>
  `;
}

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
    </div>
  `;
}

function buildHoTHtml(data: any): string {
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
    paymentHtml += `<p>Completion payment: <strong>${fmt(raw.dayOnePayment)}</strong></p>`;
  }
  if (raw.deferredAmount > 0) {
    paymentHtml += `<p>Deferred consideration: <strong>${fmt(raw.deferredAmount)}</strong></p>`;
    if (raw.deferredTerms) paymentHtml += `<p style="color: #555; font-size: 0.95em;">Terms: ${raw.deferredTerms}</p>`;
  }
  if (raw.earnoutMaximum > 0) {
    paymentHtml += `<p>Earnout (maximum): <strong>${fmt(raw.earnoutMaximum)}</strong></p>`;
    if (raw.earnoutMetric) paymentHtml += `<p style="color: #555; font-size: 0.95em;">Metric: ${raw.earnoutMetric}</p>`;
    if (raw.earnoutTermMonths > 0) paymentHtml += `<p style="color: #555; font-size: 0.95em;">Period: ${raw.earnoutTermMonths} months</p>`;
  }

  const keyTermsRows = [
    ['Exclusivity Period', `${raw.exclusivityPeriodDays || 90} days from the date of these Heads of Terms`],
    ['Non-Compete Restriction', `${raw.nonCompetePeriodYears || 2} years post-completion`],
    ['Non-Solicitation Restriction', `${raw.nonSolicitPeriodYears || 2} years post-completion`],
    ['Warranty Claim Period', `${raw.warrantyClaimPeriodMonths || 18} months post-completion`],
    ['Minimum Warranty Claim', fmt(raw.warrantyMinClaim || 5000)],
    ['Target Completion', `${raw.targetCompletionWeeks || 12} weeks from signing`],
  ];

  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.7; max-width: 700px; margin: 0 auto;">
      <div style="text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #333;">
        <h1 style="margin: 0; font-size: 24px;">Heads of Terms</h1>
        <p style="margin: 5px 0 0; color: #555;">Subject to Contract &amp; Without Prejudice</p>
      </div>

      <table style="width: 100%; margin-bottom: 20px;">
        <tr>
          <td style="width: 50%; vertical-align: top; padding: 10px;">
            <p style="margin: 0; font-size: 0.85em; color: #777; text-transform: uppercase;">Buyer</p>
            <p style="margin: 4px 0; font-weight: bold;">${data.buyerCompanyName || ''}</p>
          </td>
          <td style="width: 50%; vertical-align: top; padding: 10px;">
            <p style="margin: 0; font-size: 0.85em; color: #777; text-transform: uppercase;">Seller</p>
            <p style="margin: 4px 0; font-weight: bold;">${data.sellerCompanyName || ''}</p>
            <p style="margin: 2px 0; font-size: 0.9em;">${data.sellerAddress || ''}</p>
          </td>
        </tr>
      </table>

      <p style="color: #555;">Date: ${data.currentDate || ''}</p>

      <h2 style="margin-top: 30px; padding-bottom: 8px; border-bottom: 1px solid #ddd; font-size: 16px;">1. The Proposed Acquisition</h2>
      <p>The Buyer proposes to acquire 100% of the issued share capital of <strong>${data.sellerCompanyName || ''}</strong> ("the Company") on the terms set out below.</p>

      <h2 style="margin-top: 30px; padding-bottom: 8px; border-bottom: 1px solid #ddd; font-size: 16px;">2. Price</h2>
      <p>The total consideration for the Shares shall be <strong>${data.offerPrice || fmt(raw.offerPrice)}</strong> ("the Price"), subject to adjustment as described below.</p>
      
      <table style="border-collapse: collapse; width: 100%; max-width: 550px; margin: 16px 0;">
        ${breakdownLines.map(line => `<tr><td style="padding: 5px 0;">${line}</td></tr>`).join('\n')}
        <tr><td style="padding: 10px 0 5px; border-top: 2px solid #333;"><strong>Total Consideration: ${data.offerPrice || fmt(raw.offerPrice)}</strong></td></tr>
      </table>

      <h2 style="margin-top: 30px; padding-bottom: 8px; border-bottom: 1px solid #ddd; font-size: 16px;">3. Payment Structure</h2>
      ${paymentHtml || '<p>Full payment on completion.</p>'}

      <h2 style="margin-top: 30px; padding-bottom: 8px; border-bottom: 1px solid #ddd; font-size: 16px;">4. Key Terms</h2>
      <table style="border-collapse: collapse; width: 100%; margin: 12px 0;">
        ${keyTermsRows.map(([label, value]) => `
          <tr>
            <td style="padding: 8px 12px; border: 1px solid #ddd; font-weight: 600; width: 40%; background: #f9f9f9;">${label}</td>
            <td style="padding: 8px 12px; border: 1px solid #ddd;">${value}</td>
          </tr>
        `).join('\n')}
      </table>

      <h2 style="margin-top: 30px; padding-bottom: 8px; border-bottom: 1px solid #ddd; font-size: 16px;">5. Conditions</h2>
      <p>This acquisition is conditional upon:</p>
      <ul style="margin: 8px 0; padding-left: 24px;">
        <li>Satisfactory completion of due diligence by the Buyer</li>
        <li>Agreement and execution of a Share Purchase Agreement</li>
        <li>No material adverse change in the business prior to completion</li>
        <li>Receipt of all necessary regulatory approvals and third-party consents</li>
      </ul>
      ${data.additionalConditions ? `<p><strong>Additional conditions:</strong> ${data.additionalConditions}</p>` : ''}

      <h2 style="margin-top: 30px; padding-bottom: 8px; border-bottom: 1px solid #ddd; font-size: 16px;">6. Due Diligence</h2>
      <p>The Buyer shall be entitled to conduct full financial, legal, commercial, and operational due diligence on the Company during the Exclusivity Period. The Seller agrees to provide reasonable access to all requested information and documentation.</p>

      <h2 style="margin-top: 30px; padding-bottom: 8px; border-bottom: 1px solid #ddd; font-size: 16px;">7. Exclusivity</h2>
      <p>The Seller agrees that for a period of <strong>${raw.exclusivityPeriodDays || 90} days</strong> from the date of these Heads of Terms, they shall not directly or indirectly solicit, encourage, or negotiate with any third party regarding the sale of the Company or any material part of its business or assets.</p>

      <h2 style="margin-top: 30px; padding-bottom: 8px; border-bottom: 1px solid #ddd; font-size: 16px;">8. Timetable</h2>
      <p>The parties shall use reasonable endeavours to complete the transaction within <strong>${raw.targetCompletionWeeks || 12} weeks</strong> from the date of these Heads of Terms, subject to satisfactory completion of due diligence and agreement of the Share Purchase Agreement.</p>

      <h2 style="margin-top: 30px; padding-bottom: 8px; border-bottom: 1px solid #ddd; font-size: 16px;">9. Costs</h2>
      <p>Each party shall bear their own costs in relation to the negotiation and completion of the proposed acquisition, including legal, accounting, and advisory fees.</p>

      <h2 style="margin-top: 30px; padding-bottom: 8px; border-bottom: 1px solid #ddd; font-size: 16px;">10. Governing Law</h2>
      <p>These Heads of Terms and any dispute arising from them shall be governed by and construed in accordance with English law. The courts of England and Wales shall have exclusive jurisdiction.</p>

      <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd;">
        <p style="margin-bottom: 4px;"><strong>Status:</strong> These Heads of Terms are not legally binding save for the provisions relating to exclusivity, confidentiality, and costs, which are intended to be legally binding.</p>
      </div>

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
