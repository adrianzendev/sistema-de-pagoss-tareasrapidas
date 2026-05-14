import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import bcrypt from "bcrypt";
import { storage } from "./storage";
import { insertUserSchema, insertCurrencySchema, insertPaymentSchema, createTutorSchema, insertBlacklistSchema, insertWeekSchema, insertAgencySettingsSchema, insertClientSchema, normalizePhone } from "@shared/schema";
import { z } from "zod";
import { db, pool } from "./db";
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
  // Trust proxy for production (Replit reverse proxy)
  app.set("trust proxy", 1);

  // Session middleware with PostgreSQL store (survives server restarts)
  const PgSession = connectPgSimple(session);
  app.use(
    session({
      store: new PgSession({
        pool,
        createTableIfMissing: true,
        ttl: 30 * 24 * 60 * 60, // 30 days in seconds
      }),
      secret: process.env.SESSION_SECRET || "fallback-secret-key",
      resave: true,
      saveUninitialized: false,
      rolling: true, // Reset maxAge on every request
      cookie: {
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        sameSite: "lax",
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days in ms
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
    let user = await storage.getUserByUsername(username);
    if (!user) {
      user = await storage.getUserByEmail(username);
    }
    if (!user) {
      return res.status(401).json({ message: "Credenciales inválidas" });
    }
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ message: "Credenciales inválidas" });
    }
    req.session.userId = user.id;
    const { password: _, ...safeUser } = user;
    req.session.save((err) => {
      if (err) return res.status(500).json({ message: "Error al iniciar sesión" });
      res.json(safeUser);
    });
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

  app.patch("/api/admin/tutors/:id", requireAdmin, async (req, res) => {
    try {
      const { name, email, password: rawPassword, commissionPercent, advertisingCostUsd, isActive } = req.body;
      const existing = await storage.getUser(req.params.id);
      if (!existing) return res.status(404).json({ message: "Tutor no encontrado" });
      const updateData: any = {};
      if (name) updateData.name = name;
      if (email) updateData.email = email;
      if (commissionPercent !== undefined) updateData.commissionPercent = commissionPercent;
      if (advertisingCostUsd !== undefined) updateData.advertisingCostUsd = advertisingCostUsd;
      if (isActive !== undefined) updateData.isActive = isActive;
      if (rawPassword) updateData.password = await bcrypt.hash(rawPassword, 10);
      const [updated] = await db.update(users).set(updateData).where(eq(users.id, req.params.id)).returning();
      if (!updated) return res.status(404).json({ message: "Tutor no encontrado" });
      if (commissionPercent !== undefined && Number(commissionPercent) !== Number(existing.commissionPercent)) {
        storage.createActivityLog({
          type: "commission_change",
          description: `Comisión de ${updated.name} cambiada de ${existing.commissionPercent}% a ${commissionPercent}%`,
          tutorId: updated.id,
          performedBy: req.session.userId!,
          oldValue: String(existing.commissionPercent),
          newValue: String(commissionPercent),
        }).catch(console.error);
      }
      const { password, ...safe } = updated;
      res.json(safe);
    } catch (error) {
      console.error("Error updating tutor:", error);
      res.status(500).json({ message: "Error al actualizar tutor" });
    }
  });

  app.get("/api/admin/activity-log", requireAdmin, async (req, res) => {
    const log = await storage.getActivityLog();
    res.json(log);
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

  app.patch("/api/admin/payments/:id/move", requireAdmin, async (req, res) => {
    try {
      const { weekId } = req.body;
      if (!weekId) return res.status(400).json({ message: "weekId requerido" });
      const payment = await storage.movePaymentToWeek(req.params.id, weekId);
      if (!payment) return res.status(404).json({ message: "Pago no encontrado" });
      res.json(payment);
    } catch (error) {
      console.error("Error moving payment:", error);
      res.status(500).json({ message: "Error al mover pago" });
    }
  });

  app.delete("/api/admin/payments/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deletePayment(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting payment:", error);
      res.status(500).json({ message: "Error al eliminar pago" });
    }
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

  app.get("/api/admin/clients-stats", requireAdmin, async (req, res) => {
    try {
      const [allClients, allPayments] = await Promise.all([
        storage.getClients(),
        storage.getPayments("all"),
      ]);

      const clientStats = allClients.map((client) => {
        const clientPayments = allPayments.filter(
          (p) => normalizePhone(p.clientNumber) === client.normalizedPhone ||
            p.clientNumber === client.phoneNumber
        );

        const tutorMap = new Map<string, string>();
        clientPayments.forEach((p) => {
          if (p.tutor) tutorMap.set(p.tutor.id, p.tutor.name);
        });

        const sorted = [...clientPayments].sort(
          (a, b) => new Date(a.createdAt!).getTime() - new Date(b.createdAt!).getTime()
        );

        return {
          client,
          stats: {
            total: clientPayments.length,
            verified: clientPayments.filter((p) => p.status === "verified").length,
            rejected: clientPayments.filter((p) => p.status === "rejected").length,
            pending: clientPayments.filter((p) => p.status === "pending").length,
            tutors: Array.from(tutorMap, ([id, name]) => ({ id, name })),
            firstActivity: sorted[0]?.createdAt ?? null,
            lastActivity: sorted[sorted.length - 1]?.createdAt ?? null,
            payments: clientPayments.map((p) => ({
              id: p.id,
              amount: p.amount,
              currencyCode: p.currency?.code ?? "",
              status: p.status,
              tutorName: p.tutor?.name ?? "—",
              createdAt: p.createdAt,
              notes: p.notes,
            })),
          },
        };
      });

      res.json(clientStats);
    } catch (error) {
      console.error("Error getting client stats:", error);
      res.status(500).json({ message: "Error al obtener estadísticas de clientes" });
    }
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
      const currentWeek = await storage.getCurrentWeek();
      if (!currentWeek || currentWeek.status !== "open") {
        return res.status(400).json({ message: "No hay una semana abierta para la fecha actual. Solo puedes registrar pagos en la semana vigente." });
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
      notifyNewPaymentRequest(user.name, data.amount, currency?.code || "", currency?.verifierId).catch(console.error);
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
        sharedAdvertisingUsd: "0",
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
      const weekPayments = await storage.getPaymentsByWeek(week.id);
      const verifiedPayments = weekPayments.filter(p => p.status === "verified");
      const allCurrencies = await storage.getCurrencies();
      const tutors = await storage.getTutors();

      const usdCurrency = allCurrencies.find(c => c.code === "USD");
      const usdRate = Number(usdCurrency?.exchangeRate ?? 1);
      const sharedAdvertisingUsd = Number(week.sharedAdvertisingUsd ?? 0);
      const advertisingInSoles = sharedAdvertisingUsd * usdRate;

      const tutorsWithPayments = tutors.filter(tutor =>
        tutor.isActive && verifiedPayments.some(p => p.tutorId === tutor.id)
      );
      const activeTutorCount = tutorsWithPayments.length || 1;
      const tutorAdvertisingShare = (advertisingInSoles * 0.5) / activeTutorCount;

      const settlements = tutors.map(tutor => {
        const tutorPayments = verifiedPayments.filter(p => p.tutorId === tutor.id);

        let grossIncome = 0;
        tutorPayments.forEach(p => {
          const currency = allCurrencies.find(c => c.id === p.currencyId);
          const rate = Number(currency?.exchangeRate ?? 1);
          grossIncome += Number(p.amount) * rate;
        });

        const commission = Number(tutor.commissionPercent) / 100;
        const isActive = tutor.isActive !== false;
        const sharedAdvShare = (isActive && tutorPayments.length > 0) ? tutorAdvertisingShare : 0;
        const ownAdvUsd = Number(tutor.advertisingCostUsd ?? 0);
        const ownAdvShare = (isActive && tutorPayments.length > 0) ? ownAdvUsd * usdRate * 0.5 : 0;
        const totalAdvShare = sharedAdvShare + ownAdvShare;
        const netIncome = grossIncome * commission;
        const tutorEarnings = netIncome - totalAdvShare;
        const agencyEarnings = grossIncome * (1 - commission) - totalAdvShare;

        return {
          week,
          tutorId: tutor.id,
          tutorName: tutor.name,
          commissionPercent: Number(tutor.commissionPercent),
          grossIncome,
          advertisingCost: totalAdvShare,
          tutorAdvertisingShare: totalAdvShare,
          sharedAdvertisingShare: sharedAdvShare,
          ownAdvertisingShare: ownAdvShare,
          agencyAdvertisingShare: totalAdvShare,
          netIncome,
          tutorEarnings,
          agencyEarnings,
          payments: tutorPayments,
        };
      }).filter(s => s.payments.length > 0 || s.grossIncome > 0);

      const totals = {
        grossIncome: settlements.reduce((sum, s) => sum + s.grossIncome, 0),
        advertisingCost: settlements.reduce((sum, s) => sum + s.tutorAdvertisingShare, 0),
        netIncome: settlements.reduce((sum, s) => sum + s.netIncome, 0),
        tutorEarnings: settlements.reduce((sum, s) => sum + s.tutorEarnings, 0),
        agencyEarnings: settlements.reduce((sum, s) => sum + s.agencyEarnings, 0),
      };

      res.json({
        week,
        settlements,
        totals,
        settings: {
          agencyPercent: Number(settings?.agencyPercent ?? 30),
          tutorPercent: Number(settings?.tutorPercent ?? 70),
        },
        advertising: {
          sharedAdvertisingUsd,
          usdRate,
          advertisingInSoles,
          agencyShare: advertisingInSoles * 0.5,
          tutorsShare: advertisingInSoles * 0.5,
        },
      });
    } catch (error) {
      console.error("Error getting settlement:", error);
      res.status(500).json({ message: "Error al obtener liquidación" });
    }
  });

  // Admin: Settlements Matrix (all tutors × last 12 weeks)
  app.get("/api/admin/settlements/matrix", requireAdmin, async (req, res) => {
    try {
      const allWeeks = (await storage.getWeeks()).slice(0, 12);
      const tutors = await storage.getTutors();
      const allCurrencies = await storage.getCurrencies();

      const usdCurrency = allCurrencies.find(c => c.code === "USD");
      const usdRate = Number(usdCurrency?.exchangeRate ?? 1);

      const matrix: Record<string, Record<string, {
        grossIncome: number; netIncome: number; tutorEarnings: number;
        tutorAdvertisingShare: number; paymentCount: number;
      }>> = {};

      for (const week of allWeeks) {
        const weekPayments = await storage.getPaymentsByWeek(week.id);
        const verifiedPayments = weekPayments.filter(p => p.status === "verified");

        const sharedAdvertisingUsd = Number(week.sharedAdvertisingUsd ?? 0);
        const advertisingInSoles = sharedAdvertisingUsd * usdRate;
        const tutorsWithPayments = tutors.filter(t => t.isActive && verifiedPayments.some(p => p.tutorId === t.id));
        const activeTutorCount = tutorsWithPayments.length || 1;
        const weekTutorAdShare = (advertisingInSoles * 0.5) / activeTutorCount;

        for (const tutor of tutors) {
          const tutorPayments = verifiedPayments.filter(p => p.tutorId === tutor.id);

          let grossIncome = 0;
          tutorPayments.forEach(p => {
            const currency = allCurrencies.find(c => c.id === p.currencyId);
            grossIncome += Number(p.amount) * Number(currency?.exchangeRate ?? 1);
          });

          const commission = Number(tutor.commissionPercent) / 100;
          const tutorIsActive = tutor.isActive !== false;
          const hasPayments = tutorPayments.length > 0;
          const sharedAdvShare = (tutorIsActive && hasPayments) ? weekTutorAdShare : 0;
          const ownAdvShare = (tutorIsActive && hasPayments) ? Number(tutor.advertisingCostUsd ?? 0) * usdRate * 0.5 : 0;
          const totalAdvShare = sharedAdvShare + ownAdvShare;
          const netIncome = grossIncome * commission;
          const tutorEarnings = netIncome - totalAdvShare;

          const agencyEarnings = grossIncome * (1 - commission) - totalAdvShare;

          if (!matrix[tutor.id]) matrix[tutor.id] = {};
          matrix[tutor.id][week.id] = {
            grossIncome, netIncome, tutorEarnings, agencyEarnings,
            tutorAdvertisingShare: totalAdvShare,
            paymentCount: tutorPayments.length,
          };
        }
      }

      // Build currency totals (native amounts) across all displayed weeks
      const currencyTotals: Record<string, { code: string; name: string; symbol: string; total: number }> = {};
      for (const week of allWeeks) {
        const weekPayments = await storage.getPaymentsByWeek(week.id);
        const verifiedPayments = weekPayments.filter(p => p.status === "verified");
        for (const p of verifiedPayments) {
          const currency = allCurrencies.find(c => c.id === p.currencyId);
          if (!currency) continue;
          if (!currencyTotals[currency.id]) {
            const sym = currency.code === "USD" ? "$" : currency.code === "PEN" ? "S/." : currency.code;
            currencyTotals[currency.id] = { code: currency.code, name: currency.name, symbol: sym, total: 0 };
          }
          currencyTotals[currency.id].total += Number(p.amount);
        }
      }

      const safeTutors = tutors.map(({ password: _pw, ...safe }) => safe);
      res.json({ weeks: allWeeks, tutors: safeTutors, matrix, currencyTotals: Object.values(currencyTotals) });
    } catch (error) {
      console.error("Error getting settlements matrix:", error);
      res.status(500).json({ message: "Error al obtener matriz" });
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
      const commission = Number(user.commissionPercent) / 100;

      const usdCurrency = allCurrencies.find(c => c.code === "USD");
      const usdRate = Number(usdCurrency?.exchangeRate ?? 1);

      const weeklySettlements = await Promise.all(
        allWeeks.slice(0, 12).map(async (week) => {
          const weekPayments = await storage.getPaymentsByWeek(week.id);
          const verifiedPayments = weekPayments.filter(p => p.status === "verified");
          const tutorPayments = verifiedPayments.filter(p => p.tutorId === user.id);

          const sharedAdvertisingUsd = Number(week.sharedAdvertisingUsd ?? 0);
          const advertisingInSoles = sharedAdvertisingUsd * usdRate;
          const tutorsWithPayments = new Set(verifiedPayments.map(p => p.tutorId));
          const activeTutorCount = tutorsWithPayments.size || 1;
          const tutorAdvertisingShare = tutorPayments.length > 0
            ? (advertisingInSoles * 0.5) / activeTutorCount
            : 0;

          let grossIncome = 0;
          tutorPayments.forEach(p => {
            const currency = allCurrencies.find(c => c.id === p.currencyId);
            const rate = Number(currency?.exchangeRate ?? 1);
            grossIncome += Number(p.amount) * rate;
          });

          const netIncome = grossIncome * commission;
          const tutorEarnings = netIncome - tutorAdvertisingShare;
          const agencyEarnings = grossIncome * (1 - commission) - tutorAdvertisingShare;

          return {
            week,
            tutorId: user.id,
            tutorName: user.name,
            commissionPercent: Number(user.commissionPercent),
            grossIncome,
            advertisingCost: tutorAdvertisingShare,
            tutorAdvertisingShare,
            agencyAdvertisingShare: tutorAdvertisingShare,
            sharedAdvertisingUsd,
            usdRate,
            netIncome,
            tutorEarnings,
            agencyEarnings,
            payments: tutorPayments,
          };
        })
      );

      res.json({
        settlements: weeklySettlements,
        settings: { agencyPercent, tutorPercent },
        commissionPercent: Number(user.commissionPercent),
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
    const { status } = req.body;
    if (!["verified", "rejected"].includes(status)) {
      return res.status(400).json({ message: "Estado inválido" });
    }
    const [existing, verifierCurrencies] = await Promise.all([
      storage.getPaymentById(req.params.id),
      storage.getCurrenciesByVerifier(req.session.userId!),
    ]);
    if (!existing) {
      return res.status(404).json({ message: "Pago no encontrado" });
    }
    const ownedCurrency = verifierCurrencies.find(c => c.id === existing.currencyId);
    if (!ownedCurrency) {
      return res.status(403).json({ message: "No tienes permiso para modificar este pago" });
    }
    const payment = await storage.updatePaymentStatus(req.params.id, status, req.session.userId!);
    if (payment) {
      notifyPaymentStatusChange(payment.tutorId, status, payment.amount, ownedCurrency.code).catch(console.error);
    }
    res.json(payment);
  });

  return httpServer;
}
