import Nylas from 'nylas';
import { config } from '../config';

type Provider = 'google' | 'microsoft';

/**
 * IMPLEMENTATION NOTES (do not lose these in subsequent builds):
 * 1. redirect_uri must be EXACT-MATCH against what is registered
 *    on the Nylas application. No wildcards, no path variants.
 * 2. The auth URL must NOT include `prompt=consent` — Nylas v3
 *    rejects it with 400 / Unsupported value. Omit the param
 *    unless using Nylas-specific values (select_provider, detect).
 * 3. For Google, scope strings for email/profile MUST be full
 *    URLs. Only `openid` is permitted bare. The verified scope
 *    string for send is:
 *      https://www.googleapis.com/auth/gmail.send openid https://www.googleapis.com/auth/userinfo.email
 * 4. The /v3/connect/token exchange uses NYLAS_API_KEY as the
 *    client_secret value. There is no separate client_secret
 *    env var.
 */

export class NylasServiceNotConfiguredError extends Error {
  constructor() {
    super('Nylas service is not configured. Set NYLAS_API_KEY, NYLAS_CLIENT_ID, NYLAS_REDIRECT_URI environment variables.');
    this.name = 'NylasServiceNotConfiguredError';
  }
}

export class NylasGrantBrokenError extends Error {
  constructor(
    message: string,
    public readonly grantId: string,
    public readonly upstreamStatus: number,
  ) {
    super(message);
    this.name = 'NylasGrantBrokenError';
  }
}

class NylasService {
  private client: Nylas | null = null;

  private getClient(): Nylas {
    if (!config.nylas.apiKey || !config.nylas.clientId || !config.nylas.redirectUri) {
      throw new NylasServiceNotConfiguredError();
    }
    if (!this.client) {
      this.client = new Nylas({
        apiKey: config.nylas.apiKey,
        apiUri: config.nylas.apiUri,
      });
    }
    return this.client;
  }

  isConfigured(): boolean {
    return !!(config.nylas.apiKey && config.nylas.clientId && config.nylas.redirectUri);
  }

  // Build 2 will fill these in:
  async getAuthUrl(_provider: Provider, _stateToken: string): Promise<string> {
    throw new Error('Not implemented — Build 2');
  }

  async exchangeCodeForGrant(_code: string): Promise<{
    grantId: string;
    email: string;
    provider: Provider;
    scope: string[];
  }> {
    throw new Error('Not implemented — Build 2');
  }

  // Build 3 will fill these in:
  async sendEmail(_grantId: string, _payload: {
    subject: string;
    to: { email: string; name?: string }[];
    body: string;
    cc?: { email: string; name?: string }[];
    bcc?: { email: string; name?: string }[];
    replyTo?: { email: string; name?: string }[];
    isPlainText?: boolean;
  }): Promise<{ messageId: string; threadId: string | null }> {
    throw new Error('Not implemented — Build 3');
  }

  async revokeGrant(_grantId: string): Promise<void> {
    throw new Error('Not implemented — Build 3');
  }
}

export const nylasService = new NylasService();
