import type { Express } from "express";
import { createServer, type Server } from "http";
import { createSessionMiddleware } from "./middleware/session";
import { isAuthenticated } from "./middleware/auth";
import { attachCsrfToken, validateCsrfToken } from "./middleware/csrf";
import { registerModularRoutes } from "./routes/index";
import { generalLimiter } from './middleware/rate-limit';

export async function registerRoutes(app: Express): Promise<Server> {
  app.set('trust proxy', 1);
  app.use(createSessionMiddleware());
  app.use(attachCsrfToken);
  app.use('/api/', generalLimiter);
  registerModularRoutes(app, isAuthenticated, validateCsrfToken);

  const httpServer = createServer(app);
  return httpServer;
}
