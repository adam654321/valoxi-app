import { Express } from 'express';
import pipelineRoutes from './pipeline.routes';

export function registerModularRoutes(app: Express, isAuthenticated: any) {
  app.use('/api/v2/pipeline', isAuthenticated, pipelineRoutes);
}
