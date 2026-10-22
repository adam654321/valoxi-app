import { Request, Response, NextFunction } from 'express';
import { randomBytes } from 'crypto';

export function attachCsrfToken(req: Request, _res: Response, next: NextFunction) {
  if (!req.session.csrfToken) {
    req.session.csrfToken = randomBytes(32).toString('hex');
  }
  next();
}

export function validateCsrfToken(req: Request, res: Response, next: NextFunction) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  const headerToken = req.headers['x-csrf-token'] as string | undefined;
  const sessionToken = req.session.csrfToken;

  if (!headerToken || !sessionToken || headerToken !== sessionToken) {
    return res.status(403).json({
      success: false,
      message: 'CSRF token validation failed',
      code: 'CSRF_ERROR',
    });
  }

  next();
}

// ---------------------------------------------------------------------------
// Origin / Referer allowlist — built once at module load
// ---------------------------------------------------------------------------
function parseOrigin(value: string): string | null {
  try {
    const full = /^https?:\/\//i.test(value) ? value : 'https://' + value;
    const o = new URL(full).origin;
    return o === 'null' ? null : o;
  } catch {
    return null;
  }
}

const _originAllowlist = (() => {
  const origins = new Set<string>();

  const appUrl = process.env.APP_URL;
  if (appUrl) {
    const o = parseOrigin(appUrl);
    if (o) origins.add(o);
  }

  const replitDomains = process.env.REPLIT_DOMAINS;
  if (replitDomains) {
    for (const part of replitDomains.split(',')) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      const o = parseOrigin(trimmed);
      if (o) origins.add(o);
    }
  }

  if (origins.size === 0) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        '[Security] APP_URL is unset in production. ' +
        'Refusing to boot with validateOrigin in fail-open mode. Set APP_URL.'
      );
    }
    console.warn(
      '[Security] APP_URL is unset. ' +
      'validateOrigin is in fail-open mode (development only). Set APP_URL in production.'
    );
  }

  return origins;
})();

// ---------------------------------------------------------------------------
// validateOrigin — defence-in-depth layer (C-2)
// ---------------------------------------------------------------------------
export function validateOrigin(req: Request, res: Response, next: NextFunction) {
  // Safe methods carry no CSRF risk
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // Webhook endpoints use signature verification — Origin header is absent by design
  if (
    req.path === '/billing/webhook/stripe' ||
    req.path === '/webhooks/clerk' ||
    req.path === '/webhooks/resend-marketing'
  ) {
    return next();
  }

  // Public unauthenticated routes — no session to defend, rate-limited separately
  if (req.path.startsWith('/public/')) {
    return next();
  }

  // Fail-open when no allowlist was built (missing env vars — warn already logged at load)
  if (_originAllowlist.size === 0) {
    return next();
  }

  const raw: string | undefined =
    (req.headers.origin as string | undefined) ||
    (req.headers.referer as string | undefined);

  if (!raw) {
    return res.status(403).json({
      success: false,
      message: 'Origin validation failed',
      code: 'ORIGIN_ERROR',
    });
  }

  const requestOrigin = parseOrigin(raw);

  if (!requestOrigin || !_originAllowlist.has(requestOrigin)) {
    return res.status(403).json({
      success: false,
      message: 'Origin validation failed',
      code: 'ORIGIN_ERROR',
    });
  }

  next();
}
