import { Router, Request, Response } from 'express';
import { documentsService } from '../services/documents.service';
import { sendSuccess } from '../utils/response';
import { UnauthorizedError } from '../utils/errors';
import { asyncHandler } from '../utils/async-handler';

const router = Router();

router.get('/categories', asyncHandler(async (req: Request, res: Response) => {
  const categories = await documentsService.getDocumentCategories();
  sendSuccess(res, categories);
}));

router.get('/company/:companyId', asyncHandler(async (req: Request, res: Response) => {
  const userCompanyId = req.session?.userCompanyId;
  const targetCompanyId = parseInt(req.params.companyId);

  if (!userCompanyId) {
    throw new UnauthorizedError();
  }

  const documents = await documentsService.getCompanyDocuments(targetCompanyId, userCompanyId);
  sendSuccess(res, documents);
}));

router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const userCompanyId = req.session?.userCompanyId;
  const documentId = parseInt(req.params.id);

  if (!userCompanyId) {
    throw new UnauthorizedError();
  }

  const document = await documentsService.getDocument(documentId, userCompanyId);
  sendSuccess(res, document);
}));

router.put('/:id', asyncHandler(async (req: Request, res: Response) => {
  const userCompanyId = req.session?.userCompanyId;
  const documentId = parseInt(req.params.id);

  if (!userCompanyId) {
    throw new UnauthorizedError();
  }

  const updatedDocument = await documentsService.updateDocument(
    documentId,
    req.body,
    userCompanyId
  );

  sendSuccess(res, updatedDocument);
}));

router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  const userCompanyId = req.session?.userCompanyId;
  const documentId = parseInt(req.params.id);

  if (!userCompanyId) {
    throw new UnauthorizedError();
  }

  await documentsService.deleteDocument(documentId, userCompanyId);
  sendSuccess(res, { message: 'Document deleted successfully' });
}));

export default router;
