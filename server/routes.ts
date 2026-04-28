import type { Express } from "express";
import { createServer, type Server } from "http";
import { createSessionMiddleware } from "./middleware/session";
import { clerkMiddleware } from '@clerk/express';
import { attachCsrfToken, validateOrigin } from "./middleware/csrf";
import { registerModularRoutes } from "./routes/index";
import { generalLimiter } from './middleware/rate-limit';
import { pool } from "./db";

export async function registerRoutes(app: Express): Promise<Server> {
  app.set('trust proxy', 1);
  app.use(createSessionMiddleware(pool));
  app.use('/api/v2', clerkMiddleware());
  app.use(attachCsrfToken);
  app.use('/api/v2', validateOrigin);
  app.use('/api/', generalLimiter);
  registerModularRoutes(app);

  app.get('/api/document-updates/stream/:companyId', (req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });
    res.write('data: {"type":"connected"}\n\n');
    const keepAlive = setInterval(() => { res.write(':\n\n'); }, 30000);
    req.on('close', () => { clearInterval(keepAlive); });
  });

  const httpServer = createServer(app);
  return httpServer;
}
