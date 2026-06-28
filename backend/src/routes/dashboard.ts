import { Router, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { authenticate, AuthRequest } from "../middleware/auth";

const router = Router();
const prisma = new PrismaClient();

interface PnLPeriod {
  totalSpent: number;
  totalEarned: number;
  netProfit: number;
  isLoss: boolean;
}

async function calcPnL(startDate: Date): Promise<PnLPeriod> {
  const [salesResult, returnsResult] = await Promise.all([
    prisma.sale.aggregate({
      where: { createdAt: { gte: startDate } },
      _sum: { totalAmount: true },
    }),
    prisma.return.aggregate({
      where: { createdAt: { gte: startDate } },
      _sum: { totalAmount: true },
    }),
  ]);

  const totalEarned =
    (salesResult._sum.totalAmount ?? 0) - (returnsResult._sum.totalAmount ?? 0);

  // Spending = buyingPrice * stock for products created in this period
  const productsCreated = await prisma.product.findMany({
    where: { createdAt: { gte: startDate } },
    select: { buyingPrice: true, stock: true },
  });

  const totalSpent = productsCreated.reduce(
    (sum, p) => sum + p.buyingPrice * p.stock,
    0
  );

  const netProfit = totalEarned - totalSpent;
  return { totalSpent, totalEarned, netProfit, isLoss: netProfit < 0 };
}

// GET /api/dashboard
router.get("/", authenticate, async (_req: AuthRequest, res: Response): Promise<void> => {
  console.log("Dashboard route hit");
  try {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday   = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);
    const in90Days     = new Date(startOfToday.getTime() + 90 * 24 * 60 * 60 * 1000);
    const weekStart    = new Date(startOfToday.getTime() - 7   * 24 * 60 * 60 * 1000);
    const monthStart   = new Date(startOfToday.getTime() - 30  * 24 * 60 * 60 * 1000);
    const yearStart    = new Date(startOfToday.getTime() - 365 * 24 * 60 * 60 * 1000);

    // ── Sales revenue ─────────────────────────────────────────────────
    const [totalSalesResult, salesTodayResult, totalSalesToday] = await Promise.all([
      prisma.sale.aggregate({ _sum: { totalAmount: true } }),
      prisma.sale.aggregate({
        where: { createdAt: { gte: startOfToday, lt: endOfToday } },
        _sum: { totalAmount: true },
      }),
      prisma.sale.count({
        where: { createdAt: { gte: startOfToday, lt: endOfToday } },
      }),
    ]);
    const totalSalesRevenue = totalSalesResult._sum.totalAmount ?? 0;
    const salesTodayRevenue = salesTodayResult._sum.totalAmount ?? 0;

    // ── Returns ───────────────────────────────────────────────────────
    const [totalReturnsResult, returnsTodayResult, totalReturnsCount, returnsTodayCount] =
      await Promise.all([
        prisma.return.aggregate({ _sum: { totalAmount: true } }),
        prisma.return.aggregate({
          where: { createdAt: { gte: startOfToday, lt: endOfToday } },
          _sum: { totalAmount: true },
        }),
        prisma.return.count(),
        prisma.return.count({
          where: { createdAt: { gte: startOfToday, lt: endOfToday } },
        }),
      ]);
    const totalReturnsAmount  = totalReturnsResult._sum.totalAmount  ?? 0;
    const returnsTodayAmount  = returnsTodayResult._sum.totalAmount  ?? 0;

    const totalRevenue = totalSalesRevenue - totalReturnsAmount;
    const revenueToday = salesTodayRevenue - returnsTodayAmount;

    // ── Low stock ─────────────────────────────────────────────────────
    const allProducts = await prisma.product.findMany({
      include: { category: true },
    });
    const lowStockProducts = allProducts.filter((p) => p.stock <= p.lowStockAlert);

    // ── Expiring products ─────────────────────────────────────────────
    const expiringProducts = await prisma.product.findMany({
      where: {
        expiryDate: { not: null, gte: startOfToday, lte: in90Days },
      },
      select: {
        id: true, name: true, expiryDate: true, stock: true,
        category: { select: { name: true } },
      },
      orderBy: { expiryDate: "asc" },
    });

    // ── Top 5 products ────────────────────────────────────────────────
    const topProductsRaw = await prisma.saleItem.groupBy({
      by: ["productId"],
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 5,
    });

    const topProducts = await Promise.all(
      topProductsRaw.map(async (item) => {
        const product = await prisma.product.findUnique({
          where: { id: item.productId },
          select: { id: true, name: true },
        });
        return { product, totalQuantity: item._sum.quantity ?? 0 };
      })
    );

    // ── Revenue last 7 days (net) ─────────────────────────────────────
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

    // ── P&L ───────────────────────────────────────────────────────────
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
      lowStockProducts,
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
