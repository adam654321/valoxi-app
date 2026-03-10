function getBaseUrl(): string {
  if (process.env.REPLIT_DEV_DOMAIN) {
    return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  }
  if (process.env.REPL_SLUG && process.env.REPL_OWNER) {
    return `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`;
  }
  return 'http://localhost:5000';
}

export const config = {
  baseUrl: getBaseUrl(),
  
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

  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY || '',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
    partnerCustomer5d: process.env.STRIPE_PARTNER_CUSTOMER_5D || '',
    partnerPrice5d: process.env.STRIPE_PARTNER_PRICE_5D || '',
  },

  geminiPricing: {
    'gemini-3-flash-preview': { inputCostPerMillionTokens: 0.50, outputCostPerMillionTokens: 3.00 },
    'gemini-3-pro-preview': { inputCostPerMillionTokens: 1.25, outputCostPerMillionTokens: 10.00 },
    'gemini-2.0-flash': { inputCostPerMillionTokens: 0.50, outputCostPerMillionTokens: 3.00 },
    'default': { inputCostPerMillionTokens: 0.50, outputCostPerMillionTokens: 3.00 },
  } as Record<string, { inputCostPerMillionTokens: number; outputCostPerMillionTokens: number }>,
} as const;

export type Config = typeof config;
