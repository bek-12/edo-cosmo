/**
 * reset-data.ts
 *
 * Deletes ALL shop data (products, categories, sales, returns, stock history)
 * while keeping User accounts and ShopSettings completely untouched.
 *
 * Safe to run against Neon — reads DATABASE_URL from .env automatically.
 * Double-check the URL printed below before confirming.
 */

import { PrismaClient } from "@prisma/client";
import * as readline from "readline";

// Load .env from the backend root
require("dotenv").config();

const prisma = new PrismaClient();

async function confirm(question: string): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === "yes");
    });
  });
}

async function main() {
  const dbUrl = process.env.DATABASE_URL ?? "(not set)";

  // Show the host only — never print full credentials to the console
  let dbHost = "(unknown)";
  try {
    dbHost = new URL(dbUrl).hostname;
  } catch {
    dbHost = "(could not parse URL)";
  }

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  DATABASE RESET SCRIPT");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`  Target database host : ${dbHost}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  console.log("⚠️  WARNING: This will permanently delete:");
  console.log("   • All ReturnItems");
  console.log("   • All Returns");
  console.log("   • All SaleItems");
  console.log("   • All Sales");
  console.log("   • All StockPurchases");
  console.log("   • All Products");
  console.log("   • All Categories\n");
  console.log("✅  WILL NOT touch:");
  console.log("   • User accounts (logins, passwords, names, emails, profile images)");
  console.log("   • ShopSettings (shop name, logo, email)\n");

  console.log("🔍  Verify the database host shown above is your Neon database.");
  console.log("    If it looks wrong, press Ctrl+C NOW to abort.\n");

  const ok = await confirm('Type "yes" to confirm and proceed, anything else to cancel: ');

  if (!ok) {
    console.log("\n❌  Cancelled. Nothing was deleted.\n");
    await prisma.$disconnect();
    process.exit(0);
  }

  console.log("\n🗑️  Deleting data...\n");

  // Delete in FK-safe order
  const returnItems   = await prisma.returnItem.deleteMany();
  console.log(`   ReturnItem    → ${returnItems.count} records deleted`);

  const returns       = await prisma.return.deleteMany();
  console.log(`   Return        → ${returns.count} records deleted`);

  const saleItems     = await prisma.saleItem.deleteMany();
  console.log(`   SaleItem      → ${saleItems.count} records deleted`);

  const sales         = await prisma.sale.deleteMany();
  console.log(`   Sale          → ${sales.count} records deleted`);

  const stockPurchases = await prisma.stockPurchase.deleteMany();
  console.log(`   StockPurchase → ${stockPurchases.count} records deleted`);

  const products      = await prisma.product.deleteMany();
  console.log(`   Product       → ${products.count} records deleted`);

  const categories    = await prisma.category.deleteMany();
  console.log(`   Category      → ${categories.count} records deleted`);

  // Confirm untouched tables
  const userCount     = await prisma.user.count();
  const settingsCount = await prisma.shopSettings.count();
  console.log(`\n   User          → ${userCount} accounts preserved ✓`);
  console.log(`   ShopSettings  → ${settingsCount} record(s) preserved ✓`);

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  ✅  Data reset complete. Your shop is ready for real use.");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("\n💥  Reset failed:", e.message);
  await prisma.$disconnect();
  process.exit(1);
});
