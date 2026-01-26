import { Router, Request, Response } from 'express';
import { contactsService } from '../services/contacts.service';
import { sendSuccess, sendCreated, sendError } from '../utils/response';
import { UnauthorizedError } from '../utils/errors';
import { insertTargetContactSchema } from '@shared/schema';

const router = Router();

const contactCreateSchema = insertTargetContactSchema.omit({
  targetCompanyId: true,
});

router.get('/all', async (req: Request, res: Response) => {
  try {
    const userCompanyId = req.session?.userCompanyId;

    if (!userCompanyId) {
      throw new UnauthorizedError();
    }

    const contacts = await contactsService.getAllContactsForUserCompany(userCompanyId);
    sendSuccess(res, contacts);
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

    const contacts = await contactsService.getContactsForTargetCompany(targetCompanyId, userCompanyId);
    sendSuccess(res, contacts);
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const userCompanyId = req.session?.userCompanyId;
    const contactId = parseInt(req.params.id);

    if (!userCompanyId) {
      throw new UnauthorizedError();
    }

    const contact = await contactsService.getTargetContact(contactId, userCompanyId);
    sendSuccess(res, contact);
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/company/:companyId', async (req: Request, res: Response) => {
  try {
    const userCompanyId = req.session?.userCompanyId;
    const targetCompanyId = parseInt(req.params.companyId);

    if (!userCompanyId) {
      throw new UnauthorizedError();
    }

    const validatedData = contactCreateSchema.parse(req.body);

    const contact = await contactsService.createTargetContact(
      targetCompanyId,
      validatedData,
      userCompanyId
    );

    sendCreated(res, contact);
  } catch (error) {
    sendError(res, error);
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const userCompanyId = req.session?.userCompanyId;
    const contactId = parseInt(req.params.id);

    if (!userCompanyId) {
      throw new UnauthorizedError();
    }

    const validatedData = contactCreateSchema.partial().parse(req.body);

    const updatedContact = await contactsService.updateTargetContact(
      contactId,
      validatedData,
      userCompanyId
    );

    sendSuccess(res, updatedContact);
  } catch (error) {
    sendError(res, error);
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userCompanyId = req.session?.userCompanyId;
    const contactId = parseInt(req.params.id);

    if (!userCompanyId) {
      throw new UnauthorizedError();
    }

    await contactsService.deleteTargetContact(contactId, userCompanyId);
    sendSuccess(res, { message: 'Contact deleted successfully' });
  } catch (error) {
    sendError(res, error);
  }
});

export default router;
