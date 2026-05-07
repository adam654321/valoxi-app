import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { nylasService, NylasServiceNotConfiguredError, NylasGrantBrokenError } from '../services/nylas.service';
import { nylasRepository } from '../repositories/nylas.repository';
import { signNylasState, verifyNylasState } from '../lib/nylas-state-token';

// ── Unauthenticated callback router (mounted without isAuthenticated) ────────
export const nylasCallbackRouter = Router();

// GET /api/v2/nylas/auth/callback
// Called by the OAuth provider redirecting the user's browser back.
// Identity verified via signed state JWT — no session auth required.
nylasCallbackRouter.get('/auth/callback', async (req: Request, res: Response) => {
  const { code, state, error } = req.query as Record<string, string | undefined>;

  if (error) {
    console.error('[NYLAS] OAuth error from provider:', error);
    return res.redirect(`/account?nylas_error=${encodeURIComponent(error)}`);
  }

  if (!code || !state) {
    return res.status(400).json({ success: false, error: 'Missing code or state parameter' });
  }

  let claims: ReturnType<typeof verifyNylasState>;
  try {
    claims = verifyNylasState(state);
  } catch (err: any) {
    console.error('[NYLAS] State token verification failed:', err.message);
    return res.redirect(`/account?nylas_error=invalid_state`);
  }

  try {
    const result = await nylasService.exchangeCodeForGrant(code, claims.provider);

    const existing = await nylasRepository.getGrantByGrantId(result.grantId);
    if (existing) {
      await nylasRepository.markActive(result.grantId);
      console.log(`[NYLAS] Re-auth for existing grant ${result.grantId} (user ${claims.userId}, set back to active)`);
    } else {
      await nylasRepository.createGrant({
        userId: claims.userId,
        userCompanyId: claims.userCompanyId,
        grantId: result.grantId,
        email: result.email,
        provider: result.provider,
        scopes: result.scope,
      });
      console.log(`[NYLAS] Grant created for user ${claims.userId} (${result.email}, ${result.provider})`);
    }

    return res.redirect(`/account?nylas_connected=1`);
  } catch (err: any) {
    console.error('[NYLAS] Code exchange or grant creation failed:', err.message);
    return res.redirect(`/account?nylas_error=exchange_failed`);
  }
});

// ── Authenticated router (mounted with isAuthenticated, validateCsrfToken) ──
const router = Router();

// POST /api/v2/nylas/auth/initiate
// Body: { provider: 'google' | 'microsoft' }
// Returns: { authUrl: string }
const initiateBodySchema = z.object({
  provider: z.enum(['google', 'microsoft']),
});

const sendBodySchema = z.object({
  grantId: z.number().int().positive(),
  subject: z.string().min(1).max(998),
  to: z.array(z.object({
    email: z.string().email(),
    name: z.string().optional(),
  })).min(1),
  body: z.string().min(1),
  cc: z.array(z.object({
    email: z.string().email(),
    name: z.string().optional(),
  })).optional(),
  bcc: z.array(z.object({
    email: z.string().email(),
    name: z.string().optional(),
  })).optional(),
  replyTo: z.array(z.object({
    email: z.string().email(),
    name: z.string().optional(),
  })).optional(),
  isPlainText: z.boolean().optional(),
});

router.post('/auth/initiate', async (req: Request, res: Response) => {
  try {
    const { provider } = initiateBodySchema.parse(req.body);

    const userId = req.session.userId;
    const userCompanyId = req.session.userCompanyId;
    if (!userId || !userCompanyId) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const stateToken = signNylasState({ userId, userCompanyId, provider });
    const authUrl = await nylasService.getAuthUrl(provider, stateToken);

    return res.json({ success: true, data: { authUrl } });
  } catch (err) {
    if (err instanceof NylasServiceNotConfiguredError) {
      return res.status(503).json({ success: false, error: err.message });
    }
    if (err instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Invalid request body', details: err.errors });
    }
    console.error('[NYLAS] auth/initiate failed:', err);
    return res.status(500).json({ success: false, error: 'Failed to start OAuth flow' });
  }
});

// GET /api/v2/nylas/grants
router.get('/grants', async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const includeRevoked = req.query.includeRevoked === 'true';
    const grants = await nylasRepository.getGrantsForUser(userId, { includeRevoked });

    return res.json({
      success: true,
      data: grants.map(g => ({
        id: g.id,
        email: g.email,
        provider: g.provider,
        status: g.status,
        scopes: g.scopes,
        lastUsedAt: g.lastUsedAt,
        lastErrorAt: g.lastErrorAt,
        lastErrorMessage: g.lastErrorMessage,
        createdAt: g.createdAt,
      })),
    });
  } catch (err) {
    console.error('[NYLAS] GET /grants failed:', err);
    return res.status(500).json({ success: false, error: 'Failed to list grants' });
  }
});

// DELETE /api/v2/nylas/grants/:id
router.delete('/grants/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const grantRowId = parseInt(req.params.id, 10);
    if (isNaN(grantRowId)) {
      return res.status(400).json({ success: false, error: 'Invalid grant id' });
    }

    const grant = await nylasRepository.getGrantById(grantRowId);
    if (!grant) {
      return res.status(404).json({ success: false, error: 'Grant not found' });
    }

    if (grant.userId !== userId) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    await nylasService.revokeGrant(grant.grantId);
    await nylasRepository.markRevoked(grant.grantId);

    return res.json({ success: true, data: { id: grant.id, status: 'revoked' } });
  } catch (err) {
    console.error('[NYLAS] DELETE /grants failed:', err);
    return res.status(500).json({ success: false, error: 'Failed to revoke grant' });
  }
});

// POST /api/v2/nylas/send
router.post('/send', async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const parsed = sendBodySchema.parse(req.body);

    const grant = await nylasRepository.getGrantById(parsed.grantId);
    if (!grant) {
      return res.status(404).json({ success: false, error: 'Grant not found' });
    }

    if (grant.userId !== userId) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    if (grant.status !== 'active') {
      return res.status(409).json({
        success: false,
        error: `Grant is ${grant.status} — reconnect required`,
      });
    }

    const result = await nylasService.sendEmail(grant.grantId, {
      subject: parsed.subject,
      to: parsed.to,
      body: parsed.body,
      cc: parsed.cc,
      bcc: parsed.bcc,
      replyTo: parsed.replyTo,
      isPlainText: parsed.isPlainText,
    });

    await nylasRepository.bumpLastUsed(grant.grantId);

    return res.json({
      success: true,
      data: { messageId: result.messageId, threadId: result.threadId },
    });
  } catch (err) {
    if (err instanceof NylasGrantBrokenError) {
      await nylasRepository.markBroken(err.grantId, err.message);
      return res.status(409).json({
        success: false,
        error: 'Grant is no longer valid — reconnect required',
      });
    }
    if (err instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request body',
        details: err.errors,
      });
    }
    console.error('[NYLAS] POST /send failed:', err);
    return res.status(500).json({ success: false, error: 'Failed to send email' });
  }
});

export default router;
