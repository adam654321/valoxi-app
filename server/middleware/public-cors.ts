import type { Request, Response, NextFunction } from 'express';
import { config } from '../config';

/**
 * CORS for the public endpoints the marketing site calls cross-origin.
 * Scoped to the marketing site origin only — not a wildcard.
 * Applied per-router (checkout + config), NOT on the shared /api/v2/public prefix.
 */
export function publicCors(req: Request, res: Response, next: NextFunction) {
  const allowedOrigin = config.marketing.siteUrl;
  const requestOrigin = req.headers.origin;

  if (requestOrigin && requestOrigin === allowedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Max-Age', '86400');
  }

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  return next();
}
