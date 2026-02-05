import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, decimal, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const userRoleEnum = pgEnum("user_role", ["admin", "tutor"]);
export const paymentStatusEnum = pgEnum("payment_status", ["pending", "verified", "rejected"]);

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: userRoleEnum("role").notNull().default("tutor"),
  name: text("name").notNull(),
  email: text("email").notNull(),
  commissionPercent: decimal("commission_percent", { precision: 5, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const currencies = pgTable("currencies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  exchangeRate: decimal("exchange_rate", { precision: 12, scale: 4 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const payments = pgTable("payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tutorId: varchar("tutor_id").notNull().references(() => users.id),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  currencyId: varchar("currency_id").notNull().references(() => currencies.id),
  clientNumber: text("client_number").notNull(),
  proofImage: text("proof_image"),
  status: paymentStatusEnum("status").notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  verifiedAt: timestamp("verified_at"),
  verifiedBy: varchar("verified_by").references(() => users.id),
});

export const blacklist = pgTable("blacklist", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientNumber: text("client_number").notNull().unique(),
  reason: text("reason").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const createTutorSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  username: true,
  role: true,
});

export const insertCurrencySchema = createInsertSchema(currencies).omit({
  id: true,
  createdAt: true,
});

export const insertPaymentSchema = createInsertSchema(payments).omit({
  id: true,
  createdAt: true,
  verifiedAt: true,
  verifiedBy: true,
  status: true,
});

export const insertBlacklistSchema = createInsertSchema(blacklist).omit({
  id: true,
  createdAt: true,
});

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertCurrency = z.infer<typeof insertCurrencySchema>;
export type Currency = typeof currencies.$inferSelect;

export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type Payment = typeof payments.$inferSelect;

export type InsertBlacklist = z.infer<typeof insertBlacklistSchema>;
export type Blacklist = typeof blacklist.$inferSelect;

// Extended types for frontend
export type PaymentWithDetails = Payment & {
  tutor?: User;
  currency?: Currency;
  verifier?: User;
};

export type TutorWithPayments = User & {
  payments?: Payment[];
  totalEarnings?: number;
};
