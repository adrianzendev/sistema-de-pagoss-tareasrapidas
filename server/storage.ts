import {
  type User,
  type InsertUser,
  type Currency,
  type InsertCurrency,
  type Payment,
  type InsertPayment,
  type PaymentWithDetails,
  type Blacklist,
  type InsertBlacklist,
  type Week,
  type InsertWeek,
  type AgencySettings,
  type InsertAgencySettings,
  users,
  currencies,
  payments,
  blacklist,
  weeks,
  agencySettings,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, sql, gte, lte } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getTutors(): Promise<User[]>;
  deleteTutor(id: string): Promise<void>;
  getVerifiers(): Promise<User[]>;
  createVerifier(user: InsertUser): Promise<User>;
  deleteVerifier(id: string): Promise<void>;

  // Currencies
  getCurrencies(): Promise<Currency[]>;
  getCurrency(id: string): Promise<Currency | undefined>;
  createCurrency(currency: InsertCurrency): Promise<Currency>;
  updateCurrency(id: string, currency: Partial<InsertCurrency>): Promise<Currency | undefined>;
  deleteCurrency(id: string): Promise<void>;

  // Payments
  getPayments(period?: string): Promise<PaymentWithDetails[]>;
  getPaymentsByTutor(tutorId: string): Promise<PaymentWithDetails[]>;
  createPayment(payment: InsertPayment): Promise<Payment>;
  updatePaymentStatus(id: string, status: string, verifiedBy: string, notes?: string): Promise<Payment | undefined>;
  getPaymentsByVerifier(verifierId: string): Promise<PaymentWithDetails[]>;

  // Blacklist
  getBlacklist(): Promise<Blacklist[]>;
  getBlacklistByClient(clientNumber: string): Promise<Blacklist | undefined>;
  createBlacklistEntry(entry: InsertBlacklist): Promise<Blacklist>;
  updateBlacklistEntry(id: string, data: Partial<InsertBlacklist>): Promise<Blacklist | undefined>;
  deleteBlacklistEntry(id: string): Promise<void>;

  // Stats
  getAdminStats(period?: string): Promise<{
    totalTutors: number;
    totalPayments: number;
    pendingPayments: number;
    verifiedPayments: number;
    rejectedPayments: number;
    totalAmount: number;
    tutorStats: Array<{
      id: string;
      name: string;
      totalPayments: number;
      verifiedAmount: number;
    }>;
  }>;

  // Weeks
  getWeeks(): Promise<Week[]>;
  getWeek(id: string): Promise<Week | undefined>;
  getWeekByNumber(weekNumber: number): Promise<Week | undefined>;
  getCurrentWeek(): Promise<Week | undefined>;
  createWeek(week: InsertWeek): Promise<Week>;
  updateWeek(id: string, data: Partial<InsertWeek>): Promise<Week | undefined>;
  deleteWeek(id: string): Promise<void>;
  getPaymentsByWeek(weekId: string): Promise<PaymentWithDetails[]>;

  // Agency Settings
  getAgencySettings(): Promise<AgencySettings | undefined>;
  updateAgencySettings(data: Partial<InsertAgencySettings>): Promise<AgencySettings>;
}

export class DatabaseStorage implements IStorage {
  // Users
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getTutors(): Promise<User[]> {
    return db.select().from(users).where(eq(users.role, "tutor")).orderBy(desc(users.createdAt));
  }

  async deleteTutor(id: string): Promise<void> {
    await db.delete(payments).where(eq(payments.tutorId, id));
    await db.delete(users).where(and(eq(users.id, id), eq(users.role, "tutor")));
  }

  async getVerifiers(): Promise<User[]> {
    return db.select().from(users).where(eq(users.role, "verifier")).orderBy(desc(users.createdAt));
  }

  async createVerifier(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values({ ...insertUser, role: "verifier" }).returning();
    return user;
  }

  async deleteVerifier(id: string): Promise<void> {
    await db.update(currencies).set({ verifierId: null }).where(eq(currencies.verifierId, id));
    await db.delete(users).where(and(eq(users.id, id), eq(users.role, "verifier")));
  }

  // Currencies
  async getCurrencies(): Promise<Currency[]> {
    return db.select().from(currencies).orderBy(currencies.code);
  }

  async getCurrency(id: string): Promise<Currency | undefined> {
    const [currency] = await db.select().from(currencies).where(eq(currencies.id, id));
    return currency;
  }

  async createCurrency(insertCurrency: InsertCurrency): Promise<Currency> {
    const [currency] = await db.insert(currencies).values(insertCurrency).returning();
    return currency;
  }

  async updateCurrency(id: string, data: Partial<InsertCurrency>): Promise<Currency | undefined> {
    const [currency] = await db.update(currencies).set(data).where(eq(currencies.id, id)).returning();
    return currency;
  }

  async deleteCurrency(id: string): Promise<void> {
    await db.delete(currencies).where(eq(currencies.id, id));
  }

  // Payments
  async getPayments(period: string = "all"): Promise<PaymentWithDetails[]> {
    let dateFilter = sql`TRUE`;
    
    if (period === "week") {
      dateFilter = sql`payments.created_at >= NOW() - INTERVAL '7 days'`;
    } else if (period === "month") {
      dateFilter = sql`payments.created_at >= NOW() - INTERVAL '30 days'`;
    } else if (period === "quarter") {
      dateFilter = sql`payments.created_at >= NOW() - INTERVAL '90 days'`;
    } else if (period === "year") {
      dateFilter = sql`payments.created_at >= NOW() - INTERVAL '365 days'`;
    }

    const result = await db
      .select()
      .from(payments)
      .where(dateFilter)
      .orderBy(desc(payments.createdAt));
    
    const paymentDetails: PaymentWithDetails[] = [];

    for (const payment of result) {
      const [tutor] = await db.select().from(users).where(eq(users.id, payment.tutorId));
      const [currency] = await db.select().from(currencies).where(eq(currencies.id, payment.currencyId));
      let verifier: User | undefined;
      if (payment.verifiedBy) {
        const [v] = await db.select().from(users).where(eq(users.id, payment.verifiedBy));
        verifier = v;
      }
      paymentDetails.push({ ...payment, tutor, currency, verifier });
    }

    return paymentDetails;
  }

  async getPaymentsByTutor(tutorId: string): Promise<PaymentWithDetails[]> {
    const result = await db.select().from(payments).where(eq(payments.tutorId, tutorId)).orderBy(desc(payments.createdAt));
    const paymentDetails: PaymentWithDetails[] = [];

    for (const payment of result) {
      const [currency] = await db.select().from(currencies).where(eq(currencies.id, payment.currencyId));
      paymentDetails.push({ ...payment, currency });
    }

    return paymentDetails;
  }

  async createPayment(insertPayment: InsertPayment): Promise<Payment> {
    const [payment] = await db.insert(payments).values(insertPayment).returning();
    return payment;
  }

  async updatePaymentStatus(id: string, status: string, verifiedBy: string, notes?: string): Promise<Payment | undefined> {
    const updateData: any = {
      status: status as "pending" | "verified" | "rejected",
      verifiedBy,
      verifiedAt: new Date(),
    };
    if (notes !== undefined) {
      updateData.notes = notes;
    }
    const [payment] = await db
      .update(payments)
      .set(updateData)
      .where(eq(payments.id, id))
      .returning();
    return payment;
  }

  async getPaymentsByVerifier(verifierId: string): Promise<PaymentWithDetails[]> {
    const verifierCurrencies = await db.select().from(currencies).where(eq(currencies.verifierId, verifierId));
    const currencyIds = verifierCurrencies.map(c => c.id);
    
    if (currencyIds.length === 0) return [];
    
    const result = await db.select().from(payments)
      .where(sql`${payments.currencyId} IN (${sql.join(currencyIds.map(id => sql`${id}`), sql`, `)})`)
      .orderBy(desc(payments.createdAt));
    
    const paymentDetails: PaymentWithDetails[] = [];
    for (const payment of result) {
      const [tutor] = await db.select().from(users).where(eq(users.id, payment.tutorId));
      const [currency] = await db.select().from(currencies).where(eq(currencies.id, payment.currencyId));
      paymentDetails.push({ ...payment, tutor, currency });
    }
    return paymentDetails;
  }

  // Blacklist
  async getBlacklist(): Promise<Blacklist[]> {
    return db.select().from(blacklist).orderBy(desc(blacklist.createdAt));
  }

  async getBlacklistByClient(clientNumber: string): Promise<Blacklist | undefined> {
    const [entry] = await db.select().from(blacklist).where(eq(blacklist.clientNumber, clientNumber));
    return entry;
  }

  async createBlacklistEntry(entry: InsertBlacklist): Promise<Blacklist> {
    const [result] = await db.insert(blacklist).values(entry).returning();
    return result;
  }

  async updateBlacklistEntry(id: string, data: Partial<InsertBlacklist>): Promise<Blacklist | undefined> {
    const [result] = await db.update(blacklist).set(data).where(eq(blacklist.id, id)).returning();
    return result;
  }

  async deleteBlacklistEntry(id: string): Promise<void> {
    await db.delete(blacklist).where(eq(blacklist.id, id));
  }

  // Stats
  async getAdminStats(period: string = "all") {
    let dateFilter = sql`TRUE`;
    
    if (period === "week") {
      dateFilter = sql`payments.created_at >= NOW() - INTERVAL '7 days'`;
    } else if (period === "month") {
      dateFilter = sql`payments.created_at >= NOW() - INTERVAL '30 days'`;
    } else if (period === "quarter") {
      dateFilter = sql`payments.created_at >= NOW() - INTERVAL '90 days'`;
    } else if (period === "year") {
      dateFilter = sql`payments.created_at >= NOW() - INTERVAL '365 days'`;
    }

    const tutorsResult = await db.select({ count: sql<number>`count(*)` }).from(users).where(eq(users.role, "tutor"));
    const paymentsResult = await db.select({ count: sql<number>`count(*)` }).from(payments).where(dateFilter);
    const pendingResult = await db.select({ count: sql<number>`count(*)` }).from(payments).where(and(eq(payments.status, "pending"), dateFilter));
    const verifiedResult = await db.select({ count: sql<number>`count(*)` }).from(payments).where(and(eq(payments.status, "verified"), dateFilter));
    const rejectedResult = await db.select({ count: sql<number>`count(*)` }).from(payments).where(and(eq(payments.status, "rejected"), dateFilter));
    
    // Amount result in PEN (considering exchange rates)
    const amountResult = await db
      .select({ 
        total: sql<number>`COALESCE(SUM(payments.amount * currencies.exchange_rate), 0)` 
      })
      .from(payments)
      .innerJoin(currencies, eq(payments.currencyId, currencies.id))
      .where(and(eq(payments.status, "verified"), dateFilter));

    // Stats per tutor
    const tutorsList = await this.getTutors();
    const tutorStats = [];

    for (const tutor of tutorsList) {
      const stats = await db
        .select({
          count: sql<number>`count(*)`,
          amount: sql<number>`COALESCE(SUM(payments.amount * currencies.exchange_rate), 0)`
        })
        .from(payments)
        .innerJoin(currencies, eq(payments.currencyId, currencies.id))
        .where(and(eq(payments.tutorId, tutor.id), eq(payments.status, "verified"), dateFilter));
      
      tutorStats.push({
        id: tutor.id,
        name: tutor.name,
        totalPayments: Number(stats[0]?.count ?? 0),
        verifiedAmount: Number(stats[0]?.amount ?? 0)
      });
    }

    return {
      totalTutors: Number(tutorsResult[0]?.count ?? 0),
      totalPayments: Number(paymentsResult[0]?.count ?? 0),
      pendingPayments: Number(pendingResult[0]?.count ?? 0),
      verifiedPayments: Number(verifiedResult[0]?.count ?? 0),
      rejectedPayments: Number(rejectedResult[0]?.count ?? 0),
      totalAmount: Number(amountResult[0]?.total ?? 0),
      tutorStats
    };
  }

  // Weeks
  async getWeeks(): Promise<Week[]> {
    return db.select().from(weeks).orderBy(desc(weeks.weekNumber));
  }

  async getWeek(id: string): Promise<Week | undefined> {
    const [week] = await db.select().from(weeks).where(eq(weeks.id, id));
    return week;
  }

  async getWeekByNumber(weekNumber: number): Promise<Week | undefined> {
    const [week] = await db.select().from(weeks).where(eq(weeks.weekNumber, weekNumber));
    return week;
  }

  async getCurrentWeek(): Promise<Week | undefined> {
    const today = new Date().toISOString().split('T')[0];
    const [week] = await db
      .select()
      .from(weeks)
      .where(and(
        lte(weeks.startDate, today),
        gte(weeks.endDate, today)
      ));
    return week;
  }

  async createWeek(insertWeek: InsertWeek): Promise<Week> {
    const [week] = await db.insert(weeks).values(insertWeek).returning();
    return week;
  }

  async updateWeek(id: string, data: Partial<InsertWeek>): Promise<Week | undefined> {
    const [week] = await db.update(weeks).set(data).where(eq(weeks.id, id)).returning();
    return week;
  }

  async deleteWeek(id: string): Promise<void> {
    await db.delete(weeks).where(eq(weeks.id, id));
  }

  async getPaymentsByWeek(weekId: string): Promise<PaymentWithDetails[]> {
    const week = await this.getWeek(weekId);
    if (!week) return [];

    const result = await db
      .select()
      .from(payments)
      .where(and(
        gte(payments.createdAt, new Date(week.startDate)),
        lte(payments.createdAt, new Date(week.endDate + 'T23:59:59'))
      ))
      .orderBy(desc(payments.createdAt));

    const paymentDetails: PaymentWithDetails[] = [];

    for (const payment of result) {
      const [tutor] = await db.select().from(users).where(eq(users.id, payment.tutorId));
      const [currency] = await db.select().from(currencies).where(eq(currencies.id, payment.currencyId));
      let verifier: User | undefined;
      if (payment.verifiedBy) {
        const [v] = await db.select().from(users).where(eq(users.id, payment.verifiedBy));
        verifier = v;
      }
      paymentDetails.push({ ...payment, tutor, currency, verifier });
    }

    return paymentDetails;
  }

  // Agency Settings
  async getAgencySettings(): Promise<AgencySettings | undefined> {
    const [settings] = await db.select().from(agencySettings);
    return settings;
  }

  async updateAgencySettings(data: Partial<InsertAgencySettings>): Promise<AgencySettings> {
    const existing = await this.getAgencySettings();
    if (existing) {
      const [settings] = await db.update(agencySettings).set(data).where(eq(agencySettings.id, existing.id)).returning();
      return settings;
    } else {
      const [settings] = await db.insert(agencySettings).values({
        agencyPercent: data.agencyPercent ?? "30",
        tutorPercent: data.tutorPercent ?? "70",
        currentWeekNumber: data.currentWeekNumber ?? 166,
      }).returning();
      return settings;
    }
  }
}

export const storage = new DatabaseStorage();
