import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs/promises';
import multer from 'multer';
import { documentsFilesService } from '../services/documents-files.service';
import { sendSuccess, sendCreated, sendError } from '../utils/response';
import { UnauthorizedError, BadRequestError } from '../utils/errors';
import { sendFileUploadWebhook } from '../services/file-analysis.service';
import { uploadLimiter } from '../middleware/rate-limit';

const router = Router();

const uploadStorage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const companyId = req.params.id;
    if (!companyId) return cb(new Error('Company ID is required'), '');
    const uploadPath = path.join(process.cwd(), 'uploads', 'companies', companyId);
    try {
      await fs.mkdir(uploadPath, { recursive: true });
      cb(null, uploadPath);
    } catch (error) { cb(error as Error, ''); }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `doc-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const fileFilter = (req: any, file: any, cb: any) => {
  const allowedTypes = [
    'application/pdf', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain', 'text/csv', 'image/jpeg', 'image/png'
  ];
  cb(null, allowedTypes.includes(file.mimetype));
};

const upload = multer({ storage: uploadStorage, fileFilter, limits: { fileSize: 10 * 1024 * 1024 } });

router.delete('/clear-all', async (req: Request, res: Response) => {
  try {
    const userCompanyId = req.session?.userCompanyId;
    const userId = req.session?.userId;
    if (!userCompanyId || !userId) throw new UnauthorizedError();

    console.log(`[API] Clearing all documents for user company ${userCompanyId}, requested by user ${userId}`);

    const result = await documentsFilesService.clearAllCompanyDocuments(userCompanyId);

    console.log(`[API] Document clearing completed:`, result);

    sendSuccess(res, {
      success: true,
      message: 'All company documents have been cleared successfully',
      details: result
    });
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/categories', async (req: Request, res: Response) => {
  try {
    const categories = await documentsFilesService.getDocumentCategories();
    sendSuccess(res, categories);
  } catch (error) { sendError(res, error); }
});

router.post('/company/:id/upload', uploadLimiter, (req: Request, res: Response) => {
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
      const originalFilename = req.file.originalname;
      const prefixedFilename = documentCategory === 'Company Accounts' ? `COMPANY ACCOUNTS- ${originalFilename}` : originalFilename;
      const document = await documentsFilesService.createDocument({
        targetCompanyId,
        uploadedBy: userId,
        documentName: req.body.document_name || prefixedFilename,
        originalFilename: prefixedFilename,
        filePath: req.file.path,
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
        fileName: prefixedFilename,
        fileUrl: `${baseUrl}/api/v2/public/documents/${document.id}/download`,
      });
      
      // Trigger Gemini file analysis webhook (runs in background)
      sendFileUploadWebhook(uploadEvent.id).catch(err => {
        console.error('[V2_UPLOAD] File analysis webhook failed:', err);
      });
      
      sendCreated(res, { success: true, document, uploadEventId: uploadEvent.id, message: 'Document uploaded successfully' });
    } catch (error) { sendError(res, error); }
  });
});

router.get('/company/:id', async (req: Request, res: Response) => {
  try {
    const userCompanyId = req.session?.userCompanyId;
    if (!userCompanyId) throw new UnauthorizedError();
    const targetCompanyId = parseInt(req.params.id);
    if (isNaN(targetCompanyId)) throw new BadRequestError('Invalid company ID');
    const { documents, grouped } = await documentsFilesService.getCompanyDocuments(targetCompanyId, userCompanyId);
    sendSuccess(res, { documents, grouped, count: documents.length });
  } catch (error) { sendError(res, error); }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const userCompanyId = req.session?.userCompanyId;
    if (!userCompanyId) throw new UnauthorizedError();
    const documentId = parseInt(req.params.id);
    if (isNaN(documentId)) throw new BadRequestError('Invalid document ID');
    const document = await documentsFilesService.getDocument(documentId, userCompanyId);
    sendSuccess(res, document);
  } catch (error) { sendError(res, error); }
});

router.get('/:id/view', async (req: Request, res: Response) => {
  try {
    const userId = req.session?.userId;
    const userCompanyId = req.session?.userCompanyId;
    if (!userId || !userCompanyId) throw new UnauthorizedError();
    const documentId = parseInt(req.params.id);
    if (isNaN(documentId)) throw new BadRequestError('Invalid document ID');
    const document = await documentsFilesService.getDocument(documentId, userCompanyId);
    await documentsFilesService.logAccess(documentId, userId, 'view', req.ip);
    res.setHeader('Content-Type', document.fileType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${document.originalFilename}"`);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.sendFile(path.resolve(document.filePath));
  } catch (error) { sendError(res, error); }
});

router.get('/:id/download', async (req: Request, res: Response) => {
  try {
    const userId = req.session?.userId;
    const userCompanyId = req.session?.userCompanyId;
    if (!userId || !userCompanyId) throw new UnauthorizedError();
    const documentId = parseInt(req.params.id);
    if (isNaN(documentId)) throw new BadRequestError('Invalid document ID');
    const document = await documentsFilesService.getDocument(documentId, userCompanyId);
    await documentsFilesService.logAccess(documentId, userId, 'download', req.ip);
    res.setHeader('Content-Disposition', `attachment; filename="${document.originalFilename}"`);
    res.setHeader('Content-Type', document.fileType || 'application/octet-stream');
    res.sendFile(path.resolve(document.filePath));
  } catch (error) { sendError(res, error); }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
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
  } catch (error) { sendError(res, error); }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userCompanyId = req.session?.userCompanyId;
    if (!userCompanyId) throw new UnauthorizedError();
    const documentId = parseInt(req.params.id);
    if (isNaN(documentId)) throw new BadRequestError('Invalid document ID');
    await documentsFilesService.deleteDocument(documentId, userCompanyId);
    sendSuccess(res, { success: true });
  } catch (error) { sendError(res, error); }
});

export default router;

export const publicDocumentRoutes = Router();

publicDocumentRoutes.get('/:id/download', async (req: Request, res: Response) => {
  try {
    const documentId = parseInt(req.params.id);
    if (isNaN(documentId)) return res.status(400).json({ error: 'Invalid document ID' });
    const document = await documentsFilesService.getDocumentPublic(documentId);
    res.setHeader('Content-Disposition', `attachment; filename="${document.originalFilename}"`);
    res.setHeader('Content-Type', document.fileType || 'application/octet-stream');
    res.sendFile(path.resolve(document.filePath));
  } catch (error) { sendError(res, error); }
});

publicDocumentRoutes.get('/:id/view', async (req: Request, res: Response) => {
  try {
    const documentId = parseInt(req.params.id);
    if (isNaN(documentId)) return res.status(400).json({ error: 'Invalid document ID' });
    const document = await documentsFilesService.getDocumentPublic(documentId);
    res.setHeader('Content-Type', document.fileType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${document.originalFilename}"`);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.sendFile(path.resolve(document.filePath));
  } catch (error) { sendError(res, error); }
});
