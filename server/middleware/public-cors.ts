import type { Request, Response, NextFunction } from 'express';
import { config } from '../config';

/**
 * CORS for the public endpoints the marketing site calls cross-origin.
 * Allowlist: the marketing site origin (prod) plus localhost in non-production.
 * An Origin that is present but not on the allowlist is rejected with 403.
 * A request with no Origin header (same-origin / server-to-server) passes through.
 * Applied per-router (checkout + config), NOT on the shared /api/v2/public prefix.
 */
const allowedOrigins: string[] = [
  config.marketing.siteUrl,
  ...(config.server.isProduction
    ? []
    : [
        // The marketing site's Next dev server. 3000 is its default port; 3002
        // and 3008 are kept for older local setups. NON-PRODUCTION ONLY: the
        // isProduction branch above returns an empty list, so none of these can
        // ever be allowed on prod.
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'http://localhost:3002',
        'http://127.0.0.1:3002',
        'http://localhost:3008',
      ]),
];

export function publicCors(req: Request, res: Response, next: NextFunction) {
  const requestOrigin = req.headers.origin;

  if (requestOrigin) {
    if (allowedOrigins.includes(requestOrigin)) {
      res.setHeader('Access-Control-Allow-Origin', requestOrigin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      res.setHeader('Access-Control-Max-Age', '86400');
    } else {
      return res.status(403).json({
        success: false,
        message: 'Origin not allowed',
        code: 'CORS_ORIGIN_REJECTED',
      });
    }
  }

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  return next();
}
