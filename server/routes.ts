import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import bcrypt from "bcrypt";
import { storage } from "./storage";
import { insertUserSchema, insertCurrencySchema, insertPaymentSchema, createTutorSchema } from "@shared/schema";
import { z } from "zod";
import { db } from "./db";
import { users, currencies, payments } from "@shared/schema";
import { eq, sql } from "drizzle-orm";

declare module "express-session" {
  interface SessionData {
    userId?: string;
  }
}

function requireAuth(req: Request, res: Response, next: () => void) {
  if (!req.session.userId) {
    return res.status(401).json({ message: "No autorizado" });
  }
  next();
}

async function requireAdmin(req: Request, res: Response, next: () => void) {
  if (!req.session.userId) {
    return res.status(401).json({ message: "No autorizado" });
  }
  const user = await storage.getUser(req.session.userId);
  if (!user || user.role !== "admin") {
    return res.status(403).json({ message: "Acceso denegado" });
  }
  next();
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  // Session middleware
  app.use(
    session({
      secret: process.env.SESSION_SECRET || "fallback-secret-key",
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      },
    })
  );

  // Auth routes
  app.get("/api/auth/me", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "No autenticado" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user) {
      return res.status(401).json({ message: "Usuario no encontrado" });
    }
    const { password, ...safeUser } = user;
    res.json(safeUser);
  });

  app.post("/api/auth/login", async (req, res) => {
    const { username, password } = req.body;
    const user = await storage.getUserByUsername(username);
    if (!user) {
      return res.status(401).json({ message: "Credenciales inválidas" });
    }
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ message: "Credenciales inválidas" });
    }
    req.session.userId = user.id;
    const { password: _, ...safeUser } = user;
    res.json(safeUser);
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Error al cerrar sesión" });
      }
      res.json({ message: "Sesión cerrada" });
    });
  });

  // Admin: Stats
  app.get("/api/admin/stats", requireAdmin, async (req, res) => {
    const stats = await storage.getAdminStats();
    res.json(stats);
  });

  // Admin: Tutors
  app.get("/api/admin/tutors", requireAdmin, async (req, res) => {
    const tutors = await storage.getTutors();
    res.json(tutors.map(({ password, ...t }) => t));
  });

  app.post("/api/admin/tutors", requireAdmin, async (req, res) => {
    try {
      const validatedData = createTutorSchema.parse(req.body);
      const username = validatedData.email.split("@")[0].toLowerCase().replace(/[^a-z0-9.]/g, "");
      const existing = await storage.getUserByUsername(username);
      if (existing) {
        return res.status(400).json({ message: "Ya existe un tutor con este email" });
      }
      const hashedPassword = await bcrypt.hash(validatedData.password, 10);
      const tutor = await storage.createUser({ 
        ...validatedData, 
        username, 
        role: "tutor", 
        password: hashedPassword 
      });
      const { password, ...safeTutor } = tutor;
      res.status(201).json(safeTutor);
    } catch (error) {
      console.error("Error creating tutor:", error);
      if (error instanceof z.ZodError) {
        console.error("Zod errors:", JSON.stringify(error.errors, null, 2));
        return res.status(400).json({ message: error.errors[0].message, field: error.errors[0].path });
      }
      res.status(500).json({ message: "Error al crear tutor" });
    }
  });

  app.delete("/api/admin/tutors/:id", requireAdmin, async (req, res) => {
    await storage.deleteTutor(req.params.id);
    res.status(204).send();
  });

  // Admin: Payments
  app.get("/api/admin/payments", requireAdmin, async (req, res) => {
    const payments = await storage.getPayments();
    res.json(payments);
  });

  app.patch("/api/admin/payments/:id", requireAdmin, async (req, res) => {
    const { status } = req.body;
    if (!["verified", "rejected"].includes(status)) {
      return res.status(400).json({ message: "Estado inválido" });
    }
    const payment = await storage.updatePaymentStatus(req.params.id, status, req.session.userId!);
    res.json(payment);
  });

  app.get("/api/admin/payments/export", requireAdmin, async (req, res) => {
    const allPayments = await storage.getPayments();
    const csv = [
      "Fecha,Tutor,Email Tutor,Cliente,Monto,Divisa,Estado,Verificado Por,Fecha Verificación",
      ...allPayments.map((p) =>
        [
          p.createdAt?.toISOString().split("T")[0] ?? "",
          p.tutor?.name ?? "",
          p.tutor?.email ?? "",
          p.clientNumber,
          p.amount,
          p.currency?.code ?? "",
          p.status === "pending" ? "Pendiente" : p.status === "verified" ? "Verificado" : "Rechazado",
          p.verifier?.name ?? "",
          p.verifiedAt?.toISOString().split("T")[0] ?? "",
        ].join(",")
      ),
    ].join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", 'attachment; filename="pagos.csv"');
    res.send(csv);
  });

  // Admin: Currencies
  app.get("/api/currencies", requireAuth, async (req, res) => {
    const currencies = await storage.getCurrencies();
    res.json(currencies);
  });

  app.post("/api/admin/currencies", requireAdmin, async (req, res) => {
    try {
      const data = insertCurrencySchema.parse(req.body);
      const currency = await storage.createCurrency(data);
      res.status(201).json(currency);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(500).json({ message: "Error al crear divisa" });
    }
  });

  app.patch("/api/admin/currencies/:id", requireAdmin, async (req, res) => {
    try {
      const data = insertCurrencySchema.partial().parse(req.body);
      const currency = await storage.updateCurrency(req.params.id, data);
      res.json(currency);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(500).json({ message: "Error al actualizar divisa" });
    }
  });

  app.delete("/api/admin/currencies/:id", requireAdmin, async (req, res) => {
    await storage.deleteCurrency(req.params.id);
    res.status(204).send();
  });

  // Tutor: Payments
  app.get("/api/tutor/payments", requireAuth, async (req, res) => {
    const user = await storage.getUser(req.session.userId!);
    if (!user || user.role !== "tutor") {
      return res.status(403).json({ message: "Acceso denegado" });
    }
    const payments = await storage.getPaymentsByTutor(user.id);
    res.json(payments);
  });

  app.post("/api/tutor/payments", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user || user.role !== "tutor") {
        return res.status(403).json({ message: "Acceso denegado" });
      }
      const data = insertPaymentSchema.parse({ ...req.body, tutorId: user.id });
      const payment = await storage.createPayment(data);
      res.status(201).json(payment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(500).json({ message: "Error al crear pago" });
    }
  });

  return httpServer;
}
