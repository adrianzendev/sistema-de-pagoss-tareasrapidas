import {
  type User,
  type InsertUser,
  type Currency,
  type InsertCurrency,
  type Payment,
  type InsertPayment,
  type PaymentWithDetails,
  users,
  currencies,
  payments,
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
  getPayments(): Promise<PaymentWithDetails[]>;
  getPaymentsByTutor(tutorId: string): Promise<PaymentWithDetails[]>;
  createPayment(payment: InsertPayment): Promise<Payment>;
  updatePaymentStatus(id: string, status: string, verifiedBy: string): Promise<Payment | undefined>;

  // Stats
  getAdminStats(): Promise<{
    totalTutors: number;
    totalPayments: number;
    pendingPayments: number;
    verifiedPayments: number;
    rejectedPayments: number;
    totalAmount: number;
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
  async getPayments(): Promise<PaymentWithDetails[]> {
    const result = await db.select().from(payments).orderBy(desc(payments.createdAt));
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

  // Stats
  async getAdminStats() {
    const tutorsResult = await db.select({ count: sql<number>`count(*)` }).from(users).where(eq(users.role, "tutor"));
    const paymentsResult = await db.select({ count: sql<number>`count(*)` }).from(payments);
    const pendingResult = await db.select({ count: sql<number>`count(*)` }).from(payments).where(eq(payments.status, "pending"));
    const verifiedResult = await db.select({ count: sql<number>`count(*)` }).from(payments).where(eq(payments.status, "verified"));
    const rejectedResult = await db.select({ count: sql<number>`count(*)` }).from(payments).where(eq(payments.status, "rejected"));
    const amountResult = await db
      .select({ total: sql<number>`COALESCE(SUM(amount::numeric), 0)` })
      .from(payments)
      .where(eq(payments.status, "verified"));

    return {
      totalTutors: Number(tutorsResult[0]?.count ?? 0),
      totalPayments: Number(paymentsResult[0]?.count ?? 0),
      pendingPayments: Number(pendingResult[0]?.count ?? 0),
      verifiedPayments: Number(verifiedResult[0]?.count ?? 0),
      rejectedPayments: Number(rejectedResult[0]?.count ?? 0),
      totalAmount: Number(amountResult[0]?.total ?? 0),
    };
  }
}

export const storage = new DatabaseStorage();
