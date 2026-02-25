import session from "express-session";
import connectPg from "connect-pg-simple";
import type { Pool } from "@neondatabase/serverless";

declare module 'express-session' {
  interface SessionData {
    userId?: number;
    userCompanyId?: number;
    csrfToken?: string;
    isSystemAdmin?: boolean;
    permissions?: Record<string, boolean | null>;
    permissionsCachedAt?: number;
  }
}

const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
const pgStore = connectPg(session);

export function createSessionMiddleware(pool: Pool) {
  if (!process.env.SESSION_SECRET) {
    throw new Error('SESSION_SECRET environment variable is required');
  }

  const isProd = process.env.NODE_ENV === 'production';

  return session({
    name: isProd ? '__Host-sid' : 'sid',
    store: new pgStore({
      pool,
      createTableIfMissing: true,
      ttl: sessionTtl / 1000,
    }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: sessionTtl,
      secure: isProd,
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
    },
  });
}
