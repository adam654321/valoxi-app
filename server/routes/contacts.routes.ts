import { Router, Request, Response } from 'express';
import { contactsService } from '../services/contacts.service';
import { sendSuccess, sendCreated } from '../utils/response';
import { UnauthorizedError } from '../utils/errors';
import { insertTargetContactSchema } from '@shared/schema';
import { asyncHandler } from '../utils/async-handler';

const router = Router();

const contactCreateSchema = insertTargetContactSchema.omit({
  targetCompanyId: true,
});

router.get('/all', asyncHandler(async (req: Request, res: Response) => {
  const userCompanyId = req.session?.userCompanyId;

  if (!userCompanyId) {
    throw new UnauthorizedError();
  }

  const contacts = await contactsService.getAllContactsForUserCompany(userCompanyId);
  sendSuccess(res, contacts);
}));

router.get('/company/:companyId', asyncHandler(async (req: Request, res: Response) => {
  const userCompanyId = req.session?.userCompanyId;
  const targetCompanyId = parseInt(req.params.companyId);

  if (!userCompanyId) {
    throw new UnauthorizedError();
  }

  const contacts = await contactsService.getContactsForTargetCompany(targetCompanyId, userCompanyId);
  sendSuccess(res, contacts);
}));

router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const userCompanyId = req.session?.userCompanyId;
  const contactId = parseInt(req.params.id);

  if (!userCompanyId) {
    throw new UnauthorizedError();
  }

  const contact = await contactsService.getTargetContact(contactId, userCompanyId);
  sendSuccess(res, contact);
}));

router.post('/company/:companyId', asyncHandler(async (req: Request, res: Response) => {
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
}));

router.put('/:id', asyncHandler(async (req: Request, res: Response) => {
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
}));

router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  const userCompanyId = req.session?.userCompanyId;
  const contactId = parseInt(req.params.id);

  if (!userCompanyId) {
    throw new UnauthorizedError();
  }

  await contactsService.deleteTargetContact(contactId, userCompanyId);
  sendSuccess(res, { message: 'Contact deleted successfully' });
}));

export default router;
