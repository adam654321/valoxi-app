import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

const isLocalhost = (req: any): boolean => {
  const ip = req.ip || req.socket?.remoteAddress || '';
  return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
};

export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  skip: isLocalhost,
  keyGenerator: (req) => {
    const userId = (req.session as any)?.userId;
    return userId ? `user-${userId}` : ipKeyGenerator(req.ip ?? '0.0.0.0');
  },
  message: { message: 'Too many requests, please try again later.' },
});


export const portalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  skip: isLocalhost,
  message: { message: 'Too many requests to the portal, please try again later.' },
});

export const analysisTriggerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  skip: (req) => req.method === 'GET',
  keyGenerator: (req) => {
    const userId = (req.session as any)?.userId;
    return userId ? `user-${userId}` : ipKeyGenerator(req.ip ?? '0.0.0.0');
  },
  message: { message: 'Too many analysis requests, please try again later.' },
});

export const explainLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  keyGenerator: (req) => {
    const userId = (req.session as any)?.userId;
    return userId ? `user-${userId}` : ipKeyGenerator(req.ip ?? '0.0.0.0');
  },
  message: { message: 'Too many explanation requests, please try again later.' },
});

export const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  keyGenerator: (req) => {
    const userId = (req.session as any)?.userId;
    return userId ? `user-${userId}` : ipKeyGenerator(req.ip ?? '0.0.0.0');
  },
  message: { message: 'Too many uploads, please try again later.' },
});

export const waitlistLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  skip: isLocalhost,
  message: { message: 'Too many waitlist submissions, please try again later.' },
});
