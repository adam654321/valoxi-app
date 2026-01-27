import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import session from "express-session";
import connectPg from "connect-pg-simple";
import multer from "multer";
import path from "path";
import fs from "fs/promises";

import { registerModularRoutes } from "./routes/index";

import { 
  checkStage1RequirementsByCategory, 
  checkAndTriggerStage1Analysis,
  runGeminiDetailedAnalysis,
  sendStage1AnalysisWebhook,
  sendDetailedAnalysisWebhook,
  sendFileUploadWebhook 
} from "./services/file-analysis.service";

declare module 'express-session' {
  interface SessionData {
    userId?: number;
    userCompanyId?: number;
  }
}

const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
const pgStore = connectPg(session);

export async function registerRoutes(app: Express): Promise<Server> {
  app.use(session({
    store: new pgStore({
      conString: process.env.DATABASE_URL,
      createTableIfMissing: true,
      ttl: sessionTtl / 1000,
    }),
    secret: process.env.SESSION_SECRET || 'your-session-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: sessionTtl,
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
    },
  }));

  const isAuthenticated = async (req: Request, res: Response, next: any) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    next();
  };

  registerModularRoutes(app, isAuthenticated);

  app.get("/api/public/documents/:id/download", async (req: Request, res: Response) => {
    try {
      const documentId = parseInt(req.params.id);
      if (isNaN(documentId)) {
        return res.status(400).json({ error: 'Invalid document ID' });
      }
      const document = await storage.getDocumentByIdPublic(documentId);
      if (!document) {
        return res.status(404).json({ error: 'Document not found' });
      }
      res.setHeader('Content-Disposition', `attachment; filename="${document.originalFilename}"`);
      res.setHeader('Content-Type', document.fileType || 'application/octet-stream');
      res.sendFile(path.resolve(document.filePath));
    } catch (error) {
      console.error('[PUBLIC_DOWNLOAD] Error:', error);
      res.status(500).json({ error: 'Failed to download document' });
    }
  });

  app.get("/api/target-companies/:id/profile", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userCompanyId = req.session.userCompanyId;
      const targetCompanyId = parseInt(req.params.id);
      const userId = req.session.userId!;
      
      if (!userCompanyId) {
        return res.status(400).json({ message: "User company not found" });
      }

      if (isNaN(targetCompanyId)) {
        return res.status(400).json({ message: "Invalid target company ID" });
      }

      const profile = await storage.getCompanyProfile(targetCompanyId, userCompanyId, userId);
      
      if (!profile) {
        return res.status(404).json({ message: "Target company not found" });
      }

      if (profile.websiteAnalysis) {
        console.log(`Website analysis found for company ${targetCompanyId}:`, {
          analysisLength: profile.websiteAnalysis?.length,
          processedAt: profile.websiteAnalysisProcessedAt
        });
      }

      res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });

      res.json(profile);
    } catch (error) {
      console.error("Get company profile error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  const uploadStorage = multer.diskStorage({
    destination: async (req, file, cb) => {
      const companyId = req.params.id;
      
      if (!companyId) {
        return cb(new Error('Company ID is required for file upload'), '');
      }
      
      const uploadPath = path.join(process.cwd(), 'uploads', 'companies', companyId);
      
      try {
        await fs.mkdir(uploadPath, { recursive: true });
        cb(null, uploadPath);
      } catch (error) {
        cb(error as Error, '');
      }
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const extension = path.extname(file.originalname);
      cb(null, `doc-${uniqueSuffix}${extension}`);
    }
  });

  const fileFilter = (req: any, file: any, cb: any) => {
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain',
      'image/jpeg',
      'image/png'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('File type not supported'), false);
    }
  };

  const upload = multer({
    storage: uploadStorage,
    fileFilter: fileFilter,
    limits: {
      fileSize: 10 * 1024 * 1024
    }
  });

  app.get("/api/target-companies/:id/stage1-analysis", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const targetCompanyId = parseInt(req.params.id);
      const userCompanyId = req.session.userCompanyId!;

      const company = await storage.getTargetCompany(targetCompanyId, userCompanyId);
      if (!company) {
        return res.status(404).json({ error: 'Company not found' });
      }

      const events = await storage.getStage1AnalysisEventsByCompany(targetCompanyId, userCompanyId);
      
      res.json(events);
    } catch (error) {
      console.error('Error fetching Stage 1 analysis events:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get("/api/target-companies/:id/stage1-status", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const targetCompanyId = parseInt(req.params.id);
      const userCompanyId = req.session.userCompanyId!;

      const company = await storage.getTargetCompany(targetCompanyId, userCompanyId);
      if (!company) {
        return res.status(404).json({ error: 'Company not found' });
      }

      const categoryCheck = await checkStage1RequirementsByCategory(targetCompanyId);
      
      const existingEvent = await storage.getLatestStage1AnalysisEvent(targetCompanyId);
      
      res.json({
        shouldTrigger: categoryCheck.shouldTrigger,
        status: categoryCheck.status,
        hasExistingAnalysis: existingEvent?.webhookStatus === 'success',
        existingEventId: existingEvent?.id || null,
        lastAnalysisDate: existingEvent?.createdAt || null
      });
    } catch (error) {
      console.error('Error checking Stage 1 status:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post("/api/target-companies/:id/trigger-stage1", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const targetCompanyId = parseInt(req.params.id);
      const userCompanyId = req.session.userCompanyId!;
      const userId = req.session.userId!;

      const company = await storage.getTargetCompany(targetCompanyId, userCompanyId);
      if (!company) {
        return res.status(404).json({ error: 'Company not found' });
      }

      console.log(`[MANUAL_TRIGGER] Checking Stage 1 analysis for company ${targetCompanyId} (bypassing requirements)`);
      await checkAndTriggerStage1Analysis(targetCompanyId, userId, true);
      
      res.json({ success: true, message: 'Stage 1 analysis triggered with available documents (bypassed requirements)' });
    } catch (error) {
      console.error('Error triggering Stage 1 analysis:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post("/api/target-companies/:id/trigger-detailed-analysis", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const targetCompanyId = parseInt(req.params.id);
      const userCompanyId = req.session.userCompanyId!;
      const userId = req.session.userId!;

      const company = await storage.getTargetCompany(targetCompanyId, userCompanyId);
      if (!company) {
        return res.status(404).json({ error: 'Company not found' });
      }

      const latestEvent = await storage.getLatestStage1AnalysisEvent(targetCompanyId);
      if (!latestEvent) {
        return res.status(400).json({ error: 'No basic analysis found. Please complete basic analysis first.' });
      }

      if (latestEvent.webhookStatus !== 'success') {
        return res.status(400).json({ error: 'Basic analysis is not complete. Please wait for it to finish.' });
      }

      if (latestEvent.detailedAnalysisStatus === 'processing') {
        return res.status(400).json({ error: 'Detailed analysis is already in progress.' });
      }

      await storage.updateDetailedAnalysisStatus(latestEvent.id, 'processing', undefined, undefined, undefined, userId);

      console.log(`[DETAILED_ANALYSIS] Triggering detailed analysis for company ${targetCompanyId}, event ${latestEvent.id}`);
      
      setTimeout(() => {
        runGeminiDetailedAnalysis(latestEvent.id, targetCompanyId);
      }, 100);
      
      res.json({ 
        success: true, 
        message: 'Detailed analysis started',
        eventId: latestEvent.id
      });
    } catch (error) {
      console.error('Error triggering detailed analysis:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.delete("/api/documents/clear-all", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userCompanyId = req.session.userCompanyId!;
      const userId = req.session.userId!;
      
      console.log(`[API] Clearing all documents for user company ${userCompanyId}, requested by user ${userId}`);
      
      const result = await storage.clearAllCompanyDocuments(userCompanyId);
      
      console.log(`[API] Document clearing completed:`, result);
      
      res.json({
        success: true,
        message: 'All company documents have been cleared successfully',
        details: result
      });
    } catch (error) {
      console.error("Clear all documents error:", error);
      res.status(500).json({ 
        message: "Internal server error",
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.get("/api/user/companies", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      
      const companies = await storage.getUserCompanies(userId);
      
      const companiesWithDetails = await Promise.all(
        companies.map(async (membership) => {
          const company = await storage.getUserCompany(membership.userCompanyId);
          return {
            id: membership.id,
            companyId: membership.userCompanyId,
            companyName: company?.companyName || 'Unknown Company',
            email: company?.email,
            phone: company?.phone,
            address: company?.address,
            isAdmin: membership.isCompanyAdmin,
            role: membership.membershipRole,
            joinedAt: membership.joinedAt,
            isActive: membership.isActive,
            isCurrent: membership.userCompanyId === req.session.userCompanyId
          };
        })
      );
      
      res.json(companiesWithDetails);
    } catch (error) {
      console.error("Failed to get user companies:", error);
      res.status(500).json({ error: "Failed to get user companies" });
    }
  });

  app.post("/api/user/companies", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const { companyName, email, phone, address } = req.body;
      
      const existingCompanies = await storage.getUserCompanies(userId);
      if (existingCompanies.length >= 5) {
        return res.status(400).json({ error: "Maximum of 5 companies allowed per user" });
      }
      
      const newCompany = await storage.createUserCompany({
        companyName,
        email: email || null,
        phone: phone || null,
        address: address || null
      });
      
      const membership = await storage.createUserCompanyMembership({
        userId,
        userCompanyId: newCompany.id,
        isCompanyAdmin: true,
        membershipRole: 'admin',
        isActive: true
      });
      
      if (existingCompanies.length === 0) {
        await storage.switchUserActiveCompany(userId, newCompany.id);
      }
      
      res.json({
        id: membership.id,
        companyId: newCompany.id,
        companyName: newCompany.companyName,
        email: newCompany.email,
        phone: newCompany.phone,
        address: newCompany.address,
        isAdmin: true,
        role: 'admin',
        joinedAt: membership.joinedAt,
        isActive: true,
        isCurrent: existingCompanies.length === 0
      });
    } catch (error) {
      console.error("Failed to create company:", error);
      res.status(500).json({ error: "Failed to create company" });
    }
  });

  app.post("/api/user/companies/:companyId/switch", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const companyId = parseInt(req.params.companyId);
      
      const companies = await storage.getUserCompanies(userId);
      const hasAccess = companies.some(c => c.userCompanyId === companyId && c.isActive);
      
      if (!hasAccess) {
        return res.status(403).json({ error: "Access denied to this company" });
      }
      
      await storage.switchUserActiveCompany(userId, companyId);
      
      req.session.userCompanyId = companyId;
      
      res.json({ success: true, currentCompanyId: companyId });
    } catch (error) {
      console.error("Failed to switch company:", error);
      res.status(500).json({ error: "Failed to switch company" });
    }
  });

  app.post("/api/test/stage1-webhook/:eventId", async (req: Request, res: Response) => {
    try {
      const eventId = parseInt(req.params.eventId);
      
      if (isNaN(eventId)) {
        return res.status(400).json({ message: "Invalid event ID" });
      }

      console.log(`[TEST] Manually triggering Stage 1 webhook for event ${eventId}`);
      
      setTimeout(() => {
        sendStage1AnalysisWebhook(eventId);
      }, 100);

      res.json({ 
        success: true, 
        message: `Stage 1 webhook triggered for event ${eventId}` 
      });
    } catch (error) {
      console.error("Manual webhook trigger error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/test/detailed-analysis-webhook/:eventId", async (req: Request, res: Response) => {
    try {
      const eventId = parseInt(req.params.eventId);
      
      if (isNaN(eventId)) {
        return res.status(400).json({ message: "Invalid event ID" });
      }

      console.log(`[TEST] Manually triggering Detailed Analysis webhook ONLY for event ${eventId}`);
      
      setTimeout(() => {
        sendDetailedAnalysisWebhook(eventId);
      }, 100);

      res.json({ 
        success: true, 
        message: `Detailed Analysis webhook triggered for event ${eventId}`
      });
    } catch (error) {
      console.error("Failed to trigger Detailed Analysis webhook:", error);
      res.status(500).json({ error: "Failed to trigger webhook" });
    }
  });

  app.post("/api/test/fresh-stage1-analysis/:companyId", async (req: Request, res: Response) => {
    try {
      const companyId = parseInt(req.params.companyId);
      
      if (isNaN(companyId)) {
        return res.status(400).json({ message: "Invalid company ID" });
      }

      console.log(`[TEST] Manually triggering fresh Stage 1 analysis for company ${companyId}`);
      
      setTimeout(() => {
        checkAndTriggerStage1Analysis(companyId, 1);
      }, 100);

      res.json({ 
        success: true, 
        message: `Fresh Stage 1 analysis triggered for company ${companyId}` 
      });
    } catch (error) {
      console.error("Manual fresh analysis trigger error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/test/inject-detailed-analysis/:eventId", async (req: Request, res: Response) => {
    try {
      const eventId = parseInt(req.params.eventId);
      const detailedData = req.body;
      
      if (isNaN(eventId)) {
        return res.status(400).json({ message: "Invalid event ID" });
      }

      if (!detailedData) {
        return res.status(400).json({ message: "No data provided" });
      }

      console.log(`[TEST] Injecting detailed analysis data for event ${eventId}`);
      
      await storage.updateStage1AnalysisEventDetailedData(eventId, detailedData);
      
      console.log(`[TEST] Successfully stored detailed analysis data for event ${eventId}`);
      
      res.json({ 
        success: true, 
        message: `Detailed analysis data injected for event ${eventId}` 
      });
    } catch (error) {
      console.error("Failed to inject detailed analysis data:", error);
      res.status(500).json({ message: "Internal server error", error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

export { sendFileUploadWebhook };
