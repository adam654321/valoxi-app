import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs/promises';
import multer from 'multer';
import { portalSubmissionsService } from '../services/portal-submissions.service';
import { sendSuccess, sendError } from '../utils/response';
import { BadRequestError } from '../utils/errors';

const router = Router();

const portalUpload = multer({
  storage: multer.diskStorage({
    destination: async (req, file, cb) => {
      const uploadPath = path.join(process.cwd(), 'uploads', 'portal');
      try {
        await fs.mkdir(uploadPath, { recursive: true });
        cb(null, uploadPath);
      } catch (error) { cb(error as Error, ''); }
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
  }),
  fileFilter: (req, file, cb) => {
    const allowedExtensions = /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|csv|jpg|jpeg|png|gif)$/i;
    if (allowedExtensions.test(file.originalname)) cb(null, true);
    else cb(new Error('Only PDF, Office documents, text files and images are allowed'));
  },
  limits: { fileSize: 10 * 1024 * 1024 }
});

router.get('/:token', async (req: Request, res: Response) => {
  try {
    if (req.params.token.includes('/')) return res.status(404).json({ message: 'Not found' });
    const data = await portalSubmissionsService.getPortalData(req.params.token, req.ip, req.get('User-Agent'));
    sendSuccess(res, data);
  } catch (error) { sendError(res, error); }
});

router.post('/:token/submit', (req: Request, res: Response) => {
  portalUpload.single('document')(req, res, async (err) => {
    try {
      if (err) {
        if ((err as any).code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'File too large. Max 10MB.' });
        return res.status(400).json({ error: err.message });
      }
      if (!req.file) throw new BadRequestError('No document uploaded');
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const result = await portalSubmissionsService.submitDocument(req.params.token, req.file, req.body, baseUrl, req.ip, req.get('User-Agent'));
      sendSuccess(res, { success: true, submissionId: result.submissionId, message: 'Document submitted successfully', filename: result.filename });
    } catch (error) {
      if (req.file) try { await fs.unlink(req.file.path); } catch { }
      sendError(res, error);
    }
  });
});

router.get('/:token/submissions', async (req: Request, res: Response) => {
  try {
    const submissions = await portalSubmissionsService.getSubmissions(req.params.token, req.ip, req.get('User-Agent'));
    sendSuccess(res, submissions);
  } catch (error) { sendError(res, error); }
});

router.get('/:token/analysis-completion', async (req: Request, res: Response) => {
  try {
    const status = await portalSubmissionsService.getAnalysisStatus(req.params.token, req.ip, req.get('User-Agent'));
    sendSuccess(res, status);
  } catch (error) { sendError(res, error); }
});

router.get('/:token/documents', async (req: Request, res: Response) => {
  try {
    const documents = await portalSubmissionsService.getDocuments(req.params.token);
    sendSuccess(res, documents);
  } catch (error) { sendError(res, error); }
});

router.delete('/:token/documents/:id', async (req: Request, res: Response) => {
  try {
    const documentId = parseInt(req.params.id);
    if (isNaN(documentId)) throw new BadRequestError('Invalid document ID');
    await portalSubmissionsService.deleteDocument(req.params.token, documentId);
    sendSuccess(res, { success: true });
  } catch (error) { sendError(res, error); }
});

export default router;
