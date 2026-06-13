import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // Create categories
  const categoryNames = [
    "Foundation",
    "Primer",
    "Concealer",
    "Setting Spray",
    "Powder",
    "Lipstick",
    "Lip Gloss",
    "Brow",
  ];

  const categories: Record<string, string> = {};

  for (const name of categoryNames) {
    const category = await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    categories[name] = category.id;
    console.log(`✅ Category: ${name}`);
  }

  // Create products (skip if already exist by name)
  const productsData = [
    { name: "Fenty Foundation",      category: "Foundation",   buyingPrice: 7700,  sellingPrice: 10000, stock: 10 },
    { name: "NARS Foundation",       category: "Foundation",   buyingPrice: 10800, sellingPrice: 9500,  stock: 8  },
    { name: "Athena",                category: "Foundation",   buyingPrice: 3700,  sellingPrice: 5000,  stock: 15 },
    { name: "Maybelline Superstay",  category: "Foundation",   buyingPrice: 2600,  sellingPrice: 3600,  stock: 20 },
    { name: "e.l.f Primer",          category: "Primer",       buyingPrice: 2400,  sellingPrice: 3200,  stock: 12 },
    { name: "Born This Way",         category: "Foundation",   buyingPrice: 7000,  sellingPrice: 8500,  stock: 6  },
    { name: "e.l.f Concealer",       category: "Concealer",    buyingPrice: 1900,  sellingPrice: 2700,  stock: 18 },
    { name: "L'Oreal",               category: "Foundation",   buyingPrice: 3500,  sellingPrice: 5500,  stock: 10 },
    { name: "Urban Decay",           category: "Foundation",   buyingPrice: 6700,  sellingPrice: 8500,  stock: 5  },
    { name: "e.l.f Setting Spray",   category: "Setting Spray",buyingPrice: 1900,  sellingPrice: 3000,  stock: 14 },
    { name: "e.l.f Brow Laminate",   category: "Brow",         buyingPrice: 1700,  sellingPrice: 2700,  stock: 9  },
    { name: "Morphe Setting",        category: "Setting Spray",buyingPrice: 5000,  sellingPrice: 6500,  stock: 7  },
    { name: "Onesixe Setting",       category: "Setting Spray",buyingPrice: 6600,  sellingPrice: 7600,  stock: 4  },
    { name: "Laura Mercier",         category: "Powder",       buyingPrice: 8300,  sellingPrice: 9800,  stock: 6  },
    { name: "Huda Powder",           category: "Powder",       buyingPrice: 7800,  sellingPrice: 8500,  stock: 8  },
    { name: "NYX Lipstick",          category: "Lipstick",     buyingPrice: 2000,  sellingPrice: 3000,  stock: 25 },
    { name: "Essence Primer",        category: "Primer",       buyingPrice: 1500,  sellingPrice: 2000,  stock: 20 },
    { name: "NYX Lip Gloss",         category: "Lip Gloss",    buyingPrice: 1800,  sellingPrice: 3000,  stock: 15 },
    { name: "Fit Me Powder",         category: "Powder",       buyingPrice: 1900,  sellingPrice: 3000,  stock: 12 },
    { name: "Sephora Lipstick",      category: "Lipstick",     buyingPrice: 3800,  sellingPrice: 10000, stock: 5  },
  ];

  for (const p of productsData) {
    // Check if product already exists by name
    const existing = await prisma.product.findFirst({ where: { name: p.name } });
    if (!existing) {
      await prisma.product.create({
        data: {
          name: p.name,
          categoryId: categories[p.category],
          buyingPrice: p.buyingPrice,
          sellingPrice: p.sellingPrice,
          stock: p.stock,
          lowStockAlert: 5,
        },
      });
    }
    console.log(`✅ Product: ${p.name}`);
  }

  // Create admin user
  const hashedPassword = await bcrypt.hash("admin123", 10);
  await prisma.user.upsert({
    where: { email: "admin@shop.com" },
    update: {},
    create: {
      name: "Admin",
      email: "admin@shop.com",
      password: hashedPassword,
      role: "ADMIN",
    },
  });
  console.log("✅ Admin user: admin@shop.com / admin123");

  console.log("🎉 Seeding complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
