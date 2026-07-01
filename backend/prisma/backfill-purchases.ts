/**
 * backfill-purchases.ts
 *
 * One-time script: creates StockPurchase records for existing products
 * that have stock > 0 but no purchase history.
 *
 * Run once with: npm run backfill-purchases
 */

import { PrismaClient } from "@prisma/client";
require("dotenv").config();

const prisma = new PrismaClient();

async function main() {
  // Find the first admin user to assign as cashier
  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  if (!admin) {
    console.error("❌ No admin user found. Cannot backfill.");
    process.exit(1);
  }

  // Find products that have no StockPurchase records at all
  const products = await prisma.product.findMany({
    where: {
      stock: { gt: 0 },
      stockPurchases: { none: {} },
    },
  });

  if (products.length === 0) {
    console.log("✅ No products need backfilling — all products already have purchase records.");
    await prisma.$disconnect();
    return;
  }

  console.log(`📦 Backfilling ${products.length} products...\n`);

  let created = 0;
  for (const p of products) {
    if (p.buyingPrice > 0) {
      await prisma.stockPurchase.create({
        data: {
          productId: p.id,
          cashierId: admin.id,
          quantity: p.stock,
          buyingPrice: p.buyingPrice,
          totalCost: p.stock * p.buyingPrice,
          note: "Initial stock (backfilled)",
        },
      });
      console.log(`   ✓ ${p.name.padEnd(40)} ${p.stock} units × Birr ${p.buyingPrice}`);
      created++;
    } else {
      console.log(`   ⚠  ${p.name.padEnd(40)} skipped (buyingPrice is 0)`);
    }
  }

  console.log(`\n✅ Backfill complete. Created ${created} StockPurchase records.`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("💥 Backfill failed:", e.message);
  await prisma.$disconnect();
  process.exit(1);
});
