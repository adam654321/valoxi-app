import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { teamService } from '../services/team.service';
import { sendSuccess, sendCreated } from '../utils/response';
import { UnauthorizedError } from '../utils/errors';
import { usersRepository } from '../repositories/users.repository';
import { asyncHandler } from '../utils/async-handler';

const router = Router();
const publicRouter = Router();

publicRouter.get('/invitation/:token', asyncHandler(async (req: Request, res: Response) => {
  const invitation = await teamService.getInvitationByToken(req.params.token);
  sendSuccess(res, { email: invitation.email, invitedRole: invitation.invitedRole, companyName: invitation.companyName, inviterName: invitation.inviterName, invitationMessage: invitation.invitationMessage, invitationStatus: invitation.invitationStatus });
}));

publicRouter.post('/invitation/:token/accept', asyncHandler(async (req: Request, res: Response) => {
  const schema = z.object({ firstName: z.string().min(1), lastName: z.string().min(1), password: z.string().min(8) });
  const { firstName, lastName, password } = schema.parse(req.body);
  const user = await teamService.acceptInvitation(req.params.token, firstName, lastName, password);
  sendSuccess(res, { message: 'Invitation accepted successfully', user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName } });
}));

router.post('/invite', async (req: Request, res: Response) => {
  try {
    const userId = req.session?.userId;
    const userCompanyId = req.session?.userCompanyId;
    if (!userId || !userCompanyId) throw new UnauthorizedError();
    const schema = z.object({
      email: z.string().email().transform(v => v.toLowerCase()),
      firstName: z.string().min(1).max(100).trim(),
      lastName: z.string().min(1).max(100).trim(),
      jobTitle: z.string().max(100).trim().optional(),
      role: z.string().min(1),
      message: z.string().optional(),
    });
    const { email, firstName, lastName, jobTitle, role, message } = schema.parse(req.body);
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const invitation = await teamService.createInvitation({
      inviterUserId: userId,
      userCompanyId,
      email, firstName, lastName, jobTitle, role, message,
      ipAddress: req.ip,
      getUserWithPermissions: usersRepository.getUserWithPermissions.bind(usersRepository),
      baseUrl,
    });
    const inviteUrl = `${baseUrl}/invite/${invitation.invitationToken}`;
    sendCreated(res, { message: 'Invitation sent successfully', invitation: { id: invitation.id, email: invitation.email, role: invitation.invitedRole, status: invitation.invitationStatus, sentAt: invitation.sentAt, inviteUrl } });
  } catch (err: any) {
    if (err.seatLimitData) {
      return res.status(403).json({ success: false, ...err.seatLimitData });
    }
    if (err.statusCode) {
      return res.status(err.statusCode).json({ success: false, message: err.message, code: err.code });
    }
    return res.status(500).json({ success: false, message: 'Failed to send invitation.' });
  }
});

router.get('/invitations', asyncHandler(async (req: Request, res: Response) => {
  const userId = req.session?.userId;
  const userCompanyId = req.session?.userCompanyId;
  if (!userId || !userCompanyId) throw new UnauthorizedError();
  const invitations = await teamService.getInvitationsByCompany(userId, userCompanyId, usersRepository.getUserWithPermissions.bind(usersRepository));
  sendSuccess(res, invitations);
}));

router.put('/invitations/:id', asyncHandler(async (req: Request, res: Response) => {
  const userId = req.session?.userId;
  const userCompanyId = req.session?.userCompanyId;
  if (!userId || !userCompanyId) throw new UnauthorizedError();
  const { status } = z.object({ status: z.string() }).parse(req.body);
  const updated = await teamService.updateInvitation(parseInt(req.params.id), userId, userCompanyId, status, usersRepository.getUserWithPermissions.bind(usersRepository));
  sendSuccess(res, updated);
}));

router.get('/members', asyncHandler(async (req: Request, res: Response) => {
  const userCompanyId = req.session?.userCompanyId;
  if (!userCompanyId) throw new UnauthorizedError();
  const members = await teamService.getTeamMembers(userCompanyId);
  sendSuccess(res, members);
}));

router.put('/members/:id', asyncHandler(async (req: Request, res: Response) => {
  const userId = req.session?.userId;
  const userCompanyId = req.session?.userCompanyId;
  if (!userId || !userCompanyId) throw new UnauthorizedError();
  const { role, status } = z.object({ role: z.string().optional(), status: z.enum(['active', 'inactive']).optional() }).parse(req.body);
  await teamService.updateTeamMember(parseInt(req.params.id), userId, userCompanyId, role, status, usersRepository.getUserWithPermissions.bind(usersRepository));
  sendSuccess(res, { message: 'Team member updated successfully' });
}));

router.delete('/members/:id', asyncHandler(async (req: Request, res: Response) => {
  const userId = req.session?.userId;
  const userCompanyId = req.session?.userCompanyId;
  if (!userId || !userCompanyId) throw new UnauthorizedError();
  await teamService.removeTeamMember(parseInt(req.params.id), userId, userCompanyId, usersRepository.getUserWithPermissions.bind(usersRepository));
  sendSuccess(res, { message: 'Team member removed successfully' });
}));

router.get('/roles', asyncHandler(async (req: Request, res: Response) => {
  const roles = await teamService.getRoles();
  sendSuccess(res, roles);
}));

export { publicRouter as publicTeamRoutes };
export default router;
