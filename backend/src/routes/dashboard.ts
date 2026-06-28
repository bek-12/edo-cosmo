import { Router, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { authenticate, AuthRequest } from "../middleware/auth";

const router = Router();
const prisma = new PrismaClient();

// Helper: calculate P&L for a given start date up to now
async function calcPnL(start: Date) {
  // totalEarned = sales revenue - returns revenue in period
  const [salesAgg, returnsAgg] = await Promise.all([
    prisma.sale.aggregate({
      where: { createdAt: { gte: start } },
      _sum: { totalAmount: true },
    }),
    prisma.return.aggregate({
      where: { createdAt: { gte: start } },
      _sum: { totalAmount: true },
    }),
  ]);
  const totalEarned =
    (salesAgg._sum.totalAmount ?? 0) - (returnsAgg._sum.totalAmount ?? 0);

  // totalSpent = for each SaleItem in period, quantity * product.buyingPrice
  const items = await prisma.saleItem.findMany({
    where: { sale: { createdAt: { gte: start } } },
    select: {
      quantity: true,
      product: { select: { buyingPrice: true } },
    },
  });
  const totalSpent = items.reduce(
    (sum, item) => sum + item.quantity * item.product.buyingPrice,
    0
  );

  const netProfit = totalEarned - totalSpent;
  return { totalEarned, totalSpent, netProfit, isLoss: netProfit < 0 };
}

// GET /api/dashboard
router.get("/", authenticate, async (_req: AuthRequest, res: Response): Promise<void> => {
  console.log("Dashboard route hit");
  try {
    const now = new Date();

    // Today: midnight → now
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday   = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);

    // 90 days from today for expiry check
    const in90Days = new Date(startOfToday.getTime() + 90 * 24 * 60 * 60 * 1000);

    // P&L period starts
    const weekStart  = new Date(startOfToday.getTime() - 7   * 24 * 60 * 60 * 1000);
    const monthStart = new Date(startOfToday.getTime() - 30  * 24 * 60 * 60 * 1000);
    const yearStart  = new Date(startOfToday.getTime() - 365 * 24 * 60 * 60 * 1000);

    // 1. totalRevenue = all sales - all returns
    const [allSalesAgg, allReturnsAgg] = await Promise.all([
      prisma.sale.aggregate({ _sum: { totalAmount: true } }),
      prisma.return.aggregate({ _sum: { totalAmount: true } }),
    ]);
    const totalRevenue =
      (allSalesAgg._sum.totalAmount ?? 0) - (allReturnsAgg._sum.totalAmount ?? 0);

    // 2. totalSalesToday
    const totalSalesToday = await prisma.sale.count({
      where: { createdAt: { gte: startOfToday, lt: endOfToday } },
    });

    // 3. revenueToday = sales today - returns today
    const [salesTodayAgg, returnsTodayAgg] = await Promise.all([
      prisma.sale.aggregate({
        where: { createdAt: { gte: startOfToday, lt: endOfToday } },
        _sum: { totalAmount: true },
      }),
      prisma.return.aggregate({
        where: { createdAt: { gte: startOfToday, lt: endOfToday } },
        _sum: { totalAmount: true },
      }),
    ]);
    const revenueToday =
      (salesTodayAgg._sum.totalAmount ?? 0) - (returnsTodayAgg._sum.totalAmount ?? 0);

    // Extra stats used by frontend
    const totalReturnsAmount = allReturnsAgg._sum.totalAmount ?? 0;
    const totalReturnsCount  = await prisma.return.count();
    const returnsTodayAmount = returnsTodayAgg._sum.totalAmount ?? 0;
    const returnsTodayCount  = await prisma.return.count({
      where: { createdAt: { gte: startOfToday, lt: endOfToday } },
    });

    // 4. lowStockProducts: stock <= lowStockAlert (fetch all, filter in JS since Prisma can't compare two columns)
    const allProducts = await prisma.product.findMany({
      include: { category: true },
    });
    const lowStock = allProducts.filter((p) => p.stock <= p.lowStockAlert);

    // 5. topProducts: top 5 by total quantity sold
    const topRaw = await prisma.saleItem.groupBy({
      by: ["productId"],
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 5,
    });

    const topProducts = await Promise.all(
      topRaw.map(async (row) => {
        const product = await prisma.product.findUnique({
          where: { id: row.productId },
          select: { id: true, name: true, category: { select: { name: true } } },
        });
        return {
          product,
          totalQuantity: row._sum.quantity ?? 0,
        };
      })
    );

    // 6. revenueLastDays: last 7 days
    const revenueLastDays: { date: string; revenue: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const dayEnd   = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

      const [s, r] = await Promise.all([
        prisma.sale.aggregate({
          where: { createdAt: { gte: dayStart, lt: dayEnd } },
          _sum: { totalAmount: true },
        }),
        prisma.return.aggregate({
          where: { createdAt: { gte: dayStart, lt: dayEnd } },
          _sum: { totalAmount: true },
        }),
      ]);

      revenueLastDays.push({
        date: dayStart.toISOString().split("T")[0],
        revenue: (s._sum.totalAmount ?? 0) - (r._sum.totalAmount ?? 0),
      });
    }

    // 7. expiringProducts: expiryDate is set and within 90 days
    const expiringProducts = await prisma.product.findMany({
      where: {
        expiryDate: { not: null, gte: startOfToday, lte: in90Days },
      },
      select: {
        id: true,
        name: true,
        expiryDate: true,
        stock: true,
        category: { select: { name: true } },
      },
      orderBy: { expiryDate: "asc" },
    });

    // 8. P&L for weekly / monthly / yearly
    const [weekly, monthly, yearly] = await Promise.all([
      calcPnL(weekStart),
      calcPnL(monthStart),
      calcPnL(yearStart),
    ]);

    res.json({
      totalRevenue,
      totalReturnsAmount,
      totalReturnsCount,
      totalSalesToday,
      revenueToday,
      returnsTodayAmount,
      returnsTodayCount,
      lowStockProducts: lowStock,
      expiringProducts,
      topProducts,
      revenueLastDays,
      pnl: { weekly, monthly, yearly },
    });
  } catch (error) {
    console.error("Dashboard error:", error);
    res.status(500).json({ error: String(error) });
  }
});

export default router;
