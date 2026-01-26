import { Express } from 'express';
import pipelineRoutes from './pipeline.routes';
import rolesRoutes from './roles.routes';
import contactsRoutes from './contacts.routes';
import activitiesRoutes from './activities.routes';
import notificationsRoutes from './notifications.routes';
import documentsRoutes from './documents.routes';
import targetCompaniesRoutes from './target-companies.routes';
import authRoutes from './auth.routes';
import notesRoutes from './notes.routes';
import dashboardRoutes from './dashboard.routes';
import teamRoutes from './team.routes';
import assignmentsRoutes from './assignments.routes';
import reportsRoutes from './reports.routes';
import portalRoutes from './portal.routes';
import documentsFilesRoutes, { publicDocumentRoutes } from './documents-files.routes';

export function registerModularRoutes(app: Express, isAuthenticated: any) {
  app.use('/api/v2/pipeline', isAuthenticated, pipelineRoutes);
  app.use('/api/v2/roles', isAuthenticated, rolesRoutes);
  app.use('/api/v2/contacts', isAuthenticated, contactsRoutes);
  app.use('/api/v2/activities', isAuthenticated, activitiesRoutes);
  app.use('/api/v2/notifications', isAuthenticated, notificationsRoutes);
  app.use('/api/v2/documents', isAuthenticated, documentsRoutes);
  app.use('/api/v2/target-companies', isAuthenticated, targetCompaniesRoutes);
  app.use('/api/v2/auth', authRoutes);
  app.use('/api/v2/notes', isAuthenticated, notesRoutes);
  app.use('/api/v2/dashboard', isAuthenticated, dashboardRoutes);
  app.use('/api/v2/team', teamRoutes);
  app.use('/api/v2/deals', isAuthenticated, assignmentsRoutes);
  app.use('/api/v2/reports', isAuthenticated, reportsRoutes);
  app.use('/api/v2/portal', portalRoutes);
  app.use('/api/v2/files', isAuthenticated, documentsFilesRoutes);
  app.use('/api/v2/public/documents', publicDocumentRoutes);
}
