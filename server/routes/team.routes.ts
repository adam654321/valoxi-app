import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { teamService } from '../services/team.service';
import { sendSuccess, sendCreated, sendError } from '../utils/response';
import { UnauthorizedError } from '../utils/errors';
import { usersRepository } from '../repositories/users.repository';

const router = Router();
const publicRouter = Router();

publicRouter.get('/invitation/:token', async (req: Request, res: Response) => {
  try {
    const invitation = await teamService.getInvitationByToken(req.params.token);
    sendSuccess(res, { email: invitation.email, invitedRole: invitation.invitedRole, companyName: invitation.companyName, inviterName: invitation.inviterName, invitationMessage: invitation.invitationMessage, invitationStatus: invitation.invitationStatus });
  } catch (error) {
    sendError(res, error);
  }
});

publicRouter.post('/invitation/:token/accept', async (req: Request, res: Response) => {
  try {
    const schema = z.object({ firstName: z.string().min(1), lastName: z.string().min(1), password: z.string().min(8) });
    const { firstName, lastName, password } = schema.parse(req.body);
    const user = await teamService.acceptInvitation(req.params.token, firstName, lastName, password);
    sendSuccess(res, { message: 'Invitation accepted successfully', user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName } });
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/invite', async (req: Request, res: Response) => {
  try {
    const userId = req.session?.userId;
    const userCompanyId = req.session?.userCompanyId;
    if (!userId || !userCompanyId) throw new UnauthorizedError();
    const schema = z.object({ email: z.string().email(), role: z.string().min(1), message: z.string().optional() });
    const { email, role, message } = schema.parse(req.body);
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const invitation = await teamService.createInvitation(userId, userCompanyId, email, role, message, req.ip, usersRepository.getUserWithPermissions.bind(usersRepository), baseUrl);
    const inviteUrl = `${baseUrl}/invite/${invitation.invitationToken}`;
    sendCreated(res, { message: 'Invitation sent successfully', invitation: { id: invitation.id, email: invitation.email, role: invitation.invitedRole, status: invitation.invitationStatus, sentAt: invitation.sentAt, inviteUrl } });
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/invitations', async (req: Request, res: Response) => {
  try {
    const userId = req.session?.userId;
    const userCompanyId = req.session?.userCompanyId;
    if (!userId || !userCompanyId) throw new UnauthorizedError();
    const invitations = await teamService.getInvitationsByCompany(userId, userCompanyId, usersRepository.getUserWithPermissions.bind(usersRepository));
    sendSuccess(res, invitations);
  } catch (error) {
    sendError(res, error);
  }
});

router.put('/invitations/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.session?.userId;
    const userCompanyId = req.session?.userCompanyId;
    if (!userId || !userCompanyId) throw new UnauthorizedError();
    const { status } = z.object({ status: z.string() }).parse(req.body);
    const updated = await teamService.updateInvitation(parseInt(req.params.id), userId, userCompanyId, status, usersRepository.getUserWithPermissions.bind(usersRepository));
    sendSuccess(res, updated);
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/members', async (req: Request, res: Response) => {
  try {
    const userCompanyId = req.session?.userCompanyId;
    if (!userCompanyId) throw new UnauthorizedError();
    const members = await teamService.getTeamMembers(userCompanyId);
    sendSuccess(res, members);
  } catch (error) {
    sendError(res, error);
  }
});

router.put('/members/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.session?.userId;
    const userCompanyId = req.session?.userCompanyId;
    if (!userId || !userCompanyId) throw new UnauthorizedError();
    const { role, status } = z.object({ role: z.string().optional(), status: z.enum(['active', 'inactive']).optional() }).parse(req.body);
    await teamService.updateTeamMember(parseInt(req.params.id), userId, userCompanyId, role, status, usersRepository.getUserWithPermissions.bind(usersRepository));
    sendSuccess(res, { message: 'Team member updated successfully' });
  } catch (error) {
    sendError(res, error);
  }
});

router.delete('/members/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.session?.userId;
    const userCompanyId = req.session?.userCompanyId;
    if (!userId || !userCompanyId) throw new UnauthorizedError();
    await teamService.removeTeamMember(parseInt(req.params.id), userId, userCompanyId, usersRepository.getUserWithPermissions.bind(usersRepository));
    sendSuccess(res, { message: 'Team member removed successfully' });
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/roles', async (req: Request, res: Response) => {
  try {
    const roles = await teamService.getRoles();
    sendSuccess(res, roles);
  } catch (error) {
    sendError(res, error);
  }
});

export { publicRouter as publicTeamRoutes };
export default router;
