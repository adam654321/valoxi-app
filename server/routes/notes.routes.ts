import { Router, Request, Response } from 'express';
import { notesService } from '../services/notes.service';
import { sendSuccess, sendCreated } from '../utils/response';
import { asyncHandler } from '../utils/async-handler';
import { UnauthorizedError } from '../utils/errors';

const router = Router();

// Get notes for a target company
router.get('/company/:companyId', asyncHandler(async (req: Request, res: Response) => {
  const userCompanyId = req.session?.userCompanyId;
  const companyId = parseInt(req.params.companyId);
  if (!userCompanyId) throw new UnauthorizedError();

  const notes = await notesService.getByTargetCompany(companyId, userCompanyId);
  sendSuccess(res, notes);
}));

// Create a note for a target company
router.post('/company/:companyId', asyncHandler(async (req: Request, res: Response) => {
  const userId = req.session?.userId;
  const userCompanyId = req.session?.userCompanyId;
  const companyId = parseInt(req.params.companyId);
  if (!userId || !userCompanyId) throw new UnauthorizedError();

  const note = await notesService.create(companyId, req.body, userId, userCompanyId);
  sendCreated(res, note);
}));

// Update a note
router.put('/:noteId', asyncHandler(async (req: Request, res: Response) => {
  const userId = req.session?.userId;
  const noteId = parseInt(req.params.noteId);
  if (!userId) throw new UnauthorizedError();

  const note = await notesService.update(noteId, req.body);
  sendSuccess(res, note);
}));

// Delete a note
router.delete('/:noteId', asyncHandler(async (req: Request, res: Response) => {
  const userId = req.session?.userId;
  const noteId = parseInt(req.params.noteId);
  if (!userId) throw new UnauthorizedError();

  await notesService.delete(noteId);
  sendSuccess(res, { message: 'Note deleted' });
}));

export default router;
