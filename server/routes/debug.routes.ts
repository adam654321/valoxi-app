import { Router, Request, Response } from 'express';
import { sendSuccess, sendError } from '../utils/response';
import { documentAnalysisRepository } from '../repositories/document-analysis.repository';

const router = Router();

export default router;
