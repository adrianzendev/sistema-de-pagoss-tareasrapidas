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
  users,
  currencies,
  payments,
  blacklist,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, sql } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getTutors(): Promise<User[]>;
  deleteTutor(id: string): Promise<void>;

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
  updatePaymentStatus(id: string, status: string, verifiedBy: string): Promise<Payment | undefined>;

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

  async updatePaymentStatus(id: string, status: string, verifiedBy: string): Promise<Payment | undefined> {
    const [payment] = await db
      .update(payments)
      .set({
        status: status as "pending" | "verified" | "rejected",
        verifiedBy,
        verifiedAt: new Date(),
      })
      .where(eq(payments.id, id))
      .returning();
    return payment;
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
}

export const storage = new DatabaseStorage();
