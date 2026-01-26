import { Router, Request, Response } from 'express';
import { documentsService } from '../services/documents.service';
import { sendSuccess, sendError } from '../utils/response';
import { UnauthorizedError } from '../utils/errors';

const router = Router();

router.get('/categories', async (req: Request, res: Response) => {
  try {
    const categories = await documentsService.getDocumentCategories();
    sendSuccess(res, categories);
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/company/:companyId', async (req: Request, res: Response) => {
  try {
    const userCompanyId = req.session?.userCompanyId;
    const targetCompanyId = parseInt(req.params.companyId);

    if (!userCompanyId) {
      throw new UnauthorizedError();
    }

    const documents = await documentsService.getCompanyDocuments(targetCompanyId, userCompanyId);
    sendSuccess(res, documents);
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const userCompanyId = req.session?.userCompanyId;
    const documentId = parseInt(req.params.id);

    if (!userCompanyId) {
      throw new UnauthorizedError();
    }

    const document = await documentsService.getDocument(documentId, userCompanyId);
    sendSuccess(res, document);
  } catch (error) {
    sendError(res, error);
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
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
  } catch (error) {
    sendError(res, error);
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userCompanyId = req.session?.userCompanyId;
    const documentId = parseInt(req.params.id);

    if (!userCompanyId) {
      throw new UnauthorizedError();
    }

    await documentsService.deleteDocument(documentId, userCompanyId);
    sendSuccess(res, { message: 'Document deleted successfully' });
  } catch (error) {
    sendError(res, error);
  }
});

export default router;
