import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { nylasService, NylasServiceNotConfiguredError } from '../services/nylas.service';
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
    return res.redirect(`/?nylas_error=${encodeURIComponent(error)}`);
  }

  if (!code || !state) {
    return res.status(400).json({ success: false, error: 'Missing code or state parameter' });
  }

  let claims: ReturnType<typeof verifyNylasState>;
  try {
    claims = verifyNylasState(state);
  } catch (err: any) {
    console.error('[NYLAS] State token verification failed:', err.message);
    return res.redirect(`/?nylas_error=invalid_state`);
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

    return res.redirect(`/?nylas_connected=1`);
  } catch (err: any) {
    console.error('[NYLAS] Code exchange or grant creation failed:', err.message);
    return res.redirect(`/?nylas_error=exchange_failed`);
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

export default router;
