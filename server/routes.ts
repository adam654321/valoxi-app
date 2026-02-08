import type { Express } from "express";
import { createServer, type Server } from "http";
import { createSessionMiddleware } from "./middleware/session";
import { isAuthenticated } from "./middleware/auth";
import { registerModularRoutes } from "./routes/index";
import { generalLimiter } from './middleware/rate-limit';

export async function registerRoutes(app: Express): Promise<Server> {
  app.set('trust proxy', 1);
  app.use(createSessionMiddleware());
  app.use('/api/', generalLimiter);
  registerModularRoutes(app, isAuthenticated);

  const httpServer = createServer(app);
  return httpServer;
}
