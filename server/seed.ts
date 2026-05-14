import { db } from "./db";
import { users, currencies, payments, blacklist, clients, normalizePhone, weeks, agencySettings } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import bcrypt from "bcrypt";

async function ensureUser(standardPwd: string, data: { username: string; role: "admin" | "tutor" | "verifier"; name: string; email: string; commissionPercent: string }) {
  const [existing] = await db.select().from(users).where(eq(users.username, data.username));
  if (!existing) {
    await db.insert(users).values({ ...data, password: standardPwd });
    console.log(`User created: ${data.username} (${data.role})`);
  }
}

async function ensureCurrency(data: { code: string; name: string; exchangeRate: string }) {
  const [existing] = await db.select().from(currencies).where(eq(currencies.code, data.code));
  if (!existing) {
    await db.insert(currencies).values(data);
    console.log(`Currency created: ${data.code}`);
  }
}

async function ensureWeek(data: { weekNumber: number; startDate: string; endDate: string }) {
  const [existing] = await db.select().from(weeks).where(eq(weeks.weekNumber, data.weekNumber));
  if (!existing) {
    await db.insert(weeks).values({ ...data, status: "open", advertisingCost: "0.00" });
    console.log(`Week S${data.weekNumber} created`);
  }
}

async function autoGenerateWeeksUntilToday() {
  const today = new Date().toISOString().split('T')[0];

  const allWeeks = await db.select().from(weeks).orderBy(sql`week_number ASC`);
  if (allWeeks.length === 0) return;

  // If there's already a week covering today, do nothing — don't create future weeks
  const covered = allWeeks.find(w => w.startDate <= today && w.endDate >= today);
  if (covered) return;

  // No week covers today → extend from the last week until today is covered
  let lastWeek = allWeeks[allWeeks.length - 1];

  while (lastWeek.endDate < today) {
    const nextNumber = lastWeek.weekNumber + 1;

    const startDate = new Date(lastWeek.endDate + 'T00:00:00');
    startDate.setDate(startDate.getDate() + 1);
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);

    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];

    const [existing] = await db.select().from(weeks).where(eq(weeks.weekNumber, nextNumber));
    if (!existing) {
      const [created] = await db.insert(weeks).values({
        weekNumber: nextNumber,
        startDate: startStr,
        endDate: endStr,
        status: "open",
        advertisingCost: "0.00",
      }).returning();
      console.log(`Auto-generated week S${nextNumber} (${startStr} → ${endStr})`);
      lastWeek = created;
    } else {
      lastWeek = existing;
    }
  }
}

export async function seedDatabase() {
  try {
    const standardPwd = await bcrypt.hash("123456", 10);

    const [existingAdmin] = await db.select().from(users).where(eq(users.username, "admin"));
    if (existingAdmin) {
      console.log("Database already seeded, syncing missing data...");
    } else {
      console.log("Seeding database from scratch...");
    }

    // === USERS ===
    if (!existingAdmin) {
      await db.insert(users).values({
        username: "admin",
        password: standardPwd,
        role: "admin",
        name: "Administrador",
        email: "admin@tutorpay.com",
        commissionPercent: "0",
      });
      console.log("Admin created");
    }

    await ensureUser(standardPwd, { username: "maria.garcia", role: "tutor", name: "María García", email: "maria.garcia@email.com", commissionPercent: "15" });
    await ensureUser(standardPwd, { username: "carlos.lopez", role: "tutor", name: "Carlos López", email: "carlos.lopez@email.com", commissionPercent: "12" });
    await ensureUser(standardPwd, { username: "ana.martinez", role: "tutor", name: "Ana Martínez", email: "ana.martinez@email.com", commissionPercent: "18" });
    await ensureUser(standardPwd, { username: "roger", role: "tutor", name: "Roger", email: "roger@gmail.com", commissionPercent: "70" });
    await ensureUser(standardPwd, { username: "adrian", role: "verifier", name: "Verificador Adrian", email: "adrian@gmail.com", commissionPercent: "0" });

    // Reset all passwords to 123456
    await db.update(users).set({ password: standardPwd });
    console.log("All passwords set to 123456");

    // === CURRENCIES ===
    // Exchange rates = soles (PEN) per 1 unit of each currency
    // PEN must always be 1.0 since amounts in soles need no conversion
    await ensureCurrency({ code: "PEN", name: "Sol Peruano", exchangeRate: "1.0000" });
    await ensureCurrency({ code: "USD", name: "Dólar Estadounidense", exchangeRate: "3.7500" });
    await ensureCurrency({ code: "EUR", name: "Euro", exchangeRate: "4.0500" });
    await ensureCurrency({ code: "MXN", name: "Peso Mexicano", exchangeRate: "0.1900" });
    await ensureCurrency({ code: "COP", name: "Peso Colombiano", exchangeRate: "0.0009" });
    await ensureCurrency({ code: "ARS", name: "Peso Argentino", exchangeRate: "0.0040" });

    // === LINK VERIFIERS TO CURRENCIES ===
    const [adrianUser] = await db.select().from(users).where(eq(users.username, "adrian"));
    if (adrianUser) {
      const [penCurrency] = await db.select().from(currencies).where(eq(currencies.code, "PEN"));
      if (penCurrency && !penCurrency.verifierId) {
        await db.update(currencies).set({ verifierId: adrianUser.id }).where(eq(currencies.id, penCurrency.id));
        console.log("PEN currency linked to verifier Adrian");
      }
    }

    // === WEEKS: ensure base weeks and auto-generate up to current week ===
    await ensureWeek({ weekNumber: 166, startDate: "2026-02-01", endDate: "2026-02-07" });
    await ensureWeek({ weekNumber: 167, startDate: "2026-02-08", endDate: "2026-02-14" });
    await ensureWeek({ weekNumber: 168, startDate: "2026-02-15", endDate: "2026-02-21" });
    await ensureWeek({ weekNumber: 169, startDate: "2026-02-22", endDate: "2026-02-28" });
    await ensureWeek({ weekNumber: 170, startDate: "2026-03-01", endDate: "2026-03-07" });

    // Auto-generate missing weeks until today is covered
    await autoGenerateWeeksUntilToday();

    // === AGENCY SETTINGS ===
    const [existingSettings] = await db.select().from(agencySettings);
    if (!existingSettings) {
      await db.insert(agencySettings).values({
        agencyPercent: "30.00",
        tutorPercent: "70.00",
        currentWeekNumber: 166,
      });
      console.log("Agency settings created (70/30 split)");
    }

    // === BLACKLIST ===
    const [existingBl] = await db.select().from(blacklist).where(eq(blacklist.clientNumber, "+51935436864"));
    if (!existingBl) {
      await db.insert(blacklist).values({
        clientNumber: "+51935436864",
        reason: "Cliente reportado - número de ejemplo para pruebas",
      });
      console.log("Blacklist entry created");
    }

    // === CLIENTS ===
    const clientNumbers = ["9878654321", "CLI-001", "CLI-002", "CLI-003", "CLI-004", "CLI-005"];
    for (const cn of clientNumbers) {
      const normalized = normalizePhone(cn);
      const [existing] = await db.select().from(clients).where(eq(clients.normalizedPhone, normalized));
      if (!existing) {
        await db.insert(clients).values({ phoneNumber: cn, normalizedPhone: normalized });
        console.log(`Client created: ${cn}`);
      }
    }

    console.log("Database sync complete!");
  } catch (error) {
    console.error("Error seeding database:", error);
  }
}
