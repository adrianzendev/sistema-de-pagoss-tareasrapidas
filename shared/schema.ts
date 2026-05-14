import { sql } from "drizzle-orm";

export function normalizePhone(phone: string): string {
  return phone.replace(/[\s\-\(\)\.+]/g, "").trim();
}
import { pgTable, text, varchar, integer, decimal, timestamp, pgEnum, date, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const userRoleEnum = pgEnum("user_role", ["admin", "tutor", "verifier"]);
export const paymentStatusEnum = pgEnum("payment_status", ["pending", "verified", "rejected", "refunded"]);

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
  color: text("color").notNull().default("gray"),
  verifierId: varchar("verifier_id").references(() => users.id),
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
  notes: text("notes"),
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

export const clients = pgTable("clients", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  phoneNumber: text("phone_number").notNull(),
  normalizedPhone: text("normalized_phone").notNull().unique(),
  name: text("name"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const weekStatusEnum = pgEnum("week_status", ["open", "closed", "paid"]);

export const weeks = pgTable("weeks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  weekNumber: integer("week_number").notNull().unique(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  status: weekStatusEnum("status").notNull().default("open"),
  advertisingCost: decimal("advertising_cost", { precision: 12, scale: 2 }).notNull().default("0"),
  sharedAdvertisingUsd: decimal("shared_advertising_usd", { precision: 12, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const activityLog = pgTable("activity_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: text("type").notNull(),
  description: text("description").notNull(),
  tutorId: varchar("tutor_id").references(() => users.id, { onDelete: "set null" }),
  performedBy: varchar("performed_by").references(() => users.id, { onDelete: "set null" }),
  oldValue: text("old_value"),
  newValue: text("new_value"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const pushSubscriptions = pgTable("push_subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  endpoint: text("endpoint").notNull(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const agencySettings = pgTable("agency_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agencyPercent: decimal("agency_percent", { precision: 5, scale: 2 }).notNull().default("30"),
  tutorPercent: decimal("tutor_percent", { precision: 5, scale: 2 }).notNull().default("70"),
  currentWeekNumber: integer("current_week_number").notNull().default(166),
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
  notes: true,
});

export const insertBlacklistSchema = createInsertSchema(blacklist).omit({
  id: true,
  createdAt: true,
});

export const insertClientSchema = createInsertSchema(clients).omit({
  id: true,
  createdAt: true,
});

export const insertPushSubscriptionSchema = createInsertSchema(pushSubscriptions).omit({
  id: true,
  createdAt: true,
});

export const insertWeekSchema = createInsertSchema(weeks).omit({
  id: true,
  createdAt: true,
});

export const insertAgencySettingsSchema = createInsertSchema(agencySettings).omit({
  id: true,
});

export const insertActivityLogSchema = createInsertSchema(activityLog).omit({
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

export type InsertClient = z.infer<typeof insertClientSchema>;
export type Client = typeof clients.$inferSelect;

export type InsertPushSubscription = z.infer<typeof insertPushSubscriptionSchema>;
export type PushSubscription = typeof pushSubscriptions.$inferSelect;

export type InsertWeek = z.infer<typeof insertWeekSchema>;
export type Week = typeof weeks.$inferSelect;

export type InsertAgencySettings = z.infer<typeof insertAgencySettingsSchema>;
export type AgencySettings = typeof agencySettings.$inferSelect;

export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;
export type ActivityLog = typeof activityLog.$inferSelect;

// Extended types for frontend
export type CurrencyWithVerifier = Currency & {
  verifier?: User;
};

export type PaymentWithDetails = Payment & {
  tutor?: User;
  currency?: Currency;
  verifier?: User;
};

export type TutorWithPayments = User & {
  payments?: Payment[];
  totalEarnings?: number;
};

export type WeeklySettlement = {
  week: Week;
  tutorId: string;
  tutorName: string;
  grossIncome: number;
  advertisingCost: number;
  tutorAdvertisingShare: number;
  agencyAdvertisingShare: number;
  netIncome: number;
  tutorEarnings: number;
  agencyEarnings: number;
  payments: PaymentWithDetails[];
};
