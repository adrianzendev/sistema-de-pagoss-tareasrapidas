import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import bcrypt from "bcrypt";
import { storage } from "./storage";
import { insertUserSchema, insertCurrencySchema, insertPaymentSchema, createTutorSchema, insertBlacklistSchema, insertWeekSchema, insertAgencySettingsSchema, insertClientSchema, normalizePhone } from "@shared/schema";
import { z } from "zod";
import { db } from "./db";
import { users, currencies, payments } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import { getVapidPublicKey, notifyPaymentStatusChange, notifyNewPaymentRequest } from "./push";

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

async function requireVerifier(req: Request, res: Response, next: () => void) {
  if (!req.session.userId) {
    return res.status(401).json({ message: "No autorizado" });
  }
  const user = await storage.getUser(req.session.userId);
  if (!user || user.role !== "verifier") {
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
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
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
    const period = req.query.period as string || "all";
    const stats = await storage.getAdminStats(period);
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

  // Admin: Verifiers
  app.get("/api/admin/verifiers", requireAdmin, async (req, res) => {
    const verifiers = await storage.getVerifiers();
    res.json(verifiers.map(({ password, ...v }) => v));
  });

  app.post("/api/admin/verifiers", requireAdmin, async (req, res) => {
    try {
      const { name, email, password: rawPassword } = req.body;
      if (!name || !email || !rawPassword) {
        return res.status(400).json({ message: "Nombre, email y contraseña son requeridos" });
      }
      const username = email.split("@")[0].toLowerCase().replace(/[^a-z0-9.]/g, "");
      const existing = await storage.getUserByUsername(username);
      if (existing) {
        return res.status(400).json({ message: "Ya existe un usuario con este email" });
      }
      const hashedPassword = await bcrypt.hash(rawPassword, 10);
      const verifier = await storage.createVerifier({
        name,
        email,
        password: hashedPassword,
        username,
        role: "verifier",
        commissionPercent: "0",
      });
      const { password, ...safeVerifier } = verifier;
      res.status(201).json(safeVerifier);
    } catch (error) {
      console.error("Error creating verifier:", error);
      res.status(500).json({ message: "Error al crear verificador" });
    }
  });

  app.patch("/api/admin/verifiers/:id", requireAdmin, async (req, res) => {
    try {
      const { name, email, password: rawPassword } = req.body;
      const updateData: any = {};
      if (name) updateData.name = name;
      if (email) updateData.email = email;
      if (rawPassword) updateData.password = await bcrypt.hash(rawPassword, 10);
      const [updated] = await db.update(users).set(updateData).where(eq(users.id, req.params.id)).returning();
      if (!updated) return res.status(404).json({ message: "Verificador no encontrado" });
      const { password, ...safe } = updated;
      res.json(safe);
    } catch (error) {
      console.error("Error updating verifier:", error);
      res.status(500).json({ message: "Error al actualizar verificador" });
    }
  });

  app.delete("/api/admin/verifiers/:id", requireAdmin, async (req, res) => {
    await storage.deleteVerifier(req.params.id);
    res.status(204).send();
  });

  // Admin: Payments
  app.get("/api/admin/payments", requireAdmin, async (req, res) => {
    const period = req.query.period as string || "all";
    const payments = await storage.getPayments(period);
    res.json(payments);
  });

  app.patch("/api/admin/payments/:id", requireAdmin, async (req, res) => {
    const { status, notes } = req.body;
    if (!["verified", "rejected", "refunded"].includes(status)) {
      return res.status(400).json({ message: "Estado inválido" });
    }
    const payment = await storage.updatePaymentStatus(req.params.id, status, req.session.userId!, notes);
    if (payment && (status === "verified" || status === "rejected")) {
      const currency = await storage.getCurrency(payment.currencyId);
      notifyPaymentStatusChange(payment.tutorId, status, payment.amount, currency?.code || "").catch(console.error);
    }
    res.json(payment);
  });

  app.get("/api/admin/payments/export", requireAdmin, async (req, res) => {
    const period = req.query.period as string || "all";
    const allPayments = await storage.getPayments(period);
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
    res.setHeader("Content-Disposition", `attachment; filename="pagos_${period}.csv"`);
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
      if (data.verifierId === "") data.verifierId = null;
      if (data.verifierId) {
        const verifier = await storage.getUser(data.verifierId);
        if (!verifier || verifier.role !== "verifier") {
          return res.status(400).json({ message: "Verificador inválido" });
        }
      }
      const currency = await storage.createCurrency(data);
      res.status(201).json(currency);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("Error creating currency:", error);
      res.status(500).json({ message: "Error al crear divisa" });
    }
  });

  app.patch("/api/admin/currencies/:id", requireAdmin, async (req, res) => {
    try {
      const data = insertCurrencySchema.partial().parse(req.body);
      if (data.verifierId === "") data.verifierId = null;
      if (data.verifierId) {
        const verifier = await storage.getUser(data.verifierId);
        if (!verifier || verifier.role !== "verifier") {
          return res.status(400).json({ message: "Verificador inválido" });
        }
      }
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

  // Admin: Blacklist
  app.get("/api/admin/blacklist", requireAdmin, async (req, res) => {
    const entries = await storage.getBlacklist();
    res.json(entries);
  });

  app.post("/api/admin/blacklist", requireAdmin, async (req, res) => {
    try {
      const data = insertBlacklistSchema.parse(req.body);
      const existing = await storage.getBlacklistByClient(data.clientNumber);
      if (existing) {
        return res.status(400).json({ message: "Este cliente ya está en la lista negra" });
      }
      const entry = await storage.createBlacklistEntry(data);
      res.status(201).json(entry);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(500).json({ message: "Error al agregar a lista negra" });
    }
  });

  app.patch("/api/admin/blacklist/:id", requireAdmin, async (req, res) => {
    try {
      const data = insertBlacklistSchema.partial().parse(req.body);
      const entry = await storage.updateBlacklistEntry(req.params.id, data);
      res.json(entry);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(500).json({ message: "Error al actualizar entrada" });
    }
  });

  app.delete("/api/admin/blacklist/:id", requireAdmin, async (req, res) => {
    await storage.deleteBlacklistEntry(req.params.id);
    res.status(204).send();
  });

  // Check if client is blacklisted (for tutors) - uses normalized phone comparison
  app.get("/api/blacklist/check/:clientNumber", requireAuth, async (req, res) => {
    const normalized = normalizePhone(req.params.clientNumber);
    const entry = await storage.getBlacklistByNormalizedPhone(normalized);
    res.json({ blacklisted: !!entry, reason: entry?.reason });
  });

  // Admin: Clients
  app.get("/api/admin/clients", requireAdmin, async (req, res) => {
    const allClients = await storage.getClients();
    res.json(allClients);
  });

  app.post("/api/admin/clients", requireAdmin, async (req, res) => {
    try {
      const { phoneNumber, name } = req.body;
      const normalized = normalizePhone(phoneNumber);
      const existing = await storage.getClientByNormalizedPhone(normalized);
      if (existing) {
        return res.status(400).json({ message: "Este número ya está registrado" });
      }
      const client = await storage.createClient({ phoneNumber, normalizedPhone: normalized, name });
      res.status(201).json(client);
    } catch (error) {
      console.error("Error creating client:", error);
      res.status(500).json({ message: "Error al crear cliente" });
    }
  });

  app.patch("/api/admin/clients/:id", requireAdmin, async (req, res) => {
    try {
      const { phoneNumber, name } = req.body;
      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (phoneNumber) {
        updateData.phoneNumber = phoneNumber;
        updateData.normalizedPhone = normalizePhone(phoneNumber);
      }
      const client = await storage.updateClient(req.params.id, updateData);
      res.json(client);
    } catch (error) {
      res.status(500).json({ message: "Error al actualizar cliente" });
    }
  });

  app.delete("/api/admin/clients/:id", requireAdmin, async (req, res) => {
    await storage.deleteClient(req.params.id);
    res.status(204).send();
  });

  // Clients search (for tutors - combobox)
  app.get("/api/clients/search", requireAuth, async (req, res) => {
    const query = (req.query.q as string) || "";
    const results = await storage.searchClients(query);
    res.json(results);
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
      const normalized = normalizePhone(data.clientNumber);
      if (normalized) {
        const existingClient = await storage.getClientByNormalizedPhone(normalized);
        if (!existingClient) {
          await storage.createClient({
            phoneNumber: data.clientNumber,
            normalizedPhone: normalized,
          });
        }
      }
      const payment = await storage.createPayment(data);
      const currency = await storage.getCurrency(data.currencyId);
      notifyNewPaymentRequest(user.name, data.amount, currency?.code || "").catch(console.error);
      res.status(201).json(payment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(500).json({ message: "Error al crear pago" });
    }
  });

  // Admin: Weeks Management
  app.get("/api/admin/weeks", requireAdmin, async (req, res) => {
    const allWeeks = await storage.getWeeks();
    res.json(allWeeks);
  });

  app.get("/api/admin/weeks/current", requireAdmin, async (req, res) => {
    const week = await storage.getCurrentWeek();
    res.json(week);
  });

  app.post("/api/admin/weeks", requireAdmin, async (req, res) => {
    try {
      const data = insertWeekSchema.parse(req.body);
      const existing = await storage.getWeekByNumber(data.weekNumber);
      if (existing) {
        return res.status(400).json({ message: "Ya existe una semana con este número" });
      }
      const week = await storage.createWeek(data);
      res.status(201).json(week);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(500).json({ message: "Error al crear semana" });
    }
  });

  app.post("/api/admin/weeks/generate", requireAdmin, async (req, res) => {
    try {
      const settings = await storage.getAgencySettings();
      let nextWeekNumber = settings?.currentWeekNumber ?? 166;
      
      const existingWeeks = await storage.getWeeks();
      if (existingWeeks.length > 0) {
        nextWeekNumber = Math.max(...existingWeeks.map(w => w.weekNumber)) + 1;
      }

      const now = new Date();
      const dayOfWeek = now.getDay();
      const sunday = new Date(now);
      sunday.setDate(now.getDate() - dayOfWeek);
      sunday.setHours(0, 0, 0, 0);
      
      const saturday = new Date(sunday);
      saturday.setDate(sunday.getDate() + 6);
      
      const startDate = sunday.toISOString().split('T')[0];
      const endDate = saturday.toISOString().split('T')[0];

      const existing = await storage.getWeekByNumber(nextWeekNumber);
      if (existing) {
        return res.status(400).json({ message: "La semana actual ya existe" });
      }

      const week = await storage.createWeek({
        weekNumber: nextWeekNumber,
        startDate,
        endDate,
        status: "open",
        advertisingCost: "0",
      });

      res.status(201).json(week);
    } catch (error) {
      res.status(500).json({ message: "Error al generar semana" });
    }
  });

  app.patch("/api/admin/weeks/:id", requireAdmin, async (req, res) => {
    try {
      const data = insertWeekSchema.partial().parse(req.body);
      const week = await storage.updateWeek(req.params.id, data);
      res.json(week);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(500).json({ message: "Error al actualizar semana" });
    }
  });

  app.delete("/api/admin/weeks/:id", requireAdmin, async (req, res) => {
    await storage.deleteWeek(req.params.id);
    res.status(204).send();
  });

  // Admin: Week Settlement (liquidation)
  app.get("/api/admin/weeks/:id/settlement", requireAdmin, async (req, res) => {
    try {
      const week = await storage.getWeek(req.params.id);
      if (!week) {
        return res.status(404).json({ message: "Semana no encontrada" });
      }

      const settings = await storage.getAgencySettings();
      const agencyPercent = Number(settings?.agencyPercent ?? 30);
      const tutorPercent = Number(settings?.tutorPercent ?? 70);
      const advertisingCost = Number(week.advertisingCost ?? 0);

      const weekPayments = await storage.getPaymentsByWeek(week.id);
      const verifiedPayments = weekPayments.filter(p => p.status === "verified");
      const allCurrencies = await storage.getCurrencies();
      const tutors = await storage.getTutors();

      const tutorsWithPayments = tutors.filter(tutor => 
        verifiedPayments.some(p => p.tutorId === tutor.id)
      );
      const activeTutorCount = tutorsWithPayments.length || 1;
      const advertisingPerTutor = advertisingCost / activeTutorCount;

      const settlements = tutors.map(tutor => {
        const tutorPayments = verifiedPayments.filter(p => p.tutorId === tutor.id);
        
        let grossIncome = 0;
        tutorPayments.forEach(p => {
          const currency = allCurrencies.find(c => c.id === p.currencyId);
          const rate = Number(currency?.exchangeRate ?? 1);
          grossIncome += Number(p.amount) * rate;
        });

        const tutorAdvertisingShare = tutorPayments.length > 0 ? advertisingPerTutor : 0;
        
        const netIncome = grossIncome - tutorAdvertisingShare;
        const tutorEarnings = netIncome * (tutorPercent / 100);
        const agencyEarnings = netIncome * (agencyPercent / 100);

        return {
          week,
          tutorId: tutor.id,
          tutorName: tutor.name,
          grossIncome,
          advertisingCost: tutorAdvertisingShare,
          tutorAdvertisingShare,
          agencyAdvertisingShare: 0,
          netIncome,
          tutorEarnings,
          agencyEarnings,
          payments: tutorPayments,
        };
      }).filter(s => s.payments.length > 0 || s.grossIncome > 0);

      const totals = {
        grossIncome: settlements.reduce((sum, s) => sum + s.grossIncome, 0),
        advertisingCost,
        netIncome: settlements.reduce((sum, s) => sum + s.netIncome, 0),
        tutorEarnings: settlements.reduce((sum, s) => sum + s.tutorEarnings, 0),
        agencyEarnings: settlements.reduce((sum, s) => sum + s.agencyEarnings, 0),
      };

      res.json({ week, settlements, totals, settings: { agencyPercent, tutorPercent } });
    } catch (error) {
      console.error("Error getting settlement:", error);
      res.status(500).json({ message: "Error al obtener liquidación" });
    }
  });

  // Admin: Agency Settings
  app.get("/api/admin/settings", requireAdmin, async (req, res) => {
    let settings = await storage.getAgencySettings();
    if (!settings) {
      settings = await storage.updateAgencySettings({
        agencyPercent: "30",
        tutorPercent: "70",
        currentWeekNumber: 166,
      });
    }
    res.json(settings);
  });

  app.patch("/api/admin/settings", requireAdmin, async (req, res) => {
    try {
      const data = insertAgencySettingsSchema.partial().parse(req.body);
      const settings = await storage.updateAgencySettings(data);
      res.json(settings);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(500).json({ message: "Error al actualizar configuración" });
    }
  });

  // Tutor: Weekly Settlement View
  app.get("/api/tutor/settlement", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user || user.role !== "tutor") {
        return res.status(403).json({ message: "Acceso denegado" });
      }

      const allWeeks = await storage.getWeeks();
      const settings = await storage.getAgencySettings();
      const agencyPercent = Number(settings?.agencyPercent ?? 30);
      const tutorPercent = Number(settings?.tutorPercent ?? 70);
      const allCurrencies = await storage.getCurrencies();
      const tutors = await storage.getTutors();

      const weeklySettlements = await Promise.all(
        allWeeks.slice(0, 12).map(async (week) => {
          const weekPayments = await storage.getPaymentsByWeek(week.id);
          const verifiedPayments = weekPayments.filter(p => p.status === "verified");
          const tutorPayments = verifiedPayments.filter(p => p.tutorId === user.id);
          const advertisingCost = Number(week.advertisingCost ?? 0);
          
          const tutorsWithPayments = new Set(verifiedPayments.map(p => p.tutorId));
          const activeTutorCount = tutorsWithPayments.size || 1;
          const advertisingPerTutor = advertisingCost / activeTutorCount;

          let grossIncome = 0;
          tutorPayments.forEach(p => {
            const currency = allCurrencies.find(c => c.id === p.currencyId);
            const rate = Number(currency?.exchangeRate ?? 1);
            grossIncome += Number(p.amount) * rate;
          });

          const tutorAdvertisingShare = tutorPayments.length > 0 ? advertisingPerTutor : 0;
          
          const netIncome = grossIncome - tutorAdvertisingShare;
          const tutorEarnings = netIncome * (tutorPercent / 100);
          const agencyEarnings = netIncome * (agencyPercent / 100);

          return {
            week,
            tutorId: user.id,
            tutorName: user.name,
            grossIncome,
            advertisingCost: tutorAdvertisingShare,
            tutorAdvertisingShare,
            agencyAdvertisingShare: 0,
            netIncome,
            tutorEarnings,
            agencyEarnings,
            payments: tutorPayments,
          };
        })
      );

      res.json({ 
        settlements: weeklySettlements,
        settings: { agencyPercent, tutorPercent }
      });
    } catch (error) {
      console.error("Error getting tutor settlement:", error);
      res.status(500).json({ message: "Error al obtener liquidación" });
    }
  });

  // Public: Get all weeks (for authenticated users)
  app.get("/api/weeks", requireAuth, async (req, res) => {
    const weeks = await storage.getWeeks();
    res.json(weeks);
  });

  // Public: Generate new week (for authenticated users)
  app.post("/api/weeks/generate", requireAuth, async (req, res) => {
    try {
      const settings = await storage.getAgencySettings();
      const existingWeeks = await storage.getWeeks();
      
      let newWeekNumber = settings?.currentWeekNumber ?? 166;
      let startDate: Date;
      let endDate: Date;

      if (existingWeeks.length > 0) {
        // Find the latest week by week number
        const latestWeek = existingWeeks.reduce((max, w) => 
          w.weekNumber > max.weekNumber ? w : max, existingWeeks[0]);
        newWeekNumber = latestWeek.weekNumber + 1;
        
        // New week starts the day after the latest week ends
        startDate = new Date(latestWeek.endDate + "T00:00:00");
        startDate.setDate(startDate.getDate() + 1);
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6);
      } else {
        // First week: use current week (Sunday to Saturday)
        const today = new Date();
        const dayOfWeek = today.getDay();
        startDate = new Date(today);
        startDate.setDate(today.getDate() - dayOfWeek);
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6);
      }

      const week = await storage.createWeek({
        weekNumber: newWeekNumber,
        startDate: startDate.toISOString().split("T")[0],
        endDate: endDate.toISOString().split("T")[0],
        status: "open",
        advertisingCost: "0",
      });

      res.status(201).json(week);
    } catch (error) {
      console.error("Error generating week:", error);
      res.status(500).json({ message: "Error al generar semana" });
    }
  });

  // Public: Get current week
  app.get("/api/weeks/current", requireAuth, async (req, res) => {
    const week = await storage.getCurrentWeek();
    res.json(week);
  });

  // Push notification routes
  app.get("/api/push/vapid-key", (req, res) => {
    res.json({ publicKey: getVapidPublicKey() });
  });

  app.post("/api/push/subscribe", requireAuth, async (req, res) => {
    try {
      const { endpoint, keys } = req.body;
      if (!endpoint || !keys?.p256dh || !keys?.auth) {
        return res.status(400).json({ message: "Datos de suscripción inválidos" });
      }
      await storage.savePushSubscription({
        userId: req.session.userId!,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
      });
      res.json({ message: "Suscripción guardada" });
    } catch (error) {
      console.error("Error saving push subscription:", error);
      res.status(500).json({ message: "Error al guardar suscripción" });
    }
  });

  app.post("/api/push/unsubscribe", requireAuth, async (req, res) => {
    try {
      const { endpoint } = req.body;
      if (endpoint) {
        await storage.deletePushSubscription(endpoint);
      }
      res.json({ message: "Suscripción eliminada" });
    } catch (error) {
      res.status(500).json({ message: "Error al eliminar suscripción" });
    }
  });

  // Verifier routes
  app.get("/api/verifier/payments", requireVerifier, async (req, res) => {
    const verifierPayments = await storage.getPaymentsByVerifier(req.session.userId!);
    res.json(verifierPayments);
  });

  app.patch("/api/verifier/payments/:id", requireVerifier, async (req, res) => {
    const { status, notes } = req.body;
    if (!["verified", "rejected"].includes(status)) {
      return res.status(400).json({ message: "Estado inválido" });
    }
    const verifierPayments = await storage.getPaymentsByVerifier(req.session.userId!);
    const ownsPayment = verifierPayments.some(p => p.id === req.params.id);
    if (!ownsPayment) {
      return res.status(403).json({ message: "No tienes permiso para modificar este pago" });
    }
    const payment = await storage.updatePaymentStatus(req.params.id, status, req.session.userId!, notes);
    if (payment && (status === "verified" || status === "rejected")) {
      const currency = await storage.getCurrency(payment.currencyId);
      notifyPaymentStatusChange(payment.tutorId, status, payment.amount, currency?.code || "").catch(console.error);
    }
    res.json(payment);
  });

  return httpServer;
}
