import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { initializeChaseUpCron } from "./cron/chase-up.cron";
import { initializeBillingCron } from "./cron/billing.cron";
import { initializeBackupCron } from "./cron/backup.cron";
import { sendError } from "./utils/response";
import { config } from "./config";

process.on('SIGHUP', () => {
  console.log('[PROCESS] SIGHUP received — ignoring to preserve esbuild');
});

const app = express();
app.use('/api/v2/billing/webhook/stripe', express.raw({ type: 'application/json' }));
app.use('/api/v2/webhooks/clerk', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    sendError(res, err);
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, async () => {
    log(`serving on port ${port}`);
    if (!process.env.STRIPE_SECRET_KEY) {
      console.warn('[billing] WARNING: STRIPE_SECRET_KEY not set — billing features will not work');
    }
    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      console.warn('[billing] WARNING: STRIPE_WEBHOOK_SECRET not set — webhooks will not be verified');
    }
    if (config.nylas.apiKey && config.nylas.clientId && config.nylas.redirectUri) {
      log('[NYLAS] configured — OAuth and email send enabled');
    } else {
      console.warn('[NYLAS] WARNING: NYLAS_API_KEY, NYLAS_CLIENT_ID or NYLAS_REDIRECT_URI not set — OAuth and email send disabled');
    }
    initializeChaseUpCron();
    initializeBillingCron();
    initializeBackupCron();
    try {
      const { analysisQueue } = await import('./services/analysis-queue.service');
      await analysisQueue.recoverStuckEvents();
    } catch (err) {
      console.error('[STARTUP] Analysis queue recovery failed:', err);
    }

    try {
      const { db } = await import('./db');
      const { dealDocumentTemplates } = await import('@shared/schema/deal-documents');
      const { ddCategories } = await import('@shared/schema/due-diligence');
      const { count } = await import('drizzle-orm');

      const [templateCount] = await db.select({ count: count() }).from(dealDocumentTemplates);
      if (templateCount.count === 0) {
        log('Seeding deal document templates...');
        const { seedTemplates } = await import('./scripts/seed-deal-document-templates');
        await seedTemplates();
      }

      const [ddCount] = await db.select({ count: count() }).from(ddCategories);
      if (ddCount.count === 0) {
        log('Seeding DD requirements...');
        const { seedDdRequirements } = await import('./scripts/seed-dd-requirements');
        await seedDdRequirements();
      }
    } catch (err) {
      console.error('[STARTUP] Seed check failed:', err);
    }

    try {
      const { seedUserRoles } = await import('./scripts/seed-user-roles');
      await seedUserRoles();
    } catch (err) {
      console.error('[STARTUP] User roles seed failed:', err);
    }
  });
})();
