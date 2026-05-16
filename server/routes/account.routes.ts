import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { users, userCompanies } from '@shared/schema/core';
import { sendSuccess } from '../utils/response';
import { UnauthorizedError, BadRequestError } from '../utils/errors';
import { asyncHandler } from '../utils/async-handler';
import { requirePermission } from '../middleware/auth';

const router = Router();

const updateProfileSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  jobTitle: z.string().max(100).optional().nullable(),
});

const updateCompanySchema = z.object({
  companyName: z.string().min(1, 'Company name is required').max(255),
  industry: z.string().max(100).optional().nullable(),
  companySize: z.string().max(50).optional().nullable(),
  country: z.string().max(10).optional().nullable(),
  email: z.string().max(255).optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  address: z.string().optional().nullable(),
});

router.get('/profile', asyncHandler(async (req: Request, res: Response) => {
  const userId = req.session?.userId;
  if (!userId) throw new UnauthorizedError();

  const [user] = await db
    .select({
      id: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
      email: users.email,
      jobTitle: users.jobTitle,
      isCompanyAdmin: users.isCompanyAdmin,
    })
    .from(users)
    .where(eq(users.id, userId));

  if (!user) throw new UnauthorizedError();
  sendSuccess(res, user);
}));

router.patch('/profile', asyncHandler(async (req: Request, res: Response) => {
  const userId = req.session?.userId;
  if (!userId) throw new UnauthorizedError();

  const data = updateProfileSchema.parse(req.body);

  await db.update(users).set({
    firstName: data.firstName,
    lastName: data.lastName,
    jobTitle: data.jobTitle ?? null,
  }).where(eq(users.id, userId));

  sendSuccess(res, { message: 'Profile updated successfully' });
}));

router.patch('/password', (_req: Request, res: Response) => {
  res.status(410).json({ success: false, message: 'Password management is handled through the authentication provider.' });
});

router.patch('/company', requirePermission('canManageCompany'), asyncHandler(async (req: Request, res: Response) => {
  const userCompanyId = req.session?.userCompanyId;
  if (!userCompanyId) throw new UnauthorizedError();

  const data = updateCompanySchema.parse(req.body);

  await db.update(userCompanies).set({
    companyName: data.companyName,
    industry: data.industry ?? null,
    companySize: data.companySize ?? null,
    country: data.country ?? null,
    email: data.email || null,
    phone: data.phone ?? null,
    address: data.address ?? null,
  }).where(eq(userCompanies.id, userCompanyId));

  sendSuccess(res, { message: 'Company settings updated successfully' });
}));

export default router;
