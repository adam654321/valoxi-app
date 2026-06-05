import { Router, Request, Response } from 'express';
import path from 'path';
import multer from 'multer';
import { documentsFilesService } from '../services/documents-files.service';
import { documentsRepository } from '../repositories/documents.repository';
import { fileStorageService } from '../services/file-storage.service';
import { sendSuccess, sendCreated, sendError } from '../utils/response';
import { UnauthorizedError, BadRequestError } from '../utils/errors';
import { requirePermission } from '../middleware/auth';
import { asyncHandler } from '../utils/async-handler';
import { sanitizeFilename, sharedFileFilter, isAllowedFile } from '../utils/upload';

import { uploadLimiter } from '../middleware/rate-limit';

const router = Router();

const upload = multer({ storage: multer.memoryStorage(), fileFilter: sharedFileFilter, limits: { fileSize: 10 * 1024 * 1024 } });

async function serveFile(
  res: Response,
  filePath: string,
  contentType: string,
  disposition: string,
  filename: string
) {
  if (!fileStorageService.isObjectStorageKey(filePath)) {
    return res.status(404).json({
      error: 'file_unavailable',
      message: 'This file was uploaded before cloud storage was enabled. Please re-upload the document.',
    });
  }
  try {
    const buffer = await fileStorageService.download(filePath);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `${disposition}; filename="${filename}"`);
    return res.send(buffer);
  } catch {
    return res.status(404).json({ error: 'file_not_found', message: 'File not found.' });
  }
}

router.delete('/clear-all', requirePermission('canEditAllDeals'), asyncHandler(async (req: Request, res: Response) => {
  const userCompanyId = req.session?.userCompanyId;
  const userId = req.session?.userId;
  if (!userCompanyId || !userId) throw new UnauthorizedError();

  console.log(`[API] Clearing all documents for user company ${userCompanyId}, requested by user ${userId}`);

  const result = await documentsFilesService.clearAllCompanyDocuments(userCompanyId);

  console.log(`[API] Document clearing completed: ${result.deletedDocuments} doc(s), ${result.deletedExternalSubmissions} submission(s), ${result.filesDeleted.length} file(s) removed from storage`);

  sendSuccess(res, {
    success: true,
    message: 'All company documents have been cleared successfully',
    details: result
  });
}));

router.get('/categories', asyncHandler(async (req: Request, res: Response) => {
  const categories = await documentsFilesService.getDocumentCategories();
  sendSuccess(res, categories);
}));

router.post('/company/:id/upload', uploadLimiter, requirePermission('canUploadDocuments'), (req: Request, res: Response) => {
  upload.single('document')(req, res, async (err) => {
    try {
      const userId = req.session?.userId;
      const userCompanyId = req.session?.userCompanyId;
      if (!userId || !userCompanyId) throw new UnauthorizedError();
      const targetCompanyId = parseInt(req.params.id);
      if (isNaN(targetCompanyId)) throw new BadRequestError('Invalid company ID');
      if (err) {
        if ((err as any).code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'File too large. Max 10MB.' });
        return res.status(400).json({ error: err.message });
      }
      if (!req.file) throw new BadRequestError('No file uploaded');
      await documentsFilesService.verifyCompanyAccess(targetCompanyId, userCompanyId);
      const documentCategory = req.body.document_category || 'Company Accounts';
      const originalFilename = sanitizeFilename(req.file.originalname);
      const r2Key = fileStorageService.generateKey(`companies/${targetCompanyId}`, originalFilename);
      await fileStorageService.upload(r2Key, req.file.buffer);
      const document = await documentsFilesService.createDocument({
        targetCompanyId,
        uploadedBy: userId,
        documentName: req.body.document_name || originalFilename,
        originalFilename: originalFilename,
        filePath: r2Key,
        fileSize: req.file.size,
        fileType: req.file.mimetype,
        documentCategory,
        description: req.body.description || '',
        isConfidential: req.body.is_confidential !== 'false',
      });
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const uploadEvent = await documentsFilesService.createFileUploadEvent({
        documentId: document.id,
        targetCompanyId,
        uploadedBy: userId,
        fileName: originalFilename,
        fileUrl: `${baseUrl}/api/v2/public/documents/${document.publicToken}/download`,
      });
      
      const { analysisQueue } = await import('../services/analysis-queue.service');
      analysisQueue.enqueue({
        eventId: uploadEvent.id,
        targetCompanyId: parseInt(req.params.id),
      });
      
      const { track } = await import('../services/funnel.service');
      track(userCompanyId, userId, 'document.uploaded', { documentType: documentCategory, fileSize: req.file.size });

      sendCreated(res, { success: true, document, uploadEventId: uploadEvent.id, message: 'Document uploaded successfully' });
    } catch (error) { sendError(res, error); }
  });
});

router.post('/company/:id/upload-url', uploadLimiter, requirePermission('canUploadDocuments'), asyncHandler(async (req: Request, res: Response) => {
  const userId = req.session?.userId;
  const userCompanyId = req.session?.userCompanyId;
  if (!userId || !userCompanyId) throw new UnauthorizedError();
  const targetCompanyId = parseInt(req.params.id);
  if (isNaN(targetCompanyId)) throw new BadRequestError('Invalid company ID');
  await documentsFilesService.verifyCompanyAccess(targetCompanyId, userCompanyId);

  const originalFilename = sanitizeFilename(typeof req.body.filename === 'string' ? req.body.filename : '');
  if (!originalFilename || originalFilename === 'unnamed-file') throw new BadRequestError('A filename is required');
  const contentType = (typeof req.body.contentType === 'string' && req.body.contentType.trim()) ? req.body.contentType.trim() : 'application/octet-stream';
  if (!isAllowedFile(originalFilename, contentType)) {
    throw new BadRequestError('File rejected: must have both a permitted file type and extension.');
  }
  const declaredSize = Number(req.body.fileSize);
  if (Number.isFinite(declaredSize) && declaredSize > 10 * 1024 * 1024) {
    throw new BadRequestError('File too large. Max 10MB.');
  }

  const key = fileStorageService.generateKey(`companies/${targetCompanyId}`, originalFilename);
  const uploadUrl = await fileStorageService.getPresignedPutUrl(key, contentType, 300);
  sendSuccess(res, { uploadUrl, key, contentType, originalFilename });
}));

router.post('/company/:id/register', requirePermission('canUploadDocuments'), asyncHandler(async (req: Request, res: Response) => {
  const userId = req.session?.userId;
  const userCompanyId = req.session?.userCompanyId;
  if (!userId || !userCompanyId) throw new UnauthorizedError();
  const targetCompanyId = parseInt(req.params.id);
  if (isNaN(targetCompanyId)) throw new BadRequestError('Invalid company ID');
  await documentsFilesService.verifyCompanyAccess(targetCompanyId, userCompanyId);

  const key = typeof req.body.key === 'string' ? req.body.key : '';
  const expectedPrefix = `companies/${targetCompanyId}/`;
  if (!key.startsWith(expectedPrefix)) throw new BadRequestError('Invalid storage key for this company');

  const head = await fileStorageService.head(key);
  if (!head) throw new BadRequestError('Uploaded file not found. Please retry the upload.');
  if (head.size > 10 * 1024 * 1024) {
    await fileStorageService.delete(key);
    throw new BadRequestError('File too large. Max 10MB.');
  }
  if (head.size === 0) {
    await fileStorageService.delete(key);
    throw new BadRequestError('Uploaded file is empty.');
  }

  const originalFilename = sanitizeFilename(req.body.fileName || req.body.originalFilename || 'unnamed-file');
  if (!isAllowedFile(originalFilename, head.contentType)) {
    await fileStorageService.delete(key);
    throw new BadRequestError('File rejected: must have both a permitted file type and extension.');
  }

  const documentCategory = req.body.document_category || 'Company Accounts';
  const document = await documentsFilesService.createDocument({
    targetCompanyId,
    uploadedBy: userId,
    documentName: req.body.document_name || originalFilename,
    originalFilename,
    filePath: key,
    fileSize: head.size,
    fileType: head.contentType,
    documentCategory,
    description: req.body.description || '',
    isConfidential: req.body.is_confidential !== false && req.body.is_confidential !== 'false',
  });
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  const uploadEvent = await documentsFilesService.createFileUploadEvent({
    documentId: document.id,
    targetCompanyId,
    uploadedBy: userId,
    fileName: originalFilename,
    fileUrl: `${baseUrl}/api/v2/public/documents/${document.publicToken}/download`,
  });

  const { analysisQueue } = await import('../services/analysis-queue.service');
  analysisQueue.enqueue({ eventId: uploadEvent.id, targetCompanyId });

  const { track } = await import('../services/funnel.service');
  track(userCompanyId, userId, 'document.uploaded', { documentType: documentCategory, fileSize: head.size });

  sendCreated(res, { success: true, document, uploadEventId: uploadEvent.id, message: 'Document registered successfully' });
}));

router.get('/company/:id', asyncHandler(async (req: Request, res: Response) => {
  const userCompanyId = req.session?.userCompanyId;
  if (!userCompanyId) throw new UnauthorizedError();
  const targetCompanyId = parseInt(req.params.id);
  if (isNaN(targetCompanyId)) throw new BadRequestError('Invalid company ID');
  const { documents, grouped } = await documentsFilesService.getCompanyDocuments(targetCompanyId, userCompanyId);
  sendSuccess(res, { documents, grouped, count: documents.length });
}));

router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const userCompanyId = req.session?.userCompanyId;
  if (!userCompanyId) throw new UnauthorizedError();
  const documentId = parseInt(req.params.id);
  if (isNaN(documentId)) throw new BadRequestError('Invalid document ID');
  const document = await documentsFilesService.getDocument(documentId, userCompanyId);
  sendSuccess(res, document);
}));

router.get('/:id/view', asyncHandler(async (req: Request, res: Response) => {
  const userId = req.session?.userId;
  const userCompanyId = req.session?.userCompanyId;
  if (!userId || !userCompanyId) throw new UnauthorizedError();
  const documentId = parseInt(req.params.id);
  if (isNaN(documentId)) throw new BadRequestError('Invalid document ID');
  const document = await documentsFilesService.getDocument(documentId, userCompanyId);
  await documentsFilesService.logAccess(documentId, userId, 'view', req.ip);
  res.setHeader('Cache-Control', 'private, max-age=3600');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  return serveFile(res, document.filePath, document.fileType || 'application/octet-stream', 'inline', sanitizeFilename(document.originalFilename));
}));

router.get('/:id/download', asyncHandler(async (req: Request, res: Response) => {
  const userId = req.session?.userId;
  const userCompanyId = req.session?.userCompanyId;
  if (!userId || !userCompanyId) throw new UnauthorizedError();
  const documentId = parseInt(req.params.id);
  if (isNaN(documentId)) throw new BadRequestError('Invalid document ID');
  const document = await documentsFilesService.getDocument(documentId, userCompanyId);
  await documentsFilesService.logAccess(documentId, userId, 'download', req.ip);
  return serveFile(res, document.filePath, document.fileType || 'application/octet-stream', 'attachment', sanitizeFilename(document.originalFilename));
}));

router.put('/:id', asyncHandler(async (req: Request, res: Response) => {
  const userCompanyId = req.session?.userCompanyId;
  if (!userCompanyId) throw new UnauthorizedError();
  const documentId = parseInt(req.params.id);
  if (isNaN(documentId)) throw new BadRequestError('Invalid document ID');
  const document = await documentsFilesService.updateDocument(documentId, userCompanyId, {
    documentName: req.body.document_name,
    documentCategory: req.body.document_category,
    description: req.body.description,
    isConfidential: req.body.is_confidential,
  });
  sendSuccess(res, { success: true, document });
}));

router.delete('/:id', requirePermission('canEditAllDeals'), asyncHandler(async (req: Request, res: Response) => {
  const userCompanyId = req.session?.userCompanyId;
  if (!userCompanyId) throw new UnauthorizedError();
  const documentId = parseInt(req.params.id);
  if (isNaN(documentId)) throw new BadRequestError('Invalid document ID');
  await documentsFilesService.deleteDocument(documentId, userCompanyId);
  sendSuccess(res, { success: true });
}));

export default router;

export const publicDocumentRoutes = Router();

publicDocumentRoutes.get('/:token/download', asyncHandler(async (req: Request, res: Response) => {
  const { token } = req.params;
  if (!token || token.length < 10) return res.status(400).json({ error: 'Invalid token' });
  const document = await documentsFilesService.getDocumentByPublicToken(token);
  if (!document) return res.status(404).json({ error: 'Document not found' });
  await documentsRepository.logDocumentAccess(document.id, null as any, 'public_download', req.ip);
  return serveFile(res, document.filePath, document.fileType || 'application/octet-stream', 'attachment', sanitizeFilename(document.originalFilename));
}));

publicDocumentRoutes.get('/:token/view', asyncHandler(async (req: Request, res: Response) => {
  const { token } = req.params;
  if (!token || token.length < 10) return res.status(400).json({ error: 'Invalid token' });
  const document = await documentsFilesService.getDocumentByPublicToken(token);
  if (!document) return res.status(404).json({ error: 'Document not found' });
  await documentsRepository.logDocumentAccess(document.id, null as any, 'public_view', req.ip);
  res.setHeader('Cache-Control', 'private, max-age=3600');
  return serveFile(res, document.filePath, document.fileType || 'application/octet-stream', 'inline', sanitizeFilename(document.originalFilename));
}));
