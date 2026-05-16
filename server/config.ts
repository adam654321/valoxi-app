function getBaseUrl(): string {
  if (process.env.APP_URL) {
    return process.env.APP_URL;
  }
  if (process.env.REPLIT_DOMAINS) {
    return `https://${process.env.REPLIT_DOMAINS.split(',')[0]}`;
  }
  if (process.env.REPLIT_DEV_DOMAIN) {
    return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  }
  return 'https://app.valoxi.ai';
}

export const config = {
  baseUrl: getBaseUrl(),
  openAccessEnabled: process.env.OPEN_ACCESS_ENABLED === 'true',

  server: {
    port: parseInt(process.env.PORT || '5000', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    isDevelopment: process.env.NODE_ENV !== 'production',
    isProduction: process.env.NODE_ENV === 'production',
  },

  gemini: {
    apiKey: process.env.GOOGLE_GEMINI_API_KEY || '',
    model: 'gemini-3-flash-preview',
  },

  smtp: {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    fromEmail: process.env.SMTP_FROM_EMAIL || '',
    alertEmail: process.env.SMTP_ALERT_EMAIL || '',
    secure: process.env.SMTP_SECURE === 'true',
  },

  replit: {
    devDomain: process.env.REPLIT_DEV_DOMAIN || '',
    replSlug: process.env.REPL_SLUG || '',
    replOwner: process.env.REPL_OWNER || '',
    replId: process.env.REPL_ID || '',
  },

  database: {
    url: process.env.DATABASE_URL || '',
  },

  session: {
    secret: process.env.SESSION_SECRET || '',
  },

  issueReportRecipient: process.env.ISSUE_REPORT_RECIPIENT || 'support@valoxi.ai',

  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY || '',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
  },

  nylas: {
    apiKey: process.env.NYLAS_API_KEY || '',
    clientId: process.env.NYLAS_CLIENT_ID || '',
    apiUri: process.env.NYLAS_API_URI || 'https://api.us.nylas.com',
    redirectUri: process.env.NYLAS_REDIRECT_URI || '',
    stateSecret: process.env.NYLAS_STATE_SECRET || '',
  },

  geminiPricing: {
    'gemini-3-flash-preview': { inputCostPerMillionTokens: 0.50, outputCostPerMillionTokens: 3.00 },
    'gemini-3-pro-preview': { inputCostPerMillionTokens: 1.25, outputCostPerMillionTokens: 10.00 },
    'gemini-2.0-flash': { inputCostPerMillionTokens: 0.50, outputCostPerMillionTokens: 3.00 },
    'default': { inputCostPerMillionTokens: 0.50, outputCostPerMillionTokens: 3.00 },
  } as Record<string, { inputCostPerMillionTokens: number; outputCostPerMillionTokens: number }>,
} as const;

export type Config = typeof config;
