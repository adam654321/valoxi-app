import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import bcrypt from "bcrypt";
import session from "express-session";
import { randomUUID } from "crypto";
import { z } from "zod";
import { insertUserSchema, insertUserCompanySchema, insertTargetCompanySchema, insertTargetContactSchema, insertUserInvitationSchema, insertUserDealAssignmentSchema, insertTeamNotificationSchema, insertActivitySchema, insertDocumentSchema } from "@shared/schema";
import connectPg from "connect-pg-simple";
import { emailService } from "./email";
import multer from "multer";
import path from "path";
import fs from "fs/promises";

// Webhook function to send company website data
async function sendWebhook(website: string, targetCompanyId: number, webhookUrl?: string) {
  const webhookUrlToUse = webhookUrl || process.env.WEBHOOK_URL;
  if (!webhookUrlToUse || !website) {
    return;
  }

  try {
    const payload = {
      company_name: website,
      target_company_id: targetCompanyId,
      webhook_response_url: `${process.env.APP_URL || 'http://localhost:3000'}/api/webhook/website-analysis`
    };

    const response = await fetch(webhookUrlToUse, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    console.log(`Webhook sent for website: ${website}, Target ID: ${targetCompanyId}, Status: ${response.status}`);
  } catch (error) {
    console.error('Failed to send webhook:', error);
  }
}

// Extend session type
declare module 'express-session' {
  interface SessionData {
    userId?: number;
    userCompanyId?: number;
  }
}

// Session configuration
const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
const pgStore = connectPg(session);

export async function registerRoutes(app: Express): Promise<Server> {
  // Session middleware
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

  // Auth middleware
  const isAuthenticated = async (req: Request, res: Response, next: any) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    next();
  };

  // Registration schema with password confirmation
  const registerSchema = insertUserSchema.extend({
    companyName: z.string().min(1, "Company name is required"),
    confirmPassword: z.string(),
  }).refine((data) => data.passwordHash === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

  // Login schema
  const loginSchema = z.object({
    email: z.string().email("Invalid email format"),
    password: z.string().min(1, "Password is required"),
  });

  // Registration endpoint
  app.post("/api/auth/register", async (req: Request, res: Response) => {
    try {
      const validatedData = registerSchema.parse(req.body);
      
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(validatedData.email);
      if (existingUser) {
        return res.status(400).json({ message: "User already exists with this email" });
      }

      // Hash password
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(validatedData.passwordHash, saltRounds);

      // Create user company first
      const userCompany = await storage.createUserCompany({
        companyName: validatedData.companyName,
      });

      // Create user
      const user = await storage.createUser({
        email: validatedData.email,
        passwordHash: hashedPassword,
        firstName: validatedData.firstName,
        lastName: validatedData.lastName,
        userCompanyId: userCompany.id,
        role: "user",
      });

      // Create session
      req.session.userId = user.id;
      req.session.userCompanyId = userCompany.id;

      res.status(201).json({
        message: "User created successfully",
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          company: userCompany,
        },
      });
    } catch (error) {
      console.error("Registration error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: error.errors 
        });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Login endpoint
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const { email, password } = loginSchema.parse(req.body);

      // Get user by email
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.passwordHash);
      if (!isValidPassword) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Get user company
      const userCompany = user.userCompanyId 
        ? await storage.getUserCompany(user.userCompanyId)
        : null;

      // Create session
      req.session.userId = user.id;
      req.session.userCompanyId = user.userCompanyId || undefined;

      res.json({
        message: "Login successful",
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          company: userCompany,
        },
      });
    } catch (error) {
      console.error("Login error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: error.errors 
        });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Logout endpoint
  app.post("/api/auth/logout", (req: Request, res: Response) => {
    req.session.destroy((err) => {
      if (err) {
        console.error("Logout error:", err);
        return res.status(500).json({ message: "Could not log out" });
      }
      res.json({ message: "Logged out successfully" });
    });
  });

  // Get current user
  app.get("/api/auth/me", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const userCompany = user.userCompanyId 
        ? await storage.getUserCompany(user.userCompanyId)
        : null;

      res.json({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        company: userCompany,
      });
    } catch (error) {
      console.error("Get user error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Dashboard stats endpoint
  app.get("/api/dashboard/stats", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userCompanyId = req.session.userCompanyId;
      
      if (!userCompanyId) {
        return res.status(400).json({ message: "User company not found" });
      }

      const targetCompanyCount = await storage.getTargetCompanyCount(userCompanyId);
      const totalContactsCount = await storage.getTotalContactsCount(userCompanyId);

      res.json({
        targetCompanies: targetCompanyCount,
        activeDeals: 0, // Placeholder for future implementation
        totalContacts: totalContactsCount,
        dealValue: "0", // Placeholder for future implementation
      });
    } catch (error) {
      console.error("Dashboard stats error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Enhanced Dashboard Widget API Endpoints
  app.get("/api/dashboard/data/:widget", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userCompanyId = req.session.userCompanyId;
      const widgetType = req.params.widget;
      
      if (!userCompanyId) {
        return res.status(400).json({ message: "User company not found" });
      }

      let data;
      switch (widgetType) {
        case 'pipeline-overview':
          data = await storage.getPipelineOverviewWidget(userCompanyId);
          break;
        case 'recent-activities':
          data = await storage.getRecentActivitiesWidget(userCompanyId);
          break;
        case 'hot-deals':
          data = await storage.getHotDealsWidget(userCompanyId);
          break;
        case 'quick-stats':
          data = await storage.getQuickStatsWidget(userCompanyId);
          break;
        case 'upcoming-reminders':
          data = await storage.getUpcomingRemindersWidget(req.session.userId!);
          break;
        case 'team-activity':
          data = await storage.getTeamActivityWidget(userCompanyId);
          break;
        case 'stage-alerts':
          data = await storage.getStageAlertsWidget(userCompanyId);
          break;
        default:
          return res.status(400).json({ message: "Invalid widget type" });
      }

      res.json(data);
    } catch (error) {
      console.error(`Dashboard widget ${req.params.widget} error:`, error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Dashboard preferences endpoints
  app.get("/api/dashboard/widgets", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const preferences = await storage.getDashboardPreferences(userId);
      res.json(preferences);
    } catch (error) {
      console.error("Get dashboard preferences error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.put("/api/dashboard/widgets", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const preferences = req.body;
      await storage.updateDashboardPreferences(userId, preferences);
      res.json({ message: "Dashboard preferences updated" });
    } catch (error) {
      console.error("Update dashboard preferences error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Dashboard alerts endpoints
  app.get("/api/dashboard/alerts", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userCompanyId = req.session.userCompanyId;
      
      if (!userCompanyId) {
        return res.status(400).json({ message: "User company not found" });
      }

      const alerts = await storage.getDashboardAlerts(userCompanyId);
      res.json(alerts);
    } catch (error) {
      console.error("Get dashboard alerts error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.put("/api/dashboard/alerts/:id/dismiss", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userCompanyId = req.session.userCompanyId;
      const alertId = parseInt(req.params.id);
      
      if (!userCompanyId) {
        return res.status(400).json({ message: "User company not found" });
      }

      const success = await storage.dismissAlert(alertId, userCompanyId);
      if (success) {
        res.json({ message: "Alert dismissed" });
      } else {
        res.status(404).json({ message: "Alert not found" });
      }
    } catch (error) {
      console.error("Dismiss alert error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Create target company
  app.post("/api/target-companies", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const userCompanyId = req.session.userCompanyId;
      
      if (!userCompanyId) {
        return res.status(400).json({ message: "User company not found" });
      }

      // Create a validation schema that excludes userCompanyId and createdBy since we add them from session
      const frontendTargetCompanySchema = insertTargetCompanySchema.omit({
        userCompanyId: true,
        createdBy: true,
        stageUpdatedBy: true,
        stageUpdatedAt: true,
      });
      
      const validatedData = frontendTargetCompanySchema.parse(req.body);

      // Convert empty strings to null and handle number conversion
      const processedData = {
        companyName: validatedData.companyName,
        industry: validatedData.industry || null,
        website: validatedData.website || null,
        phone: validatedData.phone || null,
        email: validatedData.email || null,
        address: validatedData.address || null,
        annualRevenue: validatedData.annualRevenue || null,
        employeeCount: typeof validatedData.employeeCount === 'string' && validatedData.employeeCount.trim()
          ? parseInt(validatedData.employeeCount) || null
          : validatedData.employeeCount || null,
        yearEstablished: typeof validatedData.yearEstablished === 'string' && validatedData.yearEstablished.trim()
          ? parseInt(validatedData.yearEstablished) || null
          : validatedData.yearEstablished || null,
        description: validatedData.description || null,
        stage: validatedData.stage || null,
        userCompanyId,
        createdBy: userId,
      };

      const targetCompany = await storage.createTargetCompany(processedData as any);

      // Send webhook if website is provided
      if (validatedData.website && validatedData.website.trim()) {
        await sendWebhook(validatedData.website, targetCompany.id);
      }

      res.status(201).json(targetCompany);
    } catch (error) {
      console.error("Create target company error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: error.errors 
        });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get all target companies for user's company
  app.get("/api/target-companies", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userCompanyId = req.session.userCompanyId;
      
      if (!userCompanyId) {
        return res.status(400).json({ message: "User company not found" });
      }

      const targetCompanies = await storage.getTargetCompaniesByUserCompany(userCompanyId);
      res.json(targetCompanies);
    } catch (error) {
      console.error("Get target companies error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Search target companies with filters
  app.get("/api/target-companies/search", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userCompanyId = req.session.userCompanyId;
      
      if (!userCompanyId) {
        return res.status(400).json({ message: "User company not found" });
      }

      const searchParams = {
        q: req.query.q as string,
        industry: req.query.industry as string,
        minRevenue: req.query.minRevenue ? Number(req.query.minRevenue) : undefined,
        maxRevenue: req.query.maxRevenue ? Number(req.query.maxRevenue) : undefined,
        minEmployees: req.query.minEmployees ? Number(req.query.minEmployees) : undefined,
        maxEmployees: req.query.maxEmployees ? Number(req.query.maxEmployees) : undefined,
        minYear: req.query.minYear ? Number(req.query.minYear) : undefined,
        maxYear: req.query.maxYear ? Number(req.query.maxYear) : undefined,
        sort: req.query.sort as string,
      };

      const targetCompanies = await storage.searchTargetCompanies(userCompanyId, searchParams);
      res.json(targetCompanies);
    } catch (error) {
      console.error("Search target companies error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get filter options
  app.get("/api/target-companies/filters", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userCompanyId = req.session.userCompanyId;
      
      if (!userCompanyId) {
        return res.status(400).json({ message: "User company not found" });
      }

      const filterOptions = await storage.getFilterOptions(userCompanyId);
      res.json(filterOptions);
    } catch (error) {
      console.error("Get filter options error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get specific target company
  app.get("/api/target-companies/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userCompanyId = req.session.userCompanyId;
      const targetCompanyId = parseInt(req.params.id);
      
      if (!userCompanyId) {
        return res.status(400).json({ message: "User company not found" });
      }

      if (isNaN(targetCompanyId)) {
        return res.status(400).json({ message: "Invalid target company ID" });
      }

      const targetCompany = await storage.getTargetCompany(targetCompanyId, userCompanyId);
      
      if (!targetCompany) {
        return res.status(404).json({ message: "Target company not found" });
      }

      res.json(targetCompany);
    } catch (error) {
      console.error("Get target company error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get comprehensive company profile with enhanced data
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

      res.json(profile);
    } catch (error) {
      console.error("Get company profile error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Update target company
  app.put("/api/target-companies/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userCompanyId = req.session.userCompanyId;
      const targetCompanyId = parseInt(req.params.id);
      
      if (!userCompanyId) {
        return res.status(400).json({ message: "User company not found" });
      }

      if (isNaN(targetCompanyId)) {
        return res.status(400).json({ message: "Invalid target company ID" });
      }

      const validatedData = insertTargetCompanySchema.partial().parse(req.body);

      const updatedCompany = await storage.updateTargetCompany(
        targetCompanyId, 
        validatedData, 
        userCompanyId
      );
      
      if (!updatedCompany) {
        return res.status(404).json({ message: "Target company not found" });
      }

      res.json(updatedCompany);
    } catch (error) {
      console.error("Update target company error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: error.errors 
        });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Delete target company
  app.delete("/api/target-companies/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userCompanyId = req.session.userCompanyId;
      const targetCompanyId = parseInt(req.params.id);
      
      if (!userCompanyId) {
        return res.status(400).json({ message: "User company not found" });
      }

      if (isNaN(targetCompanyId)) {
        return res.status(400).json({ message: "Invalid target company ID" });
      }

      const deleted = await storage.deleteTargetCompany(targetCompanyId, userCompanyId);
      
      if (!deleted) {
        return res.status(404).json({ message: "Target company not found" });
      }

      res.json({ message: "Target company deleted successfully" });
    } catch (error) {
      console.error("Delete target company error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Contact Management Routes
  const targetContactCreateSchema = insertTargetContactSchema.omit({
    targetCompanyId: true,
  });

  // Get contacts for target company
  app.get("/api/target-companies/:id/contacts", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userCompanyId = req.session.userCompanyId;
      const targetCompanyId = parseInt(req.params.id);
      
      if (!userCompanyId) {
        return res.status(400).json({ message: "User company not found" });
      }

      if (isNaN(targetCompanyId)) {
        return res.status(400).json({ message: "Invalid target company ID" });
      }

      const contacts = await storage.getContactsForTargetCompany(targetCompanyId, userCompanyId);
      res.json(contacts);
    } catch (error) {
      console.error("Get contacts error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Create contact for target company
  app.post("/api/target-companies/:id/contacts", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userCompanyId = req.session.userCompanyId;
      const targetCompanyId = parseInt(req.params.id);
      
      if (!userCompanyId) {
        return res.status(400).json({ message: "User company not found" });
      }

      if (isNaN(targetCompanyId)) {
        return res.status(400).json({ message: "Invalid target company ID" });
      }

      // Verify target company exists and belongs to user
      const targetCompany = await storage.getTargetCompany(targetCompanyId, userCompanyId);
      if (!targetCompany) {
        return res.status(404).json({ message: "Target company not found" });
      }

      const validatedData = targetContactCreateSchema.parse(req.body);

      const contact = await storage.createTargetContact({
        ...validatedData,
        targetCompanyId,
      });

      res.status(201).json(contact);
    } catch (error) {
      console.error("Create contact error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: error.errors 
        });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Update contact
  app.put("/api/contacts/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userCompanyId = req.session.userCompanyId;
      const contactId = parseInt(req.params.id);
      
      if (!userCompanyId) {
        return res.status(400).json({ message: "User company not found" });
      }

      if (isNaN(contactId)) {
        return res.status(400).json({ message: "Invalid contact ID" });
      }

      const validatedData = targetContactCreateSchema.partial().parse(req.body);

      const updatedContact = await storage.updateTargetContact(contactId, validatedData, userCompanyId);
      
      if (!updatedContact) {
        return res.status(404).json({ message: "Contact not found" });
      }

      res.json(updatedContact);
    } catch (error) {
      console.error("Update contact error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: error.errors 
        });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Delete contact
  app.delete("/api/contacts/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userCompanyId = req.session.userCompanyId;
      const contactId = parseInt(req.params.id);
      
      if (!userCompanyId) {
        return res.status(400).json({ message: "User company not found" });
      }

      if (isNaN(contactId)) {
        return res.status(400).json({ message: "Invalid contact ID" });
      }

      const deleted = await storage.deleteTargetContact(contactId, userCompanyId);
      
      if (!deleted) {
        return res.status(404).json({ message: "Contact not found" });
      }

      res.json({ message: "Contact deleted successfully" });
    } catch (error) {
      console.error("Delete contact error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get all contacts across all target companies for the user
  app.get("/api/contacts/all", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userCompanyId = req.session.userCompanyId;
      
      if (!userCompanyId) {
        return res.status(400).json({ message: "User company not found" });
      }

      const allContacts = await storage.getAllContactsForUserCompany(userCompanyId);
      res.json(allContacts);
    } catch (error) {
      console.error("Get all contacts error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ========================
  // Team Management Routes
  // ========================

  // Send invitation to new team member
  app.post("/api/team/invite", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId;
      const userCompanyId = req.session.userCompanyId;

      if (!userId || !userCompanyId) {
        return res.status(400).json({ message: "User not authenticated" });
      }

      // Check if user has permission to invite
      const userWithPermissions = await storage.getUserWithPermissions(userId);
      if (!userWithPermissions?.permissions?.canManageUsers && !userWithPermissions?.isCompanyAdmin) {
        return res.status(403).json({ message: "Insufficient permissions to invite users" });
      }

      const inviteSchema = z.object({
        email: z.string().email("Invalid email address"),
        role: z.string().min(1, "Role is required"),
        message: z.string().optional(),
      });

      const { email, role, message } = inviteSchema.parse(req.body);

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser && existingUser.userCompanyId === userCompanyId) {
        return res.status(400).json({ message: "User already exists in your company" });
      }

      // Check if invitation already exists
      const existingInvitations = await storage.getInvitationsByUserCompany(userCompanyId);
      const existingInvitation = existingInvitations.find(inv => 
        inv.email === email && inv.invitationStatus === 'pending'
      );
      
      if (existingInvitation) {
        return res.status(400).json({ message: "Invitation already sent to this email address" });
      }

      // Generate secure invitation token
      const invitationToken = randomUUID();

      const invitation = await storage.createUserInvitation({
        userCompanyId,
        email: email.toLowerCase(),
        invitedBy: userId,
        invitationToken,
        invitedRole: role,
        invitationMessage: message || "",
        invitationStatus: "pending",
        ipAddressSent: req.ip,
      });

      // Create notification for team activity
      await storage.createNotification({
        userCompanyId,
        targetUserId: userId, // Notify the inviter
        fromUserId: userId,
        notificationType: "team_invitation_sent",
        notificationTitle: "Team Invitation Sent",
        notificationMessage: `Invitation sent to ${email} as ${role}`,
        isRead: false,
      });

      // Send invitation email
      const inviteUrl = `${req.protocol}://${req.get('host')}/invite/${invitation.invitationToken}`;
      const inviterUser = await storage.getUser(userId);
      const userCompany = await storage.getUserCompany(userCompanyId);
      
      if (inviterUser && userCompany) {
        const inviterName = `${inviterUser.firstName || ''} ${inviterUser.lastName || ''}`.trim() || inviterUser.email;
        const emailSent = await emailService.sendTeamInvitation(
          email,
          inviterName,
          userCompany.companyName,
          invitation.invitationToken,
          inviteUrl,
          role
        );
        
        if (!emailSent) {
          console.warn(`Failed to send invitation email to ${email}`);
        }
      }

      res.json({ 
        message: "Invitation sent successfully", 
        invitation: { 
          id: invitation.id,
          email: invitation.email,
          role: invitation.invitedRole,
          status: invitation.invitationStatus,
          sentAt: invitation.sentAt,
          inviteUrl
        }
      });
    } catch (error) {
      console.error("Send invitation error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get invitation details by token (public endpoint for invitation acceptance)
  app.get("/api/team/invitation/:token", async (req: Request, res: Response) => {
    try {
      const { token } = req.params;
      
      if (!token) {
        return res.status(400).json({ message: "Token is required" });
      }
      
      const invitation = await storage.getUserInvitationByToken(token);
      
      if (!invitation) {
        return res.status(404).json({ message: "Invitation not found or expired" });
      }
      
      res.json({
        email: invitation.email,
        invitedRole: invitation.invitedRole,
        companyName: invitation.companyName,
        inviterName: invitation.inviterName,
        invitationMessage: invitation.invitationMessage,
        invitationStatus: invitation.invitationStatus,
      });
    } catch (error) {
      console.error("Get invitation details error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Accept invitation endpoint (public)
  app.post("/api/team/invitation/:token/accept", async (req: Request, res: Response) => {
    try {
      const { token } = req.params;
      const acceptSchema = z.object({
        firstName: z.string().min(1, "First name is required"),
        lastName: z.string().min(1, "Last name is required"),
        password: z.string().min(8, "Password must be at least 8 characters"),
      });
      
      const { firstName, lastName, password } = acceptSchema.parse(req.body);
      
      // Get invitation details first
      const invitation = await storage.getUserInvitationByToken(token);
      if (!invitation || invitation.invitationStatus !== 'pending') {
        return res.status(400).json({ message: "Invalid or expired invitation" });
      }
      
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(invitation.email);
      
      let user: any;
      
      if (existingUser) {
        // User exists - this means they were invited to a different company
        // For security, we should not allow cross-company invitations without proper validation
        return res.status(400).json({ 
          message: "An account with this email already exists. Please contact your administrator or use a different email address." 
        });
      } else {
        // Create new user
        user = await storage.acceptInvitation(token, {
          firstName,
          lastName,
          passwordHash: await bcrypt.hash(password, 10),
          isActive: true,
          emailVerified: true,
        });
      }
      
      if (!user) {
        return res.status(400).json({ message: "Failed to accept invitation" });
      }
      
      res.json({ 
        message: "Invitation accepted successfully",
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
        }
      });
    } catch (error) {
      console.error("Accept invitation error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get pending invitations (admin only)
  app.get("/api/team/invitations", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId;
      const userCompanyId = req.session.userCompanyId;

      if (!userId || !userCompanyId) {
        return res.status(400).json({ message: "User not authenticated" });
      }

      // Check if user has permission
      const userWithPermissions = await storage.getUserWithPermissions(userId);
      if (!userWithPermissions?.permissions?.canManageUsers && !userWithPermissions?.isCompanyAdmin) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const invitations = await storage.getInvitationsByUserCompany(userCompanyId);
      res.json(invitations);
    } catch (error) {
      console.error("Get invitations error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Update invitation (cancel, resend)
  app.put("/api/team/invitations/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId;
      const userCompanyId = req.session.userCompanyId;
      const invitationId = parseInt(req.params.id);

      if (!userId || !userCompanyId) {
        return res.status(400).json({ message: "User not authenticated" });
      }

      if (isNaN(invitationId)) {
        return res.status(400).json({ message: "Invalid invitation ID" });
      }

      // Check if user has permission
      const userWithPermissions = await storage.getUserWithPermissions(userId);
      if (!userWithPermissions?.permissions?.canManageUsers && !userWithPermissions?.isCompanyAdmin) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const updateSchema = z.object({
        status: z.enum(["cancelled", "pending"]),
      });

      const { status } = updateSchema.parse(req.body);

      const updatedInvitation = await storage.updateUserInvitation(invitationId, {
        invitationStatus: status,
      });

      if (!updatedInvitation) {
        return res.status(404).json({ message: "Invitation not found" });
      }

      res.json(updatedInvitation);
    } catch (error) {
      console.error("Update invitation error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Accept invitation via token
  app.post("/api/team/accept-invitation", async (req: Request, res: Response) => {
    try {
      const acceptSchema = z.object({
        token: z.string().min(1, "Token is required"),
        firstName: z.string().min(1, "First name is required"),
        lastName: z.string().min(1, "Last name is required"),
        password: z.string().min(6, "Password must be at least 6 characters"),
      });

      const { token, firstName, lastName, password } = acceptSchema.parse(req.body);

      // Get invitation details
      const invitation = await storage.getUserInvitationByToken(token);
      if (!invitation) {
        return res.status(400).json({ message: "Invalid or expired invitation" });
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 12);

      // Accept invitation and create user
      const newUser = await storage.acceptInvitation(token, {
        firstName,
        lastName,
        passwordHash,
      });

      if (!newUser) {
        return res.status(400).json({ message: "Failed to accept invitation" });
      }

      // Create welcome notification for inviter
      await storage.createNotification({
        userCompanyId: invitation.userCompanyId,
        targetUserId: invitation.invitedBy,
        fromUserId: newUser.id,
        notificationType: "team_member_joined",
        notificationTitle: "New Team Member Joined",
        notificationMessage: `${firstName} ${lastName} has joined your team`,
        isRead: false,
      });

      res.json({ 
        message: "Account created successfully",
        user: {
          id: newUser.id,
          email: newUser.email,
          firstName: newUser.firstName,
          lastName: newUser.lastName,
          role: newUser.userRole
        }
      });
    } catch (error) {
      console.error("Accept invitation error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get invitation details by token
  app.get("/api/team/invitation/:token", async (req: Request, res: Response) => {
    try {
      const { token } = req.params;
      
      const invitation = await storage.getUserInvitationByToken(token);
      if (!invitation) {
        return res.status(400).json({ message: "Invalid or expired invitation" });
      }

      res.json({
        email: invitation.email,
        role: invitation.invitedRole,
        companyName: invitation.companyName,
        inviterName: invitation.inviterName,
        message: invitation.invitationMessage
      });
    } catch (error) {
      console.error("Get invitation error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get all team members
  app.get("/api/team/members", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userCompanyId = req.session.userCompanyId;

      if (!userCompanyId) {
        return res.status(400).json({ message: "User company not found" });
      }

      const teamMembers = await storage.getTeamMembers(userCompanyId);
      res.json(teamMembers);
    } catch (error) {
      console.error("Get team members error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Update team member role/status
  app.put("/api/team/members/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId;
      const userCompanyId = req.session.userCompanyId;
      const memberId = parseInt(req.params.id);

      if (!userId || !userCompanyId) {
        return res.status(400).json({ message: "User not authenticated" });
      }

      if (isNaN(memberId)) {
        return res.status(400).json({ message: "Invalid member ID" });
      }

      // Check if user has permission
      const userWithPermissions = await storage.getUserWithPermissions(userId);
      if (!userWithPermissions?.permissions?.canManageUsers && !userWithPermissions?.isCompanyAdmin) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const updateSchema = z.object({
        role: z.string().optional(),
        status: z.enum(["active", "inactive"]).optional(),
      });

      const { role, status } = updateSchema.parse(req.body);

      if (role) {
        const updatedUser = await storage.updateUserRole(memberId, role, userCompanyId);
        if (!updatedUser) {
          return res.status(404).json({ message: "Team member not found" });
        }
      }

      if (status === "inactive") {
        const deactivated = await storage.deactivateUser(memberId, userCompanyId);
        if (!deactivated) {
          return res.status(404).json({ message: "Team member not found" });
        }
      }

      res.json({ message: "Team member updated successfully" });
    } catch (error) {
      console.error("Update team member error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Remove team member (admin only)
  app.delete("/api/team/members/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId;
      const userCompanyId = req.session.userCompanyId;
      const memberId = parseInt(req.params.id);

      if (!userId || !userCompanyId) {
        return res.status(400).json({ message: "User not authenticated" });
      }

      if (isNaN(memberId)) {
        return res.status(400).json({ message: "Invalid member ID" });
      }

      // Check if user has permission
      const userWithPermissions = await storage.getUserWithPermissions(userId);
      if (!userWithPermissions?.isCompanyAdmin) {
        return res.status(403).json({ message: "Only company admins can remove team members" });
      }

      // Don't allow removing themselves
      if (memberId === userId) {
        return res.status(400).json({ message: "Cannot remove yourself" });
      }

      const deactivated = await storage.deactivateUser(memberId, userCompanyId);
      if (!deactivated) {
        return res.status(404).json({ message: "Team member not found" });
      }

      res.json({ message: "Team member removed successfully" });
    } catch (error) {
      console.error("Remove team member error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get available roles and permissions
  app.get("/api/team/roles", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const roles = await storage.getUserRoles();
      res.json(roles);
    } catch (error) {
      console.error("Get roles error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Assign team member to deal
  app.post("/api/deals/:id/assign", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId;
      const userCompanyId = req.session.userCompanyId;
      const targetCompanyId = parseInt(req.params.id);

      if (!userId || !userCompanyId) {
        return res.status(400).json({ message: "User not authenticated" });
      }

      if (isNaN(targetCompanyId)) {
        return res.status(400).json({ message: "Invalid company ID" });
      }

      // Check if user has permission
      const userWithPermissions = await storage.getUserWithPermissions(userId);
      if (!userWithPermissions?.permissions?.canManageUsers && !userWithPermissions?.isCompanyAdmin) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const assignSchema = z.object({
        userId: z.number(),
        role: z.string().default("analyst"),
        canEditCompany: z.boolean().default(true),
        canUploadDocuments: z.boolean().default(true),
        canCreateActivities: z.boolean().default(true),
        canManageContacts: z.boolean().default(true),
      });

      const assignmentData = assignSchema.parse(req.body);

      const assignment = await storage.createDealAssignment({
        userId: assignmentData.userId,
        targetCompanyId,
        assignedBy: userId,
        assignmentRole: assignmentData.role,
        canEditCompany: assignmentData.canEditCompany,
        canUploadDocuments: assignmentData.canUploadDocuments,
        canCreateActivities: assignmentData.canCreateActivities,
        canManageContacts: assignmentData.canManageContacts,
        isActive: true,
      });

      // Get target company name for notification
      const targetCompany = await storage.getTargetCompany(targetCompanyId, userCompanyId);
      
      // Create notification for assigned user
      if (targetCompany) {
        await storage.createNotification({
          userCompanyId,
          targetUserId: assignmentData.userId,
          fromUserId: userId,
          notificationType: "deal_assigned",
          notificationTitle: "Assigned to Deal",
          notificationMessage: `You have been assigned to ${targetCompany.companyName}`,
          targetCompanyId,
          isRead: false,
        });
      }

      res.json(assignment);
    } catch (error) {
      console.error("Assign team member error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Remove team member from deal
  app.delete("/api/deals/:id/assign/:userId", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const requestUserId = req.session.userId;
      const userCompanyId = req.session.userCompanyId;
      const targetCompanyId = parseInt(req.params.id);
      const assignedUserId = parseInt(req.params.userId);

      if (!requestUserId || !userCompanyId) {
        return res.status(400).json({ message: "User not authenticated" });
      }

      if (isNaN(targetCompanyId) || isNaN(assignedUserId)) {
        return res.status(400).json({ message: "Invalid parameters" });
      }

      // Check if user has permission
      const userWithPermissions = await storage.getUserWithPermissions(requestUserId);
      if (!userWithPermissions?.permissions?.canManageUsers && !userWithPermissions?.isCompanyAdmin) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const removed = await storage.removeDealAssignment(assignedUserId, targetCompanyId);
      if (!removed) {
        return res.status(404).json({ message: "Assignment not found" });
      }

      res.json({ message: "Team member removed from deal successfully" });
    } catch (error) {
      console.error("Remove team member from deal error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get deal team members
  app.get("/api/deals/:id/team", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userCompanyId = req.session.userCompanyId;
      const targetCompanyId = parseInt(req.params.id);

      if (!userCompanyId) {
        return res.status(400).json({ message: "User not authenticated" });
      }

      if (isNaN(targetCompanyId)) {
        return res.status(400).json({ message: "Invalid company ID" });
      }

      const assignments = await storage.getDealAssignments(targetCompanyId);
      res.json(assignments);
    } catch (error) {
      console.error("Get deal team error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Update team member permissions for deal
  app.put("/api/deals/:id/team/:userId", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const requestUserId = req.session.userId;
      const userCompanyId = req.session.userCompanyId;
      const targetCompanyId = parseInt(req.params.id);
      const assignedUserId = parseInt(req.params.userId);

      if (!requestUserId || !userCompanyId) {
        return res.status(400).json({ message: "User not authenticated" });
      }

      if (isNaN(targetCompanyId) || isNaN(assignedUserId)) {
        return res.status(400).json({ message: "Invalid parameters" });
      }

      // Check if user has permission
      const userWithPermissions = await storage.getUserWithPermissions(requestUserId);
      if (!userWithPermissions?.permissions?.canManageUsers && !userWithPermissions?.isCompanyAdmin) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const updateSchema = z.object({
        role: z.string().optional(),
        canEditCompany: z.boolean().optional(),
        canUploadDocuments: z.boolean().optional(),
        canCreateActivities: z.boolean().optional(),
        canManageContacts: z.boolean().optional(),
      });

      const updateData = updateSchema.parse(req.body);

      const updatedAssignment = await storage.updateDealAssignment(
        assignedUserId, 
        targetCompanyId, 
        {
          assignmentRole: updateData.role,
          canEditCompany: updateData.canEditCompany,
          canUploadDocuments: updateData.canUploadDocuments,
          canCreateActivities: updateData.canCreateActivities,
          canManageContacts: updateData.canManageContacts,
        }
      );

      if (!updatedAssignment) {
        return res.status(404).json({ message: "Assignment not found" });
      }

      res.json(updatedAssignment);
    } catch (error) {
      console.error("Update team member permissions error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get user notifications
  app.get("/api/notifications", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId;

      if (!userId) {
        return res.status(400).json({ message: "User not authenticated" });
      }

      const notifications = await storage.getUserNotifications(userId);
      res.json(notifications);
    } catch (error) {
      console.error("Get notifications error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Mark notification as read
  app.put("/api/notifications/:id/read", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId;
      const notificationId = parseInt(req.params.id);

      if (!userId) {
        return res.status(400).json({ message: "User not authenticated" });
      }

      if (isNaN(notificationId)) {
        return res.status(400).json({ message: "Invalid notification ID" });
      }

      const marked = await storage.markNotificationRead(notificationId, userId);
      if (!marked) {
        return res.status(404).json({ message: "Notification not found" });
      }

      res.json({ message: "Notification marked as read" });
    } catch (error) {
      console.error("Mark notification read error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Mark all notifications as read
  app.post("/api/notifications/mark-all-read", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId;

      if (!userId) {
        return res.status(400).json({ message: "User not authenticated" });
      }

      const count = await storage.markAllNotificationsRead(userId);
      res.json({ message: "All notifications marked as read", count });
    } catch (error) {
      console.error("Mark all notifications read error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Pipeline stage management routes
  // Get all pipeline stages
  app.get("/api/pipeline/stages", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const stages = await storage.getPipelineStages();
      res.json(stages);
    } catch (error) {
      console.error("Get pipeline stages error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Update company stage
  app.put("/api/target-companies/:id/stage", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId;
      const userCompanyId = req.session.userCompanyId;
      const companyId = parseInt(req.params.id);
      const { stage, notes = '' } = req.body;

      if (!userId || !userCompanyId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      if (isNaN(companyId)) {
        return res.status(400).json({ message: "Invalid company ID" });
      }

      if (!stage) {
        return res.status(400).json({ message: "Stage is required" });
      }

      // Verify user has access to this company
      const company = await storage.getTargetCompany(companyId, userCompanyId);
      if (!company) {
        return res.status(404).json({ message: "Company not found or access denied" });
      }

      const result = await storage.updateCompanyStage(companyId, stage, userId, notes);
      res.json(result);
    } catch (error) {
      console.error("Update company stage error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get stage history for a company
  app.get("/api/target-companies/:id/stage-history", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userCompanyId = req.session.userCompanyId;
      const companyId = parseInt(req.params.id);

      if (!userCompanyId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      if (isNaN(companyId)) {
        return res.status(400).json({ message: "Invalid company ID" });
      }

      // Verify user has access to this company
      const company = await storage.getTargetCompany(companyId, userCompanyId);
      if (!company) {
        return res.status(404).json({ message: "Company not found or access denied" });
      }

      const history = await storage.getStageHistory(companyId);
      res.json(history);
    } catch (error) {
      console.error("Get stage history error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get pipeline overview
  app.get("/api/pipeline/overview", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userCompanyId = req.session.userCompanyId;

      if (!userCompanyId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const overview = await storage.getPipelineOverview(userCompanyId);
      res.json(overview);
    } catch (error) {
      console.error("Get pipeline overview error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Activity management routes

  // Get activity types
  app.get("/api/activities/types", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const activityTypes = await storage.getActivityTypes();
      res.json(activityTypes);
    } catch (error) {
      console.error("Get activity types error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Create new activity for target company
  app.post("/api/target-companies/:id/activities", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId;
      const userCompanyId = req.session.userCompanyId;
      const targetCompanyId = parseInt(req.params.id);

      if (!userId || !userCompanyId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      if (isNaN(targetCompanyId)) {
        return res.status(400).json({ message: "Invalid company ID" });
      }

      // Verify user has access to this company
      const company = await storage.getTargetCompany(targetCompanyId, userCompanyId);
      if (!company) {
        return res.status(404).json({ message: "Company not found or access denied" });
      }

      const activityData = insertActivitySchema.parse({
        ...req.body,
        targetCompanyId,
        userId,
      });

      const newActivity = await storage.createActivity(activityData);
      res.status(201).json(newActivity);
    } catch (error) {
      console.error("Create activity error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: error.errors 
        });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get activities for target company
  app.get("/api/target-companies/:id/activities", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userCompanyId = req.session.userCompanyId;
      const targetCompanyId = parseInt(req.params.id);

      if (!userCompanyId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      if (isNaN(targetCompanyId)) {
        return res.status(400).json({ message: "Invalid company ID" });
      }

      // Verify user has access to this company
      const company = await storage.getTargetCompany(targetCompanyId, userCompanyId);
      if (!company) {
        return res.status(404).json({ message: "Company not found or access denied" });
      }

      const activities = await storage.getActivitiesForCompany(targetCompanyId, userCompanyId);
      res.json(activities);
    } catch (error) {
      console.error("Get company activities error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get activity timeline for target company
  app.get("/api/target-companies/:id/activities/timeline", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userCompanyId = req.session.userCompanyId;
      const targetCompanyId = parseInt(req.params.id);

      if (!userCompanyId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      if (isNaN(targetCompanyId)) {
        return res.status(400).json({ message: "Invalid company ID" });
      }

      // Verify user has access to this company
      const company = await storage.getTargetCompany(targetCompanyId, userCompanyId);
      if (!company) {
        return res.status(404).json({ message: "Company not found or access denied" });
      }

      const timeline = await storage.getActivityTimeline(targetCompanyId, userCompanyId);
      res.json(timeline);
    } catch (error) {
      console.error("Get activity timeline error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Update activity
  app.put("/api/activities/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userCompanyId = req.session.userCompanyId;
      const activityId = parseInt(req.params.id);

      if (!userCompanyId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      if (isNaN(activityId)) {
        return res.status(400).json({ message: "Invalid activity ID" });
      }

      const updateData = z.object({
        activityType: z.string().optional(),
        title: z.string().optional(),
        description: z.string().optional(),
        activityDate: z.string().datetime().or(z.date()).optional(),
        activityTime: z.string().optional(),
        durationMinutes: z.number().optional().nullable(),
        contactId: z.number().optional().nullable(),
        isCompleted: z.boolean().optional(),
        followUpDate: z.string().datetime().optional().nullable().or(z.date().optional().nullable()),
      }).parse(req.body);

      const updatedActivity = await storage.updateActivity(activityId, updateData, userCompanyId);
      
      if (!updatedActivity) {
        return res.status(404).json({ message: "Activity not found or access denied" });
      }

      res.json(updatedActivity);
    } catch (error) {
      console.error("Update activity error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: error.errors 
        });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Delete activity
  app.delete("/api/activities/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userCompanyId = req.session.userCompanyId;
      const activityId = parseInt(req.params.id);

      if (!userCompanyId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      if (isNaN(activityId)) {
        return res.status(400).json({ message: "Invalid activity ID" });
      }

      const deleted = await storage.deleteActivity(activityId, userCompanyId);
      
      if (!deleted) {
        return res.status(404).json({ message: "Activity not found or access denied" });
      }

      res.json({ message: "Activity deleted successfully" });
    } catch (error) {
      console.error("Delete activity error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get recent activities across all companies
  app.get("/api/activities/recent", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userCompanyId = req.session.userCompanyId;
      const limit = parseInt(req.query.limit as string) || 20;

      if (!userCompanyId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const recentActivities = await storage.getRecentActivities(userCompanyId, limit);
      res.json(recentActivities);
    } catch (error) {
      console.error("Get recent activities error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ========================
  // Reporting & Analytics Routes
  // ========================

  // Get pipeline overview report
  app.get("/api/reports/pipeline-overview", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userCompanyId = req.session.userCompanyId;
      const dateRange = req.query.range as string;
      
      if (!userCompanyId) {
        return res.status(400).json({ message: "User company not found" });
      }

      const pipelineData = await storage.getPipelineOverview(userCompanyId, dateRange);
      res.json(pipelineData);
    } catch (error) {
      console.error("Pipeline overview error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get activity summary report
  app.get("/api/reports/activity-summary", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userCompanyId = req.session.userCompanyId;
      const dateRange = req.query.range as string;
      
      if (!userCompanyId) {
        return res.status(400).json({ message: "User company not found" });
      }

      const activityData = await storage.getActivitySummary(userCompanyId, dateRange);
      res.json(activityData);
    } catch (error) {
      console.error("Activity summary error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get performance metrics report
  app.get("/api/reports/performance-metrics", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userCompanyId = req.session.userCompanyId;
      const dateRange = req.query.range as string;
      
      if (!userCompanyId) {
        return res.status(400).json({ message: "User company not found" });
      }

      const performanceData = await storage.getPerformanceMetrics(userCompanyId, dateRange);
      res.json(performanceData);
    } catch (error) {
      console.error("Performance metrics error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get stage analysis report
  app.get("/api/reports/stage-analysis", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userCompanyId = req.session.userCompanyId;
      const dateRange = req.query.range as string;
      
      if (!userCompanyId) {
        return res.status(400).json({ message: "User company not found" });
      }

      const stageData = await storage.getStageAnalysis(userCompanyId, dateRange);
      res.json(stageData);
    } catch (error) {
      console.error("Stage analysis error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get user performance report
  app.get("/api/reports/user-performance", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userCompanyId = req.session.userCompanyId;
      const dateRange = req.query.range as string;
      
      if (!userCompanyId) {
        return res.status(400).json({ message: "User company not found" });
      }

      const userPerformanceData = await storage.getUserPerformance(userCompanyId, dateRange);
      res.json(userPerformanceData);
    } catch (error) {
      console.error("User performance error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Export reports as CSV
  app.get("/api/reports/export/:type", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userCompanyId = req.session.userCompanyId;
      const reportType = req.params.type;
      const format = req.query.format as string || 'csv';
      
      if (!userCompanyId) {
        return res.status(400).json({ message: "User company not found" });
      }

      const csvData = await storage.exportReport(userCompanyId, reportType, format);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${reportType}_report_${new Date().toISOString().split('T')[0]}.csv"`);
      res.send(csvData);
    } catch (error) {
      console.error("Export report error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Configure multer for file uploads
  const uploadStorage = multer.diskStorage({
    destination: async (req, file, cb) => {
      const companyId = req.params.id;
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
      fileSize: 10 * 1024 * 1024 // 10MB limit
    }
  });

  // Document Categories endpoint
  app.get("/api/document-categories", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const categories = await storage.getDocumentCategories();
      res.json(categories);
    } catch (error) {
      console.error("Get document categories error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Upload document
  app.post("/api/target-companies/:id/documents", isAuthenticated, (req: Request, res: Response) => {
    upload.single('document')(req, res, async (err) => {
      try {
        const targetCompanyId = parseInt(req.params.id);
        const userId = req.session.userId!;
        const userCompanyId = req.session.userCompanyId!;
        
        if (err) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'File size too large. Maximum 10MB allowed.' });
          }
          return res.status(400).json({ error: err.message });
        }
        
        if (!req.file) {
          return res.status(400).json({ error: 'No file uploaded' });
        }

        // Verify user has access to this company
        const company = await storage.getTargetCompany(targetCompanyId, userCompanyId);
        if (!company) {
          return res.status(404).json({ error: 'Company not found or access denied' });
        }
        
        // Create document record
        const documentData = {
          targetCompanyId,
          uploadedBy: userId,
          documentName: req.body.document_name || req.file.originalname,
          originalFilename: req.file.originalname,
          filePath: req.file.path,
          fileSize: req.file.size,
          fileType: req.file.mimetype,
          documentCategory: req.body.document_category || 'Other',
          description: req.body.description || '',
          isConfidential: req.body.is_confidential !== 'false'
        };
        
        const document = await storage.createDocument(documentData);
        
        res.json({
          success: true,
          document,
          message: 'Document uploaded successfully'
        });
        
      } catch (error) {
        console.error('Document upload failed:', error);
        res.status(500).json({ error: 'Upload failed' });
      }
    });
  });

  // Get company documents
  app.get("/api/target-companies/:id/documents", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const targetCompanyId = parseInt(req.params.id);
      const userCompanyId = req.session.userCompanyId!;
      
      const documents = await storage.getCompanyDocuments(targetCompanyId, userCompanyId);
      
      // Group documents by category
      const groupedDocuments = documents.reduce((acc: any, doc) => {
        if (!acc[doc.documentCategory]) {
          acc[doc.documentCategory] = [];
        }
        acc[doc.documentCategory].push(doc);
        return acc;
      }, {});
      
      res.json(groupedDocuments);
    } catch (error) {
      console.error("Get company documents error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get document details
  app.get("/api/documents/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const documentId = parseInt(req.params.id);
      const userCompanyId = req.session.userCompanyId!;
      
      const document = await storage.getDocument(documentId, userCompanyId);
      if (!document) {
        return res.status(404).json({ error: 'Document not found or access denied' });
      }
      
      res.json(document);
    } catch (error) {
      console.error("Get document error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // View document (for preview)
  app.get("/api/documents/:id/view", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const documentId = parseInt(req.params.id);
      const userId = req.session.userId!;
      const userCompanyId = req.session.userCompanyId!;
      
      const document = await storage.getDocument(documentId, userCompanyId);
      if (!document) {
        return res.status(404).json({ error: 'Document not found or access denied' });
      }
      
      // Log access
      await storage.logDocumentAccess(documentId, userId, 'view', req.ip);
      
      // Set headers for inline viewing
      res.setHeader('Content-Type', document.fileType);
      res.setHeader('Content-Disposition', `inline; filename="${document.originalFilename}"`);
      
      // Add cache control for better performance
      res.setHeader('Cache-Control', 'private, max-age=3600');
      
      // Add headers to allow iframe embedding
      res.setHeader('X-Frame-Options', 'SAMEORIGIN');
      res.setHeader('Content-Security-Policy', 'frame-ancestors \'self\'');
      
      // Send file
      res.sendFile(path.resolve(document.filePath));
      
    } catch (error) {
      console.error("View document error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Download document
  app.get("/api/documents/:id/download", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const documentId = parseInt(req.params.id);
      const userId = req.session.userId!;
      const userCompanyId = req.session.userCompanyId!;
      
      const document = await storage.getDocument(documentId, userCompanyId);
      if (!document) {
        return res.status(404).json({ error: 'Document not found or access denied' });
      }
      
      // Log access
      await storage.logDocumentAccess(documentId, userId, 'download', req.ip);
      
      // Set headers for download
      res.setHeader('Content-Disposition', `attachment; filename="${document.originalFilename}"`);
      res.setHeader('Content-Type', document.fileType);
      
      // Send file
      res.sendFile(path.resolve(document.filePath));
      
    } catch (error) {
      console.error("Download document error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Update document
  app.put("/api/documents/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const documentId = parseInt(req.params.id);
      const userCompanyId = req.session.userCompanyId!;
      
      const updateData = {
        documentName: req.body.document_name,
        documentCategory: req.body.document_category,
        description: req.body.description,
        isConfidential: req.body.is_confidential
      };
      
      const document = await storage.updateDocument(documentId, updateData, userCompanyId);
      if (!document) {
        return res.status(404).json({ error: 'Document not found or access denied' });
      }
      
      res.json({ success: true, document });
    } catch (error) {
      console.error("Update document error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Delete document
  app.delete("/api/documents/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const documentId = parseInt(req.params.id);
      const userCompanyId = req.session.userCompanyId!;
      
      // Get document before deletion to remove file
      const document = await storage.getDocument(documentId, userCompanyId);
      if (!document) {
        return res.status(404).json({ error: 'Document not found or access denied' });
      }
      
      const success = await storage.deleteDocument(documentId, userCompanyId);
      if (!success) {
        return res.status(500).json({ error: 'Failed to delete document' });
      }
      
      // Remove file from filesystem
      try {
        await fs.unlink(document.filePath);
      } catch (err) {
        console.warn("Could not remove file:", document.filePath, err);
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Delete document error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ========================================
  // External Document Portal Routes
  // ========================================

  // Validate portal token (public endpoint)
  app.get("/api/portal/validate/:token", async (req: Request, res: Response) => {
    try {
      const accessToken = req.params.token;
      
      if (!accessToken) {
        return res.status(400).json({ message: "Access token is required" });
      }
      
      const portalToken = await storage.validatePortalToken(accessToken);
      if (!portalToken) {
        return res.status(404).json({ message: "Invalid or expired access token" });
      }
      
      // Log access
      await storage.updatePortalTokenAccess(
        portalToken.id, 
        req.ip, 
        req.get('User-Agent')
      );
      
      // Log activity
      await storage.logPortalActivity({
        portalTokenId: portalToken.id,
        targetContactId: portalToken.targetContactId,
        activityType: "portal_access",
        activityDescription: "Portal accessed via token validation",
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });
      
      res.json({
        valid: true,
        tokenId: portalToken.id,
        companyId: portalToken.targetCompanyId,
        contactId: portalToken.targetContactId,
        allowedActions: JSON.parse(portalToken.allowedActions || '{}'),
        customMessage: portalToken.customMessage,
        portalBranding: portalToken.portalBranding ? JSON.parse(portalToken.portalBranding) : null,
      });
    } catch (error) {
      console.error("Validate portal token error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get portal document requirements (public endpoint)
  app.get("/api/portal/:token/requirements", async (req: Request, res: Response) => {
    try {
      const accessToken = req.params.token;
      
      const portalToken = await storage.validatePortalToken(accessToken);
      if (!portalToken) {
        return res.status(404).json({ message: "Invalid or expired access token" });
      }
      
      const requirements = await storage.getPortalDocumentRequirements(portalToken.id);
      
      // Log activity
      await storage.logPortalActivity({
        portalTokenId: portalToken.id,
        targetContactId: portalToken.targetContactId,
        activityType: "requirements_viewed",
        activityDescription: "Document requirements viewed",
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });
      
      res.json(requirements);
    } catch (error) {
      console.error("Get portal requirements error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Submit document via portal (public endpoint with file upload)
  const portalUpload = multer({
    storage: multer.diskStorage({
      destination: './uploads/portal',
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
      }
    }),
    fileFilter: (req, file, cb) => {
      // Allow common business document types - be more permissive with extensions
      const allowedExtensions = /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|jpg|jpeg|png|gif)$/i;
      
      // Log file upload attempts for debugging
      console.log('File upload attempt:', file.originalname, file.mimetype);
      
      if (allowedExtensions.test(file.originalname)) {
        return cb(null, true);
      } else {
        cb(new Error('Only PDF, Office documents, text files and images are allowed'));
      }
    },
    limits: {
      fileSize: 10 * 1024 * 1024 // 10MB limit
    }
  });

  app.post("/api/portal/:token/submit", portalUpload.single('document'), async (req: Request, res: Response) => {
    try {
      const accessToken = req.params.token;
      const file = req.file;
      
      if (!file) {
        return res.status(400).json({ message: "No document uploaded" });
      }
      
      const portalToken = await storage.validatePortalToken(accessToken);
      if (!portalToken) {
        // Remove uploaded file if token is invalid
        try {
          await fs.unlink(file.path);
        } catch (err) {
          console.warn("Could not remove invalid upload:", file.path);
        }
        return res.status(404).json({ message: "Invalid or expired access token" });
      }
      
      // Check allowed actions
      const allowedActions = JSON.parse(portalToken.allowedActions || '{}');
      if (!allowedActions.upload) {
        try {
          await fs.unlink(file.path);
        } catch (err) {
          console.warn("Could not remove unauthorized upload:", file.path);
        }
        return res.status(403).json({ message: "Document upload not permitted for this portal" });
      }
      
      // Create submission record
      const submission = await storage.createExternalDocumentSubmission({
        portalTokenId: portalToken.id,
        targetCompanyId: portalToken.targetCompanyId,
        targetContactId: portalToken.targetContactId,
        originalFilename: file.originalname,
        storedFilename: file.filename,
        filePath: file.path,
        fileSize: file.size,
        fileType: file.mimetype,
        documentCategory: req.body.document_category || 'general',
        submissionNotes: req.body.submission_notes || null,
        submissionIp: req.ip,
        submissionUserAgent: req.get('User-Agent'),
        documentRequirementId: req.body.requirement_id ? parseInt(req.body.requirement_id) : null,
      });

      // Also create a document in the main document management system for integration
      try {
        console.log('Attempting portal-to-main integration for:', file.originalname);
        
        // Use the storage interface to create the document in main system
        const mainDocument = await storage.createDocument({
          targetCompanyId: portalToken.targetCompanyId,
          uploadedBy: 1, // System user for portal submissions
          documentName: file.originalname,
          originalFilename: file.originalname,
          filePath: file.path,
          fileSize: file.size,
          fileType: file.mimetype,
          documentCategory: req.body.document_category || 'General',
          description: `Submitted via external portal${req.body.submission_notes ? ': ' + req.body.submission_notes : ''}`,
          isConfidential: false,
        });
        
        console.log('✅ SUCCESS: Portal document integrated into main system! Document ID:', mainDocument.id);
        
        // Auto-approve the submission since it integrated successfully
        await storage.reviewDocumentSubmission(
          submission.id, 
          portalToken.createdBy, 
          'approved', 
          'Auto-approved upon successful integration to main document system'
        );
        
        // Send notification email to deal team about new document
        try {
          const contact = await storage.getTargetContact(portalToken.targetContactId, portalToken.userCompanyId);
          const targetCompany = await storage.getTargetCompany(portalToken.targetCompanyId, portalToken.userCompanyId);
          const dealTeamEmails = await storage.getDealTeamEmails(portalToken.targetCompanyId);
          
          if (contact && targetCompany && dealTeamEmails.length > 0) {
            await emailService.sendDocumentReceivedNotification(
              dealTeamEmails,
              contact.fullName || contact.email,
              targetCompany.companyName,
              file.originalname,
              req.body.document_category || 'General',
              req.body.submission_notes
            );
          }
        } catch (emailError) {
          console.warn('Failed to send document notification email:', emailError);
        }
        
      } catch (integrationError: any) {
        console.error('❌ FAILED: Portal integration error:', integrationError?.message || 'Unknown error');
        console.error('Full error:', integrationError);
        // Continue anyway - portal submission is still valid
      }
      
      // Log activity
      await storage.logPortalActivity({
        portalTokenId: portalToken.id,
        targetContactId: portalToken.targetContactId,
        activityType: "document_submitted",
        activityDescription: `Document submitted: ${file.originalname}`,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        relatedDocumentId: submission.id,
      });
      
      res.json({
        success: true,
        submissionId: submission.id,
        message: "Document submitted successfully",
        filename: file.originalname,
      });
    } catch (error) {
      console.error("Portal document submission error:", error);
      
      // Clean up uploaded file on error
      if (req.file) {
        try {
          await fs.unlink(req.file.path);
        } catch (err) {
          console.warn("Could not remove file after error:", req.file.path);
        }
      }
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get portal submissions history (public endpoint)
  app.get("/api/portal/:token/submissions", async (req: Request, res: Response) => {
    try {
      const accessToken = req.params.token;
      
      const portalToken = await storage.validatePortalToken(accessToken);
      if (!portalToken) {
        return res.status(404).json({ message: "Invalid or expired access token" });
      }
      
      const submissions = await storage.getPortalSubmissions(portalToken.id);
      
      // Log activity
      await storage.logPortalActivity({
        portalTokenId: portalToken.id,
        targetContactId: portalToken.targetContactId,
        activityType: "submissions_viewed",
        activityDescription: "Submission history viewed",
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });
      
      // Return submissions without sensitive server paths
      const sanitizedSubmissions = submissions.map(submission => ({
        id: submission.id,
        originalFilename: submission.originalFilename,
        fileSize: submission.fileSize,
        fileType: submission.fileType,
        documentCategory: submission.documentCategory,
        submissionNotes: submission.submissionNotes,
        submittedAt: submission.submittedAt,
        processingStatus: submission.processingStatus,
        reviewNotes: submission.reviewNotes,
        reviewedAt: submission.reviewedAt,
      }));
      
      res.json(sanitizedSubmissions);
    } catch (error) {
      console.error("Get portal submissions error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Create portal access token (authenticated endpoint)
  app.post("/api/portal/create-token", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId;
      const userCompanyId = req.session.userCompanyId;
      
      if (!userId || !userCompanyId) {
        return res.status(401).json({ message: "User not authenticated" });
      }
      
      const tokenSchema = z.object({
        targetCompanyId: z.number(),
        targetContactId: z.number(),
        tokenPurpose: z.string().default("document_submission"),
        expiresInDays: z.number().min(1).max(90).default(30),
        allowedActions: z.object({
          upload: z.boolean().default(true),
          download: z.boolean().default(false),
          message: z.boolean().default(true),
        }).default({ upload: true, download: false, message: true }),
        customMessage: z.string().optional(),
        portalBranding: z.object({
          companyName: z.string().optional(),
          logoUrl: z.string().optional(),
          primaryColor: z.string().optional(),
        }).optional(),
      });
      
      const tokenData = tokenSchema.parse(req.body);
      
      // Verify user has access to the target company
      const company = await storage.getTargetCompany(tokenData.targetCompanyId, userCompanyId);
      if (!company) {
        return res.status(404).json({ message: "Target company not found or access denied" });
      }
      
      // Generate unique access token
      const accessToken = randomUUID() + '-' + randomUUID();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + tokenData.expiresInDays);
      
      const portalToken = await storage.createPortalAccessToken({
        targetCompanyId: tokenData.targetCompanyId,
        targetContactId: tokenData.targetContactId,
        userCompanyId,
        accessToken,
        tokenPurpose: tokenData.tokenPurpose,
        expiresAt,
        createdBy: userId,
        allowedActions: JSON.stringify(tokenData.allowedActions),
        customMessage: tokenData.customMessage || null,
        portalBranding: tokenData.portalBranding ? JSON.stringify(tokenData.portalBranding) : null,
      });
      
      const portalUrl = `${req.protocol}://${req.get('host')}/portal/${portalToken.accessToken}`;
      
      // Send portal access email if contact email is available
      try {
        const contact = await storage.getTargetContact(tokenData.targetContactId, tokenData.userCompanyId);
        const targetCompany = await storage.getTargetCompany(tokenData.targetCompanyId, tokenData.userCompanyId);
        
        if (contact?.email && targetCompany) {
          await emailService.sendPortalAccessLink(
            contact.email,
            contact.fullName || contact.email,
            targetCompany.companyName,
            portalUrl,
            tokenData.customMessage,
            portalToken.expiresAt || undefined
          );
        }
      } catch (emailError) {
        console.warn('Failed to send portal access email:', emailError);
      }

      res.json({
        success: true,
        tokenId: portalToken.id,
        accessToken: portalToken.accessToken,
        portalUrl,
        expiresAt: portalToken.expiresAt,
      });
    } catch (error) {
      console.error("Create portal token error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Deactivate portal token (authenticated endpoint)
  app.post("/api/portal/deactivate/:tokenId", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId;
      const userCompanyId = req.session.userCompanyId;
      const tokenId = parseInt(req.params.tokenId);
      
      if (!userId || !userCompanyId) {
        return res.status(401).json({ message: "User not authenticated" });
      }
      
      if (isNaN(tokenId)) {
        return res.status(400).json({ message: "Invalid token ID" });
      }
      
      const deactivated = await storage.deactivatePortalToken(tokenId);
      if (!deactivated) {
        return res.status(404).json({ message: "Portal token not found" });
      }
      
      res.json({ success: true, message: "Portal token deactivated" });
    } catch (error) {
      console.error("Deactivate portal token error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Review portal submission (authenticated endpoint)
  app.post("/api/portal/review/:submissionId", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId;
      const userCompanyId = req.session.userCompanyId;
      const submissionId = parseInt(req.params.submissionId);
      
      if (!userId || !userCompanyId) {
        return res.status(401).json({ message: "User not authenticated" });
      }
      
      if (isNaN(submissionId)) {
        return res.status(400).json({ message: "Invalid submission ID" });
      }
      
      const reviewSchema = z.object({
        status: z.enum(["approved", "rejected", "needs_revision"]),
        notes: z.string().optional(),
      });
      
      const reviewData = reviewSchema.parse(req.body);
      
      const reviewed = await storage.reviewDocumentSubmission(
        submissionId, 
        userId, 
        reviewData.status, 
        reviewData.notes
      );
      
      if (!reviewed) {
        return res.status(404).json({ message: "Submission not found" });
      }
      
      res.json({ 
        success: true, 
        message: "Submission reviewed successfully",
        status: reviewData.status 
      });
    } catch (error) {
      console.error("Review portal submission error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get portal tokens (authenticated endpoint)
  app.get("/api/portal/tokens", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userCompanyId = req.session.userCompanyId;
      
      if (!userCompanyId) {
        return res.status(401).json({ message: "User not authenticated" });
      }
      
      // This would need a new storage method - for now return empty array
      res.json([]);
    } catch (error) {
      console.error("Get portal tokens error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get contacts by company (authenticated endpoint)
  app.get("/api/target-companies/contacts/:companyId", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userCompanyId = req.session.userCompanyId;
      const targetCompanyId = parseInt(req.params.companyId);
      
      if (!userCompanyId) {
        return res.status(401).json({ message: "User not authenticated" });
      }
      
      if (isNaN(targetCompanyId)) {
        return res.status(400).json({ message: "Invalid company ID" });
      }
      
      const contacts = await storage.getContactsByCompany(targetCompanyId, userCompanyId);
      res.json(contacts || []);
    } catch (error) {
      console.error("Get contacts by company error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Add email test endpoint
  app.post("/api/email/test", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const testResult = await emailService.testConnection();
      res.json({ 
        success: testResult, 
        message: testResult ? "Email connection successful" : "Email connection failed" 
      });
    } catch (error) {
      console.error("Email test error:", error);
      res.status(500).json({ message: "Email test failed", error: String(error) });
    }
  });

  // Webhook endpoint to receive website analysis results (public endpoint)
  app.post("/api/webhook/website-analysis", async (req: Request, res: Response) => {
    try {
      const webhookSchema = z.object({
        target_company_id: z.number(),
        output: z.string(), // Markdown content from webhook
      });

      const validatedData = webhookSchema.parse(req.body);
      
      // Update target company with website analysis
      const updated = await storage.updateTargetCompanyWebsiteAnalysis(
        validatedData.target_company_id,
        validatedData.output
      );

      if (!updated) {
        console.error(`Failed to update website analysis for target company ID: ${validatedData.target_company_id}`);
        return res.status(404).json({ message: "Target company not found" });
      }

      console.log(`Website analysis updated for target company ID: ${validatedData.target_company_id}`);
      res.json({ success: true, message: "Website analysis stored successfully" });
    } catch (error) {
      console.error("Webhook website analysis error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
