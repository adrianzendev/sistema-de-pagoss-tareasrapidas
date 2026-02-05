import { db } from "./db";
import { users, currencies, payments } from "@shared/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcrypt";

export async function seedDatabase() {
  try {
    // Check if admin exists
    const [existingAdmin] = await db.select().from(users).where(eq(users.username, "admin"));
    if (existingAdmin) {
      console.log("Database already seeded");
      return;
    }

    console.log("Seeding database...");

    // Hash passwords
    const adminPassword = await bcrypt.hash("admin123", 10);
    const tutorPassword = await bcrypt.hash("tutor123", 10);

    // Create admin user
    const [admin] = await db
      .insert(users)
      .values({
        username: "admin",
        password: adminPassword,
        role: "admin",
        name: "Administrador",
        email: "admin@tutorpay.com",
        commissionPercent: "0",
      })
      .returning();

    // Create sample currencies
    const currencyData = [
      { code: "USD", name: "Dólar Estadounidense", exchangeRate: "1.0000" },
      { code: "EUR", name: "Euro", exchangeRate: "0.9200" },
      { code: "MXN", name: "Peso Mexicano", exchangeRate: "17.5000" },
      { code: "COP", name: "Peso Colombiano", exchangeRate: "4000.0000" },
      { code: "ARS", name: "Peso Argentino", exchangeRate: "875.0000" },
    ];

    const insertedCurrencies = await db.insert(currencies).values(currencyData).returning();

    // Create sample tutors
    const tutorsData = [
      { username: "maria.garcia", password: tutorPassword, role: "tutor" as const, name: "María García", email: "maria.garcia@email.com", commissionPercent: "15" },
      { username: "carlos.lopez", password: tutorPassword, role: "tutor" as const, name: "Carlos López", email: "carlos.lopez@email.com", commissionPercent: "12" },
      { username: "ana.martinez", password: tutorPassword, role: "tutor" as const, name: "Ana Martínez", email: "ana.martinez@email.com", commissionPercent: "18" },
    ];

    const insertedTutors = await db.insert(users).values(tutorsData).returning();

    // Create sample payments
    const paymentsData = [
      {
        tutorId: insertedTutors[0].id,
        amount: "150.00",
        currencyId: insertedCurrencies[0].id, // USD
        clientNumber: "CLI-001",
        status: "verified" as const,
        proofImage: null,
      },
      {
        tutorId: insertedTutors[0].id,
        amount: "200.00",
        currencyId: insertedCurrencies[0].id, // USD
        clientNumber: "CLI-002",
        status: "pending" as const,
        proofImage: null,
      },
      {
        tutorId: insertedTutors[1].id,
        amount: "3500.00",
        currencyId: insertedCurrencies[2].id, // MXN
        clientNumber: "CLI-003",
        status: "verified" as const,
        proofImage: null,
      },
      {
        tutorId: insertedTutors[1].id,
        amount: "180.00",
        currencyId: insertedCurrencies[1].id, // EUR
        clientNumber: "CLI-004",
        status: "rejected" as const,
        proofImage: null,
      },
      {
        tutorId: insertedTutors[2].id,
        amount: "500000.00",
        currencyId: insertedCurrencies[3].id, // COP
        clientNumber: "CLI-005",
        status: "pending" as const,
        proofImage: null,
      },
    ];

    await db.insert(payments).values(paymentsData);

    console.log("Database seeded successfully!");
    console.log("Admin credentials: admin / admin123");
    console.log("Tutor credentials: maria.garcia / tutor123");
  } catch (error) {
    console.error("Error seeding database:", error);
  }
}
