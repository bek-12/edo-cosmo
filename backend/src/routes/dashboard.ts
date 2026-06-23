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
  // totalEarned = sum of sale amounts - sum of return amounts in period
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

  // totalSpent = quantity * (variant.buyingPrice ?? product.buyingPrice) for each saleItem in period
  const saleItems = await prisma.saleItem.findMany({
    where: { sale: { createdAt: { gte: startDate } } },
    include: {
      product: { select: { buyingPrice: true } },
      variant: { select: { buyingPrice: true } },
    },
  });

  const totalSpent = saleItems.reduce((sum, item) => {
    const bp = item.variant?.buyingPrice ?? item.product.buyingPrice;
    return sum + item.quantity * bp;
  }, 0);

  const netProfit = totalEarned - totalSpent;
  return { totalSpent, totalEarned, netProfit, isLoss: netProfit < 0 };
}

// GET /api/dashboard
router.get("/", authenticate, async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);
    const in90Days = new Date(startOfToday.getTime() + 90 * 24 * 60 * 60 * 1000);

    // P&L period start dates
    const weekStart = new Date(startOfToday.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(startOfToday.getTime() - 30 * 24 * 60 * 60 * 1000);
    const yearStart = new Date(startOfToday.getTime() - 365 * 24 * 60 * 60 * 1000);

    // ── Sales revenue ────────────────────────────────────────────────────
    const totalSalesResult = await prisma.sale.aggregate({ _sum: { totalAmount: true } });
    const totalSalesRevenue = totalSalesResult._sum.totalAmount ?? 0;

    const totalSalesToday = await prisma.sale.count({
      where: { createdAt: { gte: startOfToday, lt: endOfToday } },
    });

    const salesTodayResult = await prisma.sale.aggregate({
      where: { createdAt: { gte: startOfToday, lt: endOfToday } },
      _sum: { totalAmount: true },
    });
    const salesTodayRevenue = salesTodayResult._sum.totalAmount ?? 0;

    // ── Returns ──────────────────────────────────────────────────────────
    const totalReturnsResult = await prisma.return.aggregate({ _sum: { totalAmount: true } });
    const totalReturnsAmount = totalReturnsResult._sum.totalAmount ?? 0;
    const totalReturnsCount = await prisma.return.count();

    const returnsTodayResult = await prisma.return.aggregate({
      where: { createdAt: { gte: startOfToday, lt: endOfToday } },
      _sum: { totalAmount: true },
    });
    const returnsTodayAmount = returnsTodayResult._sum.totalAmount ?? 0;
    const returnsTodayCount = await prisma.return.count({
      where: { createdAt: { gte: startOfToday, lt: endOfToday } },
    });

    // ── Net revenue ──────────────────────────────────────────────────────
    const totalRevenue = totalSalesRevenue - totalReturnsAmount;
    const revenueToday = salesTodayRevenue - returnsTodayAmount;

    // ── Low stock ────────────────────────────────────────────────────────
    const allProducts = await prisma.product.findMany({ include: { category: true, variants: true } });
    const productsWithStock = allProducts.map((p) => {
      const stock = p.hasVariants ? p.variants.reduce((s, v) => s + v.stock, 0) : p.stock;
      return { ...p, stock };
    });
    const lowStockProducts = productsWithStock.filter((p) => p.stock <= p.lowStockAlert);

    // ── Expiring products ────────────────────────────────────────────────
    const expiringProducts = await prisma.product.findMany({
      where: { expiryDate: { not: null, gte: startOfToday, lte: in90Days } },
      select: {
        id: true, name: true, expiryDate: true, stock: true,
        category: { select: { name: true } },
      },
      orderBy: { expiryDate: "asc" },
    });

    // ── Top 5 products ───────────────────────────────────────────────────
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

    // ── Revenue last 7 days (net) ────────────────────────────────────────
    const revenueLastDays: { date: string; revenue: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

      const [salesDay, returnsDay] = await Promise.all([
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
        revenue: (salesDay._sum.totalAmount ?? 0) - (returnsDay._sum.totalAmount ?? 0),
      });
    }

    // ── P&L ─────────────────────────────────────────────────────────────
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
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
