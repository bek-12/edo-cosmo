import { Router, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { authenticate, AuthRequest } from "../middleware/auth";
import { getPeriodRange } from "../utils/periods";

const router = Router();
const prisma = new PrismaClient();

interface PnLPeriod {
  totalEarned: number;
  totalSpent: number;
  netProfit: number;
  isLoss: boolean;
}

async function calcPnL(start: Date, end: Date): Promise<PnLPeriod> {
  const where = { createdAt: { gte: start, lt: end } };
  const [salesAgg, returnsAgg, spendAgg] = await Promise.all([
    prisma.sale.aggregate({ where, _sum: { totalAmount: true } }),
    prisma.return.aggregate({ where, _sum: { totalAmount: true } }),
    prisma.stockPurchase.aggregate({ where, _sum: { totalCost: true } })
      .catch(() => ({ _sum: { totalCost: 0 } })),
  ]);

  const totalEarned = (salesAgg._sum.totalAmount ?? 0) - (returnsAgg._sum.totalAmount ?? 0);
  const totalSpent  = spendAgg._sum.totalCost ?? 0;
  const netProfit   = totalEarned - totalSpent;
  return { totalEarned, totalSpent, netProfit, isLoss: netProfit < 0 };
}

// GET /api/dashboard
router.get("/", authenticate, async (_req: AuthRequest, res: Response): Promise<void> => {
  console.log("Dashboard route hit");
  try {
    const now          = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday   = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);
    const in90Days     = new Date(startOfToday.getTime() + 90 * 24 * 60 * 60 * 1000);

    const weekly  = getPeriodRange("weekly");
    const monthly = getPeriodRange("monthly");
    const yearly  = getPeriodRange("yearly");

    // Revenue all-time
    const [allSalesAgg, allReturnsAgg] = await Promise.all([
      prisma.sale.aggregate({ _sum: { totalAmount: true } }),
      prisma.return.aggregate({ _sum: { totalAmount: true } }),
    ]);
    const totalRevenue =
      (allSalesAgg._sum.totalAmount ?? 0) - (allReturnsAgg._sum.totalAmount ?? 0);
    const totalReturnsAmount = allReturnsAgg._sum.totalAmount ?? 0;
    const totalReturnsCount  = await prisma.return.count();

    // Today
    const totalSalesToday = await prisma.sale.count({
      where: { createdAt: { gte: startOfToday, lt: endOfToday } },
    });
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
    const revenueToday       = (salesTodayAgg._sum.totalAmount ?? 0) - (returnsTodayAgg._sum.totalAmount ?? 0);
    const returnsTodayAmount = returnsTodayAgg._sum.totalAmount ?? 0;
    const returnsTodayCount  = await prisma.return.count({
      where: { createdAt: { gte: startOfToday, lt: endOfToday } },
    });

    // Low stock — fetch all, filter in JS (Prisma can't compare two columns)
    const allProducts = await prisma.product.findMany({ include: { category: true } });
    const lowStockProducts = allProducts.filter((p) => p.stock <= p.lowStockAlert);

    // Expiring products
    const expiringProducts = await prisma.product.findMany({
      where: { expiryDate: { not: null, gte: startOfToday, lte: in90Days } },
      select: {
        id: true, name: true, expiryDate: true, stock: true,
        category: { select: { name: true } },
      },
      orderBy: { expiryDate: "asc" },
    });

    // Top 5 products by quantity sold
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
          select: { id: true, name: true },
        });
        return { product, totalQuantity: row._sum.quantity ?? 0 };
      })
    );

    // Revenue last 7 days
    const revenueLastDays: { date: string; revenue: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const dayEnd   = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
      const [s, r] = await Promise.all([
        prisma.sale.aggregate({ where: { createdAt: { gte: dayStart, lt: dayEnd } }, _sum: { totalAmount: true } }),
        prisma.return.aggregate({ where: { createdAt: { gte: dayStart, lt: dayEnd } }, _sum: { totalAmount: true } }),
      ]);
      revenueLastDays.push({
        date: dayStart.toISOString().split("T")[0],
        revenue: (s._sum.totalAmount ?? 0) - (r._sum.totalAmount ?? 0),
      });
    }

    // P&L — calendar-based periods
    const [pnlWeekly, pnlMonthly, pnlYearly] = await Promise.all([
      calcPnL(weekly.start,  weekly.end),
      calcPnL(monthly.start, monthly.end),
      calcPnL(yearly.start,  yearly.end),
    ]);

    res.json({
      totalRevenue,
      totalReturnsAmount,
      totalReturnsCount,
      totalSalesToday,
      revenueToday,
      returnsTodayAmount,
      returnsTodayCount,
      lowStockProducts,
      expiringProducts,
      topProducts,
      revenueLastDays,
      pnl: { weekly: pnlWeekly, monthly: pnlMonthly, yearly: pnlYearly },
    });
  } catch (error) {
    const err = error as Error;
    console.error("Dashboard error:", err.message);
    console.error("Dashboard full error:", err);
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

export default router;
