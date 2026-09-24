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
import { nowPeru, toDateStr } from "./utils/peru-time";
import { DEFAULT_TUTOR_PASSWORD, hashPassword, parseNewPassword, PasswordValidationError } from "./utils/password";
import { eq, sql } from "drizzle-orm";
import { getVapidPublicKey, notifyPaymentStatusChange, notifyNewPaymentRequest } from "./push";

declare module "express-session" {
  interface SessionData {
    userId?: string;
  }
}

/** Sum of daily-campaign charges (USD, full amount before 50/50 split) that fall inside a week.
 *  Dates are YYYY-MM-DD strings (Peru); comparison is lexicographic. Active campaigns accrue up to today. */
function dailyCampaignUsdForWeek(
  campaigns: Array<{ dailyCostUsd: string; startDate: string; endDate: string | null }>,
  weekStart: string,
  weekEnd: string,
  todayStr: string,
): { totalUsd: number; days: number } {
  let totalUsd = 0;
  let days = 0;
  for (const c of campaigns) {
    const effectiveEnd = c.endDate ?? todayStr;
    const from = c.startDate > weekStart ? c.startDate : weekStart;
    const to = effectiveEnd < weekEnd ? effectiveEnd : weekEnd;
    if (to < from) continue;
    const d = Math.round((Date.parse(to + "T00:00:00Z") - Date.parse(from + "T00:00:00Z")) / 86400000) + 1;
    days += d;
    totalUsd += d * Number(c.dailyCostUsd);
  }
  return { totalUsd, days };
}

/** Historical active check: was the tutor considered active during the week that ended at weekEnd? */
function wasActiveForWeek(tutor: { activatedAt?: Date | string | null; deactivatedAt?: Date | string | null }, weekEnd: Date): boolean {
  if (tutor.activatedAt && new Date(tutor.activatedAt) > weekEnd) return false;
  // deactivatedAt <= weekEnd means they were deactivated before or when the week ended → inactive
  if (tutor.deactivatedAt && new Date(tutor.deactivatedAt) <= weekEnd) return false;
  return true;
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
    // Acepta usuario o correo, sin espacios ni distinción de mayúsculas en el correo
    const login = String(username ?? "").trim();
    let user = await storage.getUserByUsername(login);
    if (!user) {
      user = await storage.getUserByEmail(login.toLowerCase());
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

  // Dev-only: list all users for quick-access login
  if (process.env.NODE_ENV !== "production") {
    app.get("/api/dev/users", async (req, res) => {
      const allUsers = await storage.getTutors();
      const adminsAndVerifiers = await db.select({
        id: users.id, username: users.username, name: users.name, role: users.role,
      }).from(users).where(sql`role IN ('admin','verifier')`);
      const tutorRows = allUsers.map(({ id, username, name, role }) => ({ id, username, name, role }));
      res.json([...adminsAndVerifiers, ...tutorRows]);
    });
  }

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

  app.get("/api/admin/tutors/:id/payments", requireAdmin, async (req, res) => {
    const { id } = req.params;
    const { weekId } = req.query;
    if (weekId) {
      const pays = await storage.getPaymentsByTutorAndWeek(id, weekId as string);
      return res.json(pays);
    }
    const pays = await storage.getPaymentsByTutor(id);
    res.json(pays);
  });

  app.get("/api/admin/tutors/:id/settlement", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const user = await storage.getUser(id);
      if (!user || user.role !== "tutor") {
        return res.status(404).json({ message: "Tutor no encontrado" });
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

      const allTutorWeekAdv = await storage.getAllTutorWeekAdvertising();
      const tutorCampaigns = await storage.getTutorDailyCampaigns(user.id);
      const todayPeru = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });

      const slicedWeeks = allWeeks.slice(0, 12);
      const oldestSettlementWeek = slicedWeeks[slicedWeeks.length - 1];
      const newestSettlementWeek = slicedWeeks[0];
      const allRangePayments = slicedWeeks.length > 0
        ? await storage.getPaymentsInRange(oldestSettlementWeek.startDate, newestSettlementWeek.endDate)
        : [];

      const weeklySettlements = slicedWeeks.map((week) => {
        const weekPayments = allRangePayments.filter(p => {
          if (!p.createdAt) return false;
          const d = new Date(p.createdAt).toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
          return d >= week.startDate && d <= week.endDate;
        });
        const verifiedPayments = weekPayments.filter(p => p.status === "verified");
        const tutorPayments = verifiedPayments.filter(p => p.tutorId === user.id);

        const weekAdvRec = allTutorWeekAdv.find(r => r.tutorId === user.id && r.weekId === week.id);
        const advDisabled = !!weekAdvRec?.disabled;
        const ownAdvUsd = weekAdvRec !== undefined
          ? Number(weekAdvRec.advertisingCostUsd)
          : Number(user.advertisingCostUsd ?? 0);
        const daily = advDisabled
          ? { totalUsd: 0, days: 0 }
          : dailyCampaignUsdForWeek(tutorCampaigns, week.startDate, week.endDate, todayPeru);
        const weekEnd = new Date(week.endDate);
        const selfActiveForWeek = wasActiveForWeek(user, weekEnd);
        const ownAdvPen = selfActiveForWeek && !advDisabled ? (ownAdvUsd + daily.totalUsd) * usdRate * 0.5 : 0;

        const sharedAdvertisingUsd = Number(week.sharedAdvertisingUsd ?? 0);
        const activeTutorCount = tutors.filter(t => wasActiveForWeek(t, weekEnd)).length || 1;
        const sharedAdvPen = selfActiveForWeek ? (sharedAdvertisingUsd * usdRate * 0.5) / activeTutorCount : 0;

        const tutorAdvertisingShare = ownAdvPen + sharedAdvPen;

        let grossIncome = 0;
        let grossRegular = 0;
        let grossDirect = 0;
        let currencyCommissionHalf = 0;
        tutorPayments.forEach(p => {
          const currency = allCurrencies.find(c => c.id === p.currencyId);
          const rate = Number(currency?.exchangeRate ?? 1);
          const rawAmountPen = Number(p.amount) * rate;
          grossIncome += rawAmountPen;
          if (currency?.code === "DIRECTO") {
            grossDirect += rawAmountPen;
          } else {
            grossRegular += rawAmountPen;
            currencyCommissionHalf += rawAmountPen * (Number(currency?.commissionPercent ?? 0) / 100) * 0.5;
          }
        });

        const netIncome = grossIncome * commission;
        const tutorEarnings = netIncome - tutorAdvertisingShare - currencyCommissionHalf;
        const agencyEarnings = grossIncome * (1 - commission) - tutorAdvertisingShare - currencyCommissionHalf;
        const tutorEarningsFromRegular = grossRegular * commission - tutorAdvertisingShare - currencyCommissionHalf;
        const agencyEarningsFromDirect = grossDirect * (1 - commission);
        const netTransfer = tutorEarningsFromRegular - agencyEarningsFromDirect;

        return {
          week,
          tutorId: user.id,
          tutorName: user.name,
          commissionPercent: Number(user.commissionPercent),
          grossIncome,
          grossRegular,
          grossDirect,
          advertisingCost: tutorAdvertisingShare,
          tutorAdvertisingShare,
          agencyAdvertisingShare: tutorAdvertisingShare,
          sharedAdvertisingUsd,
          usdRate,
          dailyAdvUsd: daily.totalUsd,
          dailyAdvDays: daily.days,
          weeklyAdvDisabled: !!weekAdvRec?.disabled,
          netIncome,
          tutorEarnings,
          agencyEarnings,
          netTransfer,
          payments: tutorPayments,
        };
      });

      res.json({
        settlements: weeklySettlements,
        settings: { agencyPercent, tutorPercent },
        commissionPercent: Number(user.commissionPercent),
        tutor: { id: user.id, name: user.name, email: user.email },
      });
    } catch (error) {
      console.error("Error getting tutor settlement (admin):", error);
      res.status(500).json({ message: "Error al obtener liquidación" });
    }
  });

  app.post("/api/admin/tutors", requireAdmin, async (req, res) => {
    try {
      const validatedData = createTutorSchema.extend({ password: z.string().optional() }).parse(req.body);
      const username = validatedData.email.split("@")[0].toLowerCase().replace(/[^a-z0-9.]/g, "");
      const existing = await storage.getUserByUsername(username);
      if (existing) {
        return res.status(400).json({ message: "Ya existe un tutor con este email" });
      }
      // Sin contraseña => 123456 por defecto (siempre cifrada)
      const plainPassword = parseNewPassword(validatedData.password) ?? DEFAULT_TUTOR_PASSWORD;
      const hashedPassword = await hashPassword(plainPassword);
      const tutor = await storage.createUser({ 
        ...validatedData, 
        username, 
        role: "tutor", 
        password: hashedPassword,
        activatedAt: validatedData.isActive !== false ? new Date() : null,
      });
      const { password, ...safeTutor } = tutor;
      res.status(201).json(safeTutor);
    } catch (error) {
      if (error instanceof PasswordValidationError) {
        return res.status(400).json({ message: error.message, field: ["password"] });
      }
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
      const { name, email, password: rawPassword, commissionPercent, isActive, advertisingCostUsd: advCost, autoVerificaPagos } = req.body;
      const existing = await storage.getUser(req.params.id);
      if (!existing) return res.status(404).json({ message: "Tutor no encontrado" });
      const updateData: any = {};
      if (name) updateData.name = name;
      if (email) updateData.email = email;
      if (commissionPercent !== undefined) updateData.commissionPercent = commissionPercent;
      if (isActive !== undefined) {
        updateData.isActive = isActive;
        if (isActive === true && existing.isActive !== true) {
          updateData.activatedAt = new Date();
          updateData.deactivatedAt = null;
        }
        if (isActive === false && existing.isActive !== false) {
          updateData.deactivatedAt = new Date();
        }
      }
      // Vacía => no cambia; con texto => se valida y se cifra
      const newPassword = parseNewPassword(rawPassword);
      if (newPassword) updateData.password = await hashPassword(newPassword);
      if (advCost !== undefined) updateData.advertisingCostUsd = String(Number(advCost));
      if (autoVerificaPagos !== undefined) updateData.autoVerificaPagos = autoVerificaPagos;
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
      if (error instanceof PasswordValidationError) {
        return res.status(400).json({ message: error.message, field: ["password"] });
      }
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
      // Los verificadores sí requieren contraseña (la regla del 123456 es solo para tutores)
      const newPassword = parseNewPassword(rawPassword);
      if (!name || !email || !newPassword) {
        return res.status(400).json({ message: "Nombre, email y contraseña son requeridos" });
      }
      const username = email.split("@")[0].toLowerCase().replace(/[^a-z0-9.]/g, "");
      const existing = await storage.getUserByUsername(username);
      if (existing) {
        return res.status(400).json({ message: "Ya existe un usuario con este email" });
      }
      const hashedPassword = await hashPassword(newPassword);
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
      if (error instanceof PasswordValidationError) {
        return res.status(400).json({ message: error.message, field: ["password"] });
      }
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
      const newPassword = parseNewPassword(rawPassword);
      if (newPassword) updateData.password = await hashPassword(newPassword);
      const [updated] = await db.update(users).set(updateData).where(eq(users.id, req.params.id)).returning();
      if (!updated) return res.status(404).json({ message: "Verificador no encontrado" });
      const { password, ...safe } = updated;
      res.json(safe);
    } catch (error) {
      if (error instanceof PasswordValidationError) {
        return res.status(400).json({ message: error.message, field: ["password"] });
      }
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
    const weekId = req.query.weekId as string | undefined;
    if (weekId) {
      const payments = await storage.getPaymentsByWeek(weekId);
      return res.json(payments);
    }
    const period = req.query.period as string || "week";
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
    const all = await storage.getCurrencies();
    res.json(all.filter(c => c.code !== "DIRECTO"));
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
    try {
      const inUse = await storage.isCurrencyInUse(req.params.id);
      if (inUse) {
        return res.status(409).json({ message: "No se puede eliminar esta divisa porque tiene pagos registrados. Primero elimina o reasigna esos pagos." });
      }
      await storage.deleteCurrency(req.params.id);
      res.status(204).send();
    } catch (err) {
      res.status(500).json({ message: "Error al eliminar divisa" });
    }
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
    const weekId = req.query.weekId as string | undefined;
    if (weekId) {
      const pays = await storage.getPaymentsByTutorAndWeek(user.id, weekId);
      return res.json(pays);
    }
    const payments = await storage.getPaymentsByTutor(user.id);
    res.json(payments);
  });

  app.post("/api/tutor/payments/verified", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user || user.role !== "tutor") {
        return res.status(403).json({ message: "Acceso denegado" });
      }
      if (!user.autoVerificaPagos) {
        return res.status(403).json({ message: "No tienes permiso para registrar pagos verificados directamente" });
      }
      const currentWeek = await storage.getCurrentWeek();
      if (!currentWeek || currentWeek.status !== "open") {
        return res.status(400).json({ message: "No hay una semana abierta para la fecha actual." });
      }
      // Validate incoming fields (amountPen + clientNumber only)
      const amountPen = parseFloat(req.body.amountPen);
      if (isNaN(amountPen) || amountPen <= 0) {
        return res.status(400).json({ message: "Monto en PEN debe ser mayor a 0" });
      }
      const clientNumber: string = req.body.clientNumber || "";
      if (!clientNumber.trim()) {
        return res.status(400).json({ message: "Número de cliente requerido" });
      }
      const notes: string | undefined = req.body.notes || undefined;
      const proofImage: string | undefined = req.body.proofImage || undefined;
      // Always use the DIRECTO system currency — isolated from regular currency stats
      const allCurrencies = await storage.getCurrencies();
      const directoCurrency = allCurrencies.find(c => c.code === "DIRECTO");
      if (!directoCurrency) {
        return res.status(500).json({ message: "Divisa DIRECTO no configurada. Contacta al administrador." });
      }
      const normalized = normalizePhone(clientNumber);
      if (normalized) {
        const existingClient = await storage.getClientByNormalizedPhone(normalized);
        if (!existingClient) {
          await storage.createClient({ phoneNumber: clientNumber, normalizedPhone: normalized });
        }
      }
      const payment = await storage.createPayment({
        tutorId: user.id,
        amount: String(amountPen),
        currencyId: directoCurrency.id,
        clientNumber,
        proofImage: proofImage ?? null,
        exchangeRateSnapshot: "1.0000",
        notes: notes ?? null,
        status: "verified",
        verifiedAt: new Date(),
        verifiedBy: user.id,
      });
      res.status(201).json(payment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(500).json({ message: "Error al crear pago" });
    }
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
      const currency = await storage.getCurrency(data.currencyId);
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
      const payment = await storage.createPayment({
        ...data,
        exchangeRateSnapshot: currency ? String(currency.exchangeRate) : null,
      });
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
      if (req.body.sharedAdvertisingUsd === undefined) {
        const allWeeks = await storage.getWeeks();
        if (allWeeks.length > 0) {
          const latest = allWeeks.reduce((max, w) => w.weekNumber > max.weekNumber ? w : max, allWeeks[0]);
          data.sharedAdvertisingUsd = latest.sharedAdvertisingUsd ?? "0";
        }
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

      const now = nowPeru(); // hora Perú UTC-5
      const dayOfWeek = now.getUTCDay(); // 0=Dom, 1=Lun, ..., 6=Sab (sobre fecha Perú)
      const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const monday = new Date(now);
      monday.setUTCDate(now.getUTCDate() - daysFromMonday);

      const sunday = new Date(monday);
      sunday.setUTCDate(monday.getUTCDate() + 6);

      const startDate = toDateStr(monday);
      const endDate = toDateStr(sunday);

      const existing = await storage.getWeekByNumber(nextWeekNumber);
      if (existing) {
        return res.status(400).json({ message: "La semana actual ya existe" });
      }

      const prevSharedAdv = existingWeeks.length > 0
        ? (existingWeeks.reduce((max, w) => w.weekNumber > max.weekNumber ? w : max, existingWeeks[0]).sharedAdvertisingUsd ?? "0")
        : "0";

      const week = await storage.createWeek({
        weekNumber: nextWeekNumber,
        startDate,
        endDate,
        status: "open",
        advertisingCost: "0",
        sharedAdvertisingUsd: prevSharedAdv,
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

  // Per-tutor payment tracking per week
  // Per-tutor per-week advertising cost
  app.patch("/api/admin/tutors/:tutorId/week-advertising/:weekId", requireAdmin, async (req, res) => {
    try {
      const cost = Number(req.body.advertisingCostUsd ?? 0);
      const rec = await storage.setTutorWeekAdvertising(req.params.tutorId, req.params.weekId, cost);
      res.json(rec);
    } catch (e) {
      res.status(500).json({ message: "Error" });
    }
  });

  // Toggle weekly advertising charge on/off for a tutor+week
  app.patch("/api/admin/tutors/:tutorId/week-advertising/:weekId/toggle", requireAdmin, async (req, res) => {
    try {
      const disabled = !!req.body.disabled;
      const tutor = await storage.getUser(req.params.tutorId);
      if (!tutor) return res.status(404).json({ message: "Tutor no encontrado" });
      const week = await storage.getWeek(req.params.weekId);
      if (!week) return res.status(404).json({ message: "Semana no encontrada" });
      const rec = await storage.setTutorWeekAdvertisingDisabled(
        req.params.tutorId,
        req.params.weekId,
        disabled,
        Number(tutor.advertisingCostUsd ?? 0),
      );
      res.json(rec);
    } catch (e) {
      res.status(500).json({ message: "Error al cambiar publicidad semanal" });
    }
  });

  // Daily advertising campaigns
  app.get("/api/admin/tutors/:tutorId/daily-campaigns", requireAdmin, async (req, res) => {
    try {
      const campaigns = await storage.getTutorDailyCampaigns(req.params.tutorId);
      const todayPeru = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
      res.json(campaigns.map(c => {
        const end = c.endDate ?? todayPeru;
        const days = end >= c.startDate
          ? Math.round((Date.parse(end + "T00:00:00Z") - Date.parse(c.startDate + "T00:00:00Z")) / 86400000) + 1
          : 0;
        return { ...c, days, active: c.endDate === null };
      }));
    } catch (e) {
      res.status(500).json({ message: "Error al obtener campañas" });
    }
  });

  app.post("/api/admin/tutors/:tutorId/daily-campaigns", requireAdmin, async (req, res) => {
    try {
      const dailyCostUsd = Number(req.body.dailyCostUsd);
      if (!Number.isFinite(dailyCostUsd) || dailyCostUsd <= 0) {
        return res.status(400).json({ message: "Monto diario inválido" });
      }
      const existing = await storage.getTutorDailyCampaigns(req.params.tutorId);
      if (existing.some(c => c.endDate === null)) {
        return res.status(400).json({ message: "El tutor ya tiene una campaña diaria activa" });
      }
      const todayPeru = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
      const rec = await storage.createTutorDailyCampaign(req.params.tutorId, dailyCostUsd, todayPeru);
      res.status(201).json(rec);
    } catch (e: any) {
      // Unique index: only one active campaign per tutor
      if (e?.code === "23505") {
        return res.status(400).json({ message: "El tutor ya tiene una campaña diaria activa" });
      }
      res.status(500).json({ message: "Error al crear campaña" });
    }
  });

  app.patch("/api/admin/daily-campaigns/:id/end", requireAdmin, async (req, res) => {
    try {
      const todayPeru = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
      const rec = await storage.endTutorDailyCampaign(req.params.id, todayPeru);
      if (!rec) return res.status(409).json({ message: "La campaña no existe o ya fue finalizada" });
      res.json(rec);
    } catch (e) {
      res.status(500).json({ message: "Error al finalizar campaña" });
    }
  });

  app.post("/api/admin/weeks/:weekId/tutor-paid/:tutorId", requireAdmin, async (req, res) => {
    try {
      const record = await storage.markTutorPaid(req.params.weekId, req.params.tutorId);
      res.json(record);
    } catch (e) {
      res.status(500).json({ message: "Error" });
    }
  });

  app.delete("/api/admin/weeks/:weekId/tutor-paid/:tutorId", requireAdmin, async (req, res) => {
    try {
      await storage.unmarkTutorPaid(req.params.weekId, req.params.tutorId);
      res.status(204).send();
    } catch (e) {
      res.status(500).json({ message: "Error" });
    }
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

      const weekEnd = new Date(week.endDate);
      const activeTutorCountForWeek = tutors.filter(t => wasActiveForWeek(t, weekEnd)).length || 1;
      const tutorAdvertisingShare = (advertisingInSoles * 0.5) / activeTutorCountForWeek;

      // Load per-week advertising overrides for this week
      const weekAdvRecords = await storage.getAllTutorWeekAdvertising();
      const weekAdvByTutor: Record<string, number> = {};
      const weekAdvDisabledByTutor: Record<string, boolean> = {};
      for (const r of weekAdvRecords) {
        if (r.weekId === week.id) {
          weekAdvByTutor[r.tutorId] = Number(r.advertisingCostUsd);
          weekAdvDisabledByTutor[r.tutorId] = !!r.disabled;
        }
      }
      const allCampaigns = await storage.getAllTutorDailyCampaigns();
      const todayPeru = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });

      const settlements = tutors.map(tutor => {
        const tutorPayments = verifiedPayments.filter(p => p.tutorId === tutor.id);

        let grossIncome = 0;
        let grossDirect = 0;
        let currencyCommissionHalf = 0;
        tutorPayments.forEach(p => {
          const currency = allCurrencies.find(c => c.id === p.currencyId);
          const rate = Number((p as any).exchangeRateSnapshot ?? currency?.exchangeRate ?? 1);
          const rawAmountPen = Number(p.amount) * rate;
          grossIncome += rawAmountPen;
          if (currency?.code === "DIRECTO") grossDirect += rawAmountPen;
          currencyCommissionHalf += rawAmountPen * (Number(currency?.commissionPercent ?? 0) / 100) * 0.5;
        });

        const grossRegular = grossIncome - grossDirect;
        const commission = Number(tutor.commissionPercent) / 100;
        const isActiveForWeek = wasActiveForWeek(tutor, weekEnd);
        const sharedAdvShare = isActiveForWeek ? tutorAdvertisingShare : 0;
        const advDisabled = !!weekAdvDisabledByTutor[tutor.id];
        const ownAdvUsd = weekAdvByTutor[tutor.id] ?? Number(tutor.advertisingCostUsd ?? 0);
        const daily = advDisabled
          ? { totalUsd: 0, days: 0 }
          : dailyCampaignUsdForWeek(allCampaigns.filter(c => c.tutorId === tutor.id), week.startDate, week.endDate, todayPeru);
        const ownAdvShare = isActiveForWeek && !advDisabled ? (ownAdvUsd + daily.totalUsd) * usdRate * 0.5 : 0;
        const totalAdvShare = sharedAdvShare + ownAdvShare;
        const netIncome = grossIncome * commission;
        const tutorEarnings = netIncome - totalAdvShare - currencyCommissionHalf;
        const agencyEarnings = grossIncome * (1 - commission) - totalAdvShare - currencyCommissionHalf;
        const dailyAdvUsd = daily.totalUsd;
        const dailyAdvDays = daily.days;

        // netTransfer: positive = agency owes tutor, negative = tutor owes agency
        const tutorEarningsFromRegular = grossRegular * commission - totalAdvShare - currencyCommissionHalf;
        const agencyEarningsFromDirect = grossDirect * (1 - commission);
        const netTransfer = tutorEarningsFromRegular - agencyEarningsFromDirect;

        return {
          week,
          tutorId: tutor.id,
          tutorName: tutor.name,
          autoVerificaPagos: !!(tutor as any).autoVerificaPagos,
          commissionPercent: Number(tutor.commissionPercent),
          grossIncome,
          grossDirect,
          grossRegular,
          advertisingCost: totalAdvShare,
          tutorAdvertisingShare: totalAdvShare,
          sharedAdvertisingShare: sharedAdvShare,
          ownAdvertisingShare: ownAdvShare,
          dailyAdvUsd,
          dailyAdvDays,
          weeklyAdvDisabled: !!weekAdvDisabledByTutor[tutor.id],
          agencyAdvertisingShare: totalAdvShare,
          netIncome,
          tutorEarnings,
          agencyEarnings,
          netTransfer,
          payments: tutorPayments,
        };
      }).filter(s => s.payments.length > 0 || s.grossIncome > 0 || s.tutorAdvertisingShare > 0);

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

      // Load all per-week advertising overrides once
      const allTutorWeekAdv = await storage.getAllTutorWeekAdvertising();
      const allCampaignsMatrix = await storage.getAllTutorDailyCampaigns();
      const todayPeruMatrix = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
      const tutorWeekAdvMap: Record<string, Record<string, number>> = {};
      const tutorWeekAdvDisabledMap: Record<string, Record<string, boolean>> = {};
      for (const r of allTutorWeekAdv) {
        if (!tutorWeekAdvMap[r.tutorId]) tutorWeekAdvMap[r.tutorId] = {};
        tutorWeekAdvMap[r.tutorId][r.weekId] = Number(r.advertisingCostUsd);
        if (!tutorWeekAdvDisabledMap[r.tutorId]) tutorWeekAdvDisabledMap[r.tutorId] = {};
        tutorWeekAdvDisabledMap[r.tutorId][r.weekId] = !!r.disabled;
      }

      // Fetch all payments for the relevant weeks in one query
      const oldestWeek = allWeeks[allWeeks.length - 1];
      const newestWeek = allWeeks[0];
      const rangePayments = allWeeks.length > 0
        ? await storage.getPaymentsInRange(oldestWeek.startDate, newestWeek.endDate)
        : [];
      const allWeekPaymentsMap: Record<string, any[]> = {};
      for (const week of allWeeks) {
        allWeekPaymentsMap[week.id] = rangePayments.filter(p => {
          if (!p.createdAt) return false;
          const d = new Date(p.createdAt).toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
          return d >= week.startDate && d <= week.endDate;
        });
      }

      // Fetch all paid-tutor records in one query
      const allPaidRecords = await storage.getAllWeekPaidTutors();
      const weekPaidMap: Record<string, string[]> = {};
      for (const r of allPaidRecords) {
        if (!weekPaidMap[r.weekId]) weekPaidMap[r.weekId] = [];
        weekPaidMap[r.weekId].push(r.tutorId);
      }

      for (const week of allWeeks) {
        const weekPayments = allWeekPaymentsMap[week.id] ?? [];
        const verifiedPayments = weekPayments.filter((p: any) => p.status === "verified");

        const sharedAdvertisingUsd = Number(week.sharedAdvertisingUsd ?? 0);
        const advertisingInSoles = sharedAdvertisingUsd * usdRate;
        const weekEndDate = new Date(week.endDate);
        const activeTutorCount = tutors.filter(t => wasActiveForWeek(t, weekEndDate)).length || 1;
        const weekTutorAdShare = (advertisingInSoles * 0.5) / activeTutorCount;

        for (const tutor of tutors) {
          const tutorPayments = verifiedPayments.filter(p => p.tutorId === tutor.id);

          let grossIncome = 0;
          let grossDirect = 0;
          let currencyCommissionHalf = 0;
          const cellCurrencies: Record<string, { code: string; symbol: string; total: number }> = {};
          tutorPayments.forEach(p => {
            const currency = allCurrencies.find(c => c.id === p.currencyId);
            const rate = Number((p as any).exchangeRateSnapshot ?? currency?.exchangeRate ?? 1);
            const rawAmountPen = Number(p.amount) * rate;
            grossIncome += rawAmountPen;
            if (currency?.code === "DIRECTO") grossDirect += rawAmountPen;
            currencyCommissionHalf += rawAmountPen * (Number(currency?.commissionPercent ?? 0) / 100) * 0.5;
            if (currency) {
              const sym = currency.code === "USD" ? "$" : currency.code === "PEN" ? "S/." : currency.code;
              if (!cellCurrencies[currency.id]) cellCurrencies[currency.id] = { code: currency.code, symbol: sym, total: 0 };
              cellCurrencies[currency.id].total += Number(p.amount);
            }
          });

          const grossRegular = grossIncome - grossDirect;
          const commission = Number(tutor.commissionPercent) / 100;
          const tutorIsActive = wasActiveForWeek(tutor, weekEndDate);
          const sharedAdvShare = tutorIsActive ? weekTutorAdShare : 0;
          const advDisabledMx = !!tutorWeekAdvDisabledMap[tutor.id]?.[week.id];
          const weekOwnAdv = tutorWeekAdvMap[tutor.id]?.[week.id] ?? Number(tutor.advertisingCostUsd ?? 0);
          const dailyMx = advDisabledMx
            ? { totalUsd: 0, days: 0 }
            : dailyCampaignUsdForWeek(allCampaignsMatrix.filter(c => c.tutorId === tutor.id), week.startDate, week.endDate, todayPeruMatrix);
          const ownAdvShare = tutorIsActive && !advDisabledMx ? (weekOwnAdv + dailyMx.totalUsd) * usdRate * 0.5 : 0;
          const totalAdvShare = sharedAdvShare + ownAdvShare;
          const netIncome = grossIncome * commission;
          const tutorEarnings = netIncome - totalAdvShare - currencyCommissionHalf;
          const agencyEarnings = grossIncome * (1 - commission) - totalAdvShare - currencyCommissionHalf;
          const tutorEarningsFromRegular = grossRegular * commission - totalAdvShare - currencyCommissionHalf;
          const agencyEarningsFromDirect = grossDirect * (1 - commission);
          const netTransfer = tutorEarningsFromRegular - agencyEarningsFromDirect;

          if (!matrix[tutor.id]) matrix[tutor.id] = {};
          matrix[tutor.id][week.id] = {
            grossIncome, grossDirect, netIncome, tutorEarnings, agencyEarnings, netTransfer,
            tutorAdvertisingShare: totalAdvShare,
            paymentCount: tutorPayments.length,
            currencies: Object.values(cellCurrencies),
            wasActive: tutorIsActive,
          };
        }
      }

      // Build currency totals reusing already-fetched payments
      const currencyTotals: Record<string, { code: string; name: string; symbol: string; total: number }> = {};
      const weekCurrencyTotals: Record<string, Record<string, { code: string; symbol: string; total: number }>> = {};
      for (const week of allWeeks) {
        const verifiedPayments = (allWeekPaymentsMap[week.id] ?? []).filter((p: any) => p.status === "verified");
        weekCurrencyTotals[week.id] = {};
        for (const p of verifiedPayments) {
          const currency = allCurrencies.find(c => c.id === p.currencyId);
          if (!currency) continue;
          const sym = currency.code === "USD" ? "$" : currency.code === "PEN" ? "S/." : currency.code;
          if (!currencyTotals[currency.id]) {
            currencyTotals[currency.id] = { code: currency.code, name: currency.name, symbol: sym, total: 0 };
          }
          currencyTotals[currency.id].total += Number(p.amount);
          if (!weekCurrencyTotals[week.id][currency.id]) {
            weekCurrencyTotals[week.id][currency.id] = { code: currency.code, symbol: sym, total: 0 };
          }
          weekCurrencyTotals[week.id][currency.id].total += Number(p.amount);
        }
      }

      const safeTutors = tutors.map(({ password: _pw, ...safe }) => safe);
      res.json({ weeks: allWeeks, tutors: safeTutors, matrix, currencyTotals: Object.values(currencyTotals), weekCurrencyTotals, weekPaidMap, tutorWeekAdvMap, tutorWeekAdvDisabledMap, usdRate });
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

  // Admin: Current week summary per tutor (PEN)
  app.get("/api/admin/current-week-summary", requireAdmin, async (req, res) => {
    try {
      const { todayPeru } = await import("./utils/peru-time");
      const today = todayPeru();
      const allWeeks = await storage.getWeeks();
      const currentWeek = allWeeks.find(w => w.startDate <= today && w.endDate >= today);

      const tutors = await storage.getTutors();
      const allCurrencies = await storage.getCurrencies();
      const settings = await storage.getAgencySettings();
      const usdCurrency = allCurrencies.find(c => c.code === "USD");
      const usdRate = Number(usdCurrency?.exchangeRate ?? 1);

      if (!currentWeek) {
        return res.json({ week: null, tutors: [], usdRate });
      }

      const weekPayments = await storage.getPaymentsByWeek(currentWeek.id);
      const verifiedPayments = weekPayments.filter(p => p.status === "verified");

      const sharedAdvertisingUsd = Number(currentWeek.sharedAdvertisingUsd ?? 0);
      const sharedAdvertisingPen = sharedAdvertisingUsd * usdRate;

      // Count active tutors with verified payments for shared ad split
      const tutorIdsWithPayments = new Set(verifiedPayments.map(p => p.tutorId));
      const activeTutorCount = tutorIdsWithPayments.size || 1;
      const sharedAdvPerTutor = (sharedAdvertisingPen * 0.5) / activeTutorCount;

      // Per-week advertising overrides
      const allTutorWeekAdv = await storage.getAllTutorWeekAdvertising();
      const weekAdvByTutor: Record<string, number> = {};
      const weekAdvDisabledByTutor: Record<string, boolean> = {};
      for (const r of allTutorWeekAdv) {
        if (r.weekId === currentWeek.id) {
          weekAdvByTutor[r.tutorId] = Number(r.advertisingCostUsd);
          weekAdvDisabledByTutor[r.tutorId] = !!r.disabled;
        }
      }
      const allCampaignsCw = await storage.getAllTutorDailyCampaigns();
      const todayPeruCw = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });

      const weekEnd = new Date(currentWeek.endDate + "T23:59:59");

      const tutorSummaries = tutors.map(tutor => {
        const tutorPayments = verifiedPayments.filter(p => p.tutorId === tutor.id);
        const commission = Number(tutor.commissionPercent) / 100;
        const isActive = wasActiveForWeek(tutor, weekEnd);

        let grossIncomePen = 0;
        let currencyCommissionHalfPen = 0;
        tutorPayments.forEach(p => {
          const currency = allCurrencies.find(c => c.id === p.currencyId);
          const rate = Number(currency?.exchangeRate ?? 1);
          const rawAmountPen = Number(p.amount) * rate;
          grossIncomePen += rawAmountPen;
          currencyCommissionHalfPen += rawAmountPen * (Number(currency?.commissionPercent ?? 0) / 100) * 0.5;
        });

        const advDisabledCw = !!weekAdvDisabledByTutor[tutor.id];
        const ownAdvUsd = weekAdvByTutor[tutor.id] ?? Number(tutor.advertisingCostUsd ?? 0);
        const dailyCw = advDisabledCw
          ? { totalUsd: 0, days: 0 }
          : dailyCampaignUsdForWeek(allCampaignsCw.filter(c => c.tutorId === tutor.id), currentWeek.startDate, currentWeek.endDate, todayPeruCw);
        const ownAdvPen = isActive && !advDisabledCw ? (ownAdvUsd + dailyCw.totalUsd) * usdRate * 0.5 : 0;
        const sharedAdv = isActive && tutorPayments.length > 0 ? sharedAdvPerTutor : 0;
        const totalAdvPen = sharedAdv + ownAdvPen;

        const netIncomePen = grossIncomePen * commission;
        const tutorEarningsPen = netIncomePen - totalAdvPen - currencyCommissionHalfPen;

        return {
          tutorId: tutor.id,
          tutorName: tutor.name,
          commissionPercent: Number(tutor.commissionPercent),
          paymentCount: tutorPayments.length,
          grossIncomePen,
          totalAdvPen,
          sharedAdvPen: sharedAdv,
          ownAdvPen,
          netIncomePen,
          tutorEarningsPen,
        };
      });

      res.json({
        week: currentWeek,
        tutors: tutorSummaries,
        usdRate,
        sharedAdvertisingPen,
      });
    } catch (error) {
      console.error("Error getting current week summary:", error);
      res.status(500).json({ message: "Error al obtener resumen" });
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

      const allTutorWeekAdv = await storage.getAllTutorWeekAdvertising();
      const tutorCampaignsSelf = await storage.getTutorDailyCampaigns(user.id);
      const todayPeruSelf = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });

      const slicedWeeks = allWeeks.slice(0, 12);
      const oldestSettlementWeek = slicedWeeks[slicedWeeks.length - 1];
      const newestSettlementWeek = slicedWeeks[0];
      const allRangePayments = slicedWeeks.length > 0
        ? await storage.getPaymentsInRange(oldestSettlementWeek.startDate, newestSettlementWeek.endDate)
        : [];

      const weeklySettlements = slicedWeeks.map((week) => {
          const weekPayments = allRangePayments.filter(p => {
            if (!p.createdAt) return false;
            const d = new Date(p.createdAt).toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
            return d >= week.startDate && d <= week.endDate;
          });
          const verifiedPayments = weekPayments.filter(p => p.status === "verified");
          const tutorPayments = verifiedPayments.filter(p => p.tutorId === user.id);

          // Mirror the admin formula exactly:
          // 1) Own advertising (per-week override or tutor default): tutor pays 50%
          // 2) Shared week advertising: 50% split equally among active tutors
          const weekAdvRec = allTutorWeekAdv.find(r => r.tutorId === user.id && r.weekId === week.id);
          const advDisabledTt = !!weekAdvRec?.disabled;
          const ownAdvUsd = weekAdvRec !== undefined
            ? Number(weekAdvRec.advertisingCostUsd)
            : Number(user.advertisingCostUsd ?? 0);
          const dailyTt = advDisabledTt
            ? { totalUsd: 0, days: 0 }
            : dailyCampaignUsdForWeek(tutorCampaignsSelf, week.startDate, week.endDate, todayPeruSelf);
          const weekEnd = new Date(week.endDate);
          const selfActiveForWeek = wasActiveForWeek(user, weekEnd);
          const ownAdvPen = selfActiveForWeek && !advDisabledTt ? (ownAdvUsd + dailyTt.totalUsd) * usdRate * 0.5 : 0;

          const sharedAdvertisingUsd = Number(week.sharedAdvertisingUsd ?? 0);
          const activeTutorCount = tutors.filter(t => wasActiveForWeek(t, weekEnd)).length || 1;
          const sharedAdvPen = selfActiveForWeek ? (sharedAdvertisingUsd * usdRate * 0.5) / activeTutorCount : 0;

          const tutorAdvertisingShare = ownAdvPen + sharedAdvPen;

          let grossIncome = 0;
          let grossRegular = 0;
          let grossDirect = 0;
          let currencyCommissionHalf = 0;
          tutorPayments.forEach(p => {
            const currency = allCurrencies.find(c => c.id === p.currencyId);
            const rate = Number(currency?.exchangeRate ?? 1);
            const rawAmountPen = Number(p.amount) * rate;
            grossIncome += rawAmountPen;
            if (currency?.code === "DIRECTO") {
              grossDirect += rawAmountPen;
            } else {
              grossRegular += rawAmountPen;
              currencyCommissionHalf += rawAmountPen * (Number(currency?.commissionPercent ?? 0) / 100) * 0.5;
            }
          });

          const netIncome = grossIncome * commission;
          const tutorEarnings = netIncome - tutorAdvertisingShare - currencyCommissionHalf;
          const agencyEarnings = grossIncome * (1 - commission) - tutorAdvertisingShare - currencyCommissionHalf;

          // Net transfer:
          // Agency collected regular payments → owes tutor their commission share
          // Tutor collected direct payments → owes agency their commission share
          // netTransfer > 0 → agencia paga al tutor
          // netTransfer < 0 → tutor paga a la agencia
          const tutorEarningsFromRegular = grossRegular * commission - tutorAdvertisingShare - currencyCommissionHalf;
          const agencyEarningsFromDirect = grossDirect * (1 - commission);
          const netTransfer = tutorEarningsFromRegular - agencyEarningsFromDirect;

          return {
            week,
            tutorId: user.id,
            tutorName: user.name,
            commissionPercent: Number(user.commissionPercent),
            grossIncome,
            grossRegular,
            grossDirect,
            advertisingCost: tutorAdvertisingShare,
            tutorAdvertisingShare,
            agencyAdvertisingShare: tutorAdvertisingShare,
            sharedAdvertisingUsd,
            usdRate,
            dailyAdvUsd: dailyTt.totalUsd,
            dailyAdvDays: dailyTt.days,
            weeklyAdvDisabled: !!weekAdvRec?.disabled,
            netIncome,
            tutorEarnings,
            agencyEarnings,
            netTransfer,
            payments: tutorPayments,
          };
        });

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
        // Primera semana: usar semana actual en hora Perú (lunes a domingo)
        const today = nowPeru(); // hora Perú UTC-5
        const dayOfWeek = today.getUTCDay(); // 0=Dom, 1=Lun, ..., 6=Sab
        const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        startDate = new Date(today);
        startDate.setUTCDate(today.getUTCDate() - daysFromMonday);
        endDate = new Date(startDate);
        endDate.setUTCDate(startDate.getUTCDate() + 6);
      }

      const prevSharedAdv = existingWeeks.length > 0
        ? (existingWeeks.reduce((max, w) => w.weekNumber > max.weekNumber ? w : max, existingWeeks[0]).sharedAdvertisingUsd ?? "0")
        : "0";

      const week = await storage.createWeek({
        weekNumber: newWeekNumber,
        startDate: startDate.toISOString().split("T")[0],
        endDate: endDate.toISOString().split("T")[0],
        status: "open",
        advertisingCost: "0",
        sharedAdvertisingUsd: prevSharedAdv,
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
    const weekId = req.query.weekId as string | undefined;
    const verifierPayments = await storage.getPaymentsByVerifier(req.session.userId!, weekId);
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
