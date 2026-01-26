import { Express } from 'express';
import pipelineRoutes from './pipeline.routes';
import rolesRoutes from './roles.routes';

export function registerModularRoutes(app: Express, isAuthenticated: any) {
  app.use('/api/v2/pipeline', isAuthenticated, pipelineRoutes);
  app.use('/api/v2/roles', isAuthenticated, rolesRoutes);
}
