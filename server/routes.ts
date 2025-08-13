import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import bcrypt from "bcrypt";
import session from "express-session";
import { randomUUID } from "crypto";
import { z } from "zod";
import { insertUserSchema, insertUserCompanySchema, insertTargetCompanySchema } from "@shared/schema";
import connectPg from "connect-pg-simple";

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

      res.json({
        targetCompanies: targetCompanyCount,
        activeDeals: 0, // Placeholder for future implementation
        totalContacts: 0, // Placeholder for future implementation
        dealValue: "0", // Placeholder for future implementation
      });
    } catch (error) {
      console.error("Dashboard stats error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Target Company Management Routes
  const targetCompanyCreateSchema = insertTargetCompanySchema.omit({
    userCompanyId: true,
    createdBy: true,
  });

  // Create target company
  app.post("/api/target-companies", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const userCompanyId = req.session.userCompanyId;
      
      if (!userCompanyId) {
        return res.status(400).json({ message: "User company not found" });
      }

      const validatedData = targetCompanyCreateSchema.parse(req.body);

      const targetCompany = await storage.createTargetCompany({
        ...validatedData,
        userCompanyId,
        createdBy: userId,
      });

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

      const validatedData = targetCompanyCreateSchema.partial().parse(req.body);

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

  const httpServer = createServer(app);
  return httpServer;
}
