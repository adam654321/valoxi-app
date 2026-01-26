import { Express } from 'express';
import pipelineRoutes from './pipeline.routes';
import rolesRoutes from './roles.routes';
import contactsRoutes from './contacts.routes';
import activitiesRoutes from './activities.routes';
import notificationsRoutes from './notifications.routes';
import documentsRoutes from './documents.routes';
import targetCompaniesRoutes from './target-companies.routes';
import authRoutes from './auth.routes';

export function registerModularRoutes(app: Express, isAuthenticated: any) {
  app.use('/api/v2/pipeline', isAuthenticated, pipelineRoutes);
  app.use('/api/v2/roles', isAuthenticated, rolesRoutes);
  app.use('/api/v2/contacts', isAuthenticated, contactsRoutes);
  app.use('/api/v2/activities', isAuthenticated, activitiesRoutes);
  app.use('/api/v2/notifications', isAuthenticated, notificationsRoutes);
  app.use('/api/v2/documents', isAuthenticated, documentsRoutes);
  app.use('/api/v2/target-companies', isAuthenticated, targetCompaniesRoutes);
  app.use('/api/v2/auth', authRoutes);
}
