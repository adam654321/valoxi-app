import type { Request, Response, NextFunction } from "express";
import { db } from '../db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';

export async function isAuthenticated(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
}

export async function isSystemAdmin(req: Request, res: Response, next: NextFunction) {
  if ((req as any).isSystemAdminVerified) {
    return next();
  }

  const [user] = await db.select({ isSystemAdmin: users.isSystemAdmin }).from(users).where(eq(users.id, req.session.userId!));

  if (!user || !user.isSystemAdmin) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. System administrator privileges required.',
      code: 'FORBIDDEN',
    });
  }

  (req as any).isSystemAdminVerified = true;
  next();
}
