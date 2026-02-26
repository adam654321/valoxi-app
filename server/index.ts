import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { initializeChaseUpCron } from "./cron/chase-up.cron";
import { sendError } from "./utils/response";

process.on('SIGHUP', () => {
  console.log('[PROCESS] SIGHUP received — ignoring to preserve esbuild');
});

const app = express();
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
    initializeChaseUpCron();
    try {
      const { analysisQueue } = await import('./services/analysis-queue.service');
      await analysisQueue.recoverStuckEvents();
    } catch (err) {
      console.error('[STARTUP] Analysis queue recovery failed:', err);
    }

    if (app.get("env") === "development") {
      const lazyPages = [
        '/src/pages/auth/register.tsx',
        '/src/pages/auth/forgot-password.tsx',
        '/src/pages/auth/reset-password.tsx',
        '/src/pages/dashboard.tsx',
        '/src/pages/enhanced-target-companies.tsx',
        '/src/pages/target-company-detail.tsx',
        '/src/pages/contacts.tsx',
        '/src/pages/team-management.tsx',
        '/src/pages/pipeline.tsx',
        '/src/pages/reports.tsx',
        '/src/components/notifications.tsx',
        '/src/pages/PortalPage.tsx',
        '/src/pages/PortalManagement.tsx',
        '/src/pages/company-accounts.tsx',
        '/src/pages/EmailTest.tsx',
        '/src/pages/webhook-test.tsx',
        '/src/pages/file-upload-test.tsx',
        '/src/pages/admin/index.tsx',
        '/src/pages/admin/token-usage.tsx',
        '/src/pages/admin/costs.tsx',
        '/src/pages/admin/companies.tsx',
        '/src/pages/admin/companies/[id].tsx',
        '/src/pages/admin/users.tsx',
        '/src/pages/admin/webhook-events.tsx',
      ];
      log(`Pre-warming ${lazyPages.length} lazy-loaded pages...`);
      const warmupStart = Date.now();
      await Promise.allSettled(
        lazyPages.map(page =>
          fetch(`http://127.0.0.1:${port}${page}`).catch(() => {})
        )
      );
      log(`Pre-warming complete in ${Date.now() - warmupStart}ms — all pages compiled by esbuild`);
    }
  });
})();
