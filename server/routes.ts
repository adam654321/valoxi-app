import type { Express } from "express";
import { createServer, type Server } from "http";
import { createSessionMiddleware } from "./middleware/session";
import { isAuthenticated } from "./middleware/auth";
import { registerModularRoutes } from "./routes/index";

export async function registerRoutes(app: Express): Promise<Server> {
  app.use(createSessionMiddleware());
  registerModularRoutes(app, isAuthenticated);

  const httpServer = createServer(app);
  return httpServer;
}
