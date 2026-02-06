import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { usersRepository } from '../repositories/users.repository';
import { sendSuccess, sendCreated, sendError } from '../utils/response';
import { UnauthorizedError, BadRequestError, ForbiddenError } from '../utils/errors';

const router = Router();

const createCompanySchema = z.object({
  companyName: z.string().min(1, 'Company name is required'),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
});

router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.session?.userId;
    if (!userId) throw new UnauthorizedError();

    const companies = await usersRepository.getUserCompanies(userId);

    const companiesWithDetails = await Promise.all(
      companies.map(async (membership) => {
        const company = await usersRepository.getUserCompany(membership.userCompanyId);
        return {
          id: membership.id,
          companyId: membership.userCompanyId,
          companyName: company?.companyName || 'Unknown Company',
          email: company?.email,
          phone: company?.phone,
          address: company?.address,
          isAdmin: membership.isCompanyAdmin,
          role: membership.membershipRole,
          joinedAt: membership.joinedAt,
          isActive: membership.isActive,
          isCurrent: membership.userCompanyId === req.session.userCompanyId
        };
      })
    );

    res.json(companiesWithDetails);
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = req.session?.userId;
    if (!userId) throw new UnauthorizedError();

    const validatedData = createCompanySchema.parse(req.body);

    const existingCompanies = await usersRepository.getUserCompanies(userId);
    if (existingCompanies.length >= 5) {
      throw new BadRequestError('Maximum of 5 companies allowed per user');
    }

    const newCompany = await usersRepository.createUserCompany({
      companyName: validatedData.companyName,
      email: validatedData.email || null,
      phone: validatedData.phone || null,
      address: validatedData.address || null
    });

    const membership = await usersRepository.createUserCompanyMembership({
      userId,
      userCompanyId: newCompany.id,
      isCompanyAdmin: true,
      membershipRole: 'admin',
      isActive: true
    });

    if (existingCompanies.length === 0) {
      await usersRepository.switchUserActiveCompany(userId, newCompany.id);
    }

    res.status(201).json({
      id: membership.id,
      companyId: newCompany.id,
      companyName: newCompany.companyName,
      email: newCompany.email,
      phone: newCompany.phone,
      address: newCompany.address,
      isAdmin: true,
      role: 'admin',
      joinedAt: membership.joinedAt,
      isActive: true,
      isCurrent: existingCompanies.length === 0
    });
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/:companyId/switch', async (req: Request, res: Response) => {
  try {
    const userId = req.session?.userId;
    if (!userId) throw new UnauthorizedError();

    const companyId = parseInt(req.params.companyId);
    if (isNaN(companyId)) throw new BadRequestError('Invalid company ID');

    const companies = await usersRepository.getUserCompanies(userId);
    const hasAccess = companies.some(c => c.userCompanyId === companyId && c.isActive);

    if (!hasAccess) {
      throw new ForbiddenError('Access denied to this company');
    }

    await usersRepository.switchUserActiveCompany(userId, companyId);

    req.session.userCompanyId = companyId;

    res.json({ success: true, currentCompanyId: companyId });
  } catch (error) {
    sendError(res, error);
  }
});

export default router;
