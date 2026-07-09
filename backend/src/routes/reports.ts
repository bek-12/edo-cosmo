import { Router, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { authenticate, AuthRequest } from "../middleware/auth";

const router = Router();
const prisma = new PrismaClient();

function getPeriodStart(period: string): Date {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (period === "weekly")  return new Date(today.getTime() - 7   * 24 * 60 * 60 * 1000);
  if (period === "monthly") return new Date(today.getTime() - 30  * 24 * 60 * 60 * 1000);
  return new Date(today.getTime() - 365 * 24 * 60 * 60 * 1000);
}

// GET /api/reports/summary?period=weekly|monthly|yearly
router.get("/summary", authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const period = (req.query.period as string) || "weekly";
  const start = getPeriodStart(period);
  const now = new Date();

  try {
    // Sales & returns counts/amounts
    const [salesCount, returnsCount, salesAgg, returnsAgg] = await Promise.all([
      prisma.sale.count({ where: { createdAt: { gte: start } } }),
      prisma.return.count({ where: { createdAt: { gte: start } } }),
      prisma.sale.aggregate({ where: { createdAt: { gte: start } }, _sum: { totalAmount: true } }),
      prisma.return.aggregate({ where: { createdAt: { gte: start } }, _sum: { totalAmount: true } }),
    ]);

    const totalRevenue = (salesAgg._sum.totalAmount ?? 0) - (returnsAgg._sum.totalAmount ?? 0);
    const returnRate = salesCount > 0 ? (returnsCount / salesCount) * 100 : 0;

    // Total spent = all stock purchases in this period (cash-flow based, same as Dashboard P&L)
    const purchasesAgg = await prisma.stockPurchase.aggregate({
      where: { createdAt: { gte: start } },
      _sum: { totalCost: true },
    });
    const totalSpent = purchasesAgg._sum.totalCost ?? 0;
    const netProfit = totalRevenue - totalSpent;

    // Top 10 products — group only by productId
    const topRaw = await prisma.saleItem.groupBy({
      by: ["productId"],
      where: { sale: { createdAt: { gte: start } } },
      _sum: { quantity: true, priceAtSale: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 10,
    });

    const topProducts = await Promise.all(
      topRaw.map(async (item) => {
        const product = await prisma.product.findUnique({
          where: { id: item.productId },
          select: { name: true },
        });
        const unitsSold = item._sum?.quantity ?? 0;
        const revenue = (item._sum?.priceAtSale ?? 0) * unitsSold;
        return {
          productName: product?.name ?? "Unknown",
          unitsSold,
          revenue,
        };
      })
    );

    // Helper: stock purchase spend in a window (cash-flow based)
    const getSpent = async (from: Date, to: Date): Promise<number> => {
      const result = await prisma.stockPurchase.aggregate({
        where: { createdAt: { gte: from, lt: to } },
        _sum: { totalCost: true },
      });
      return result._sum.totalCost ?? 0;
    };

    // Sales by day/week/month
    const salesByDay: { label: string; revenue: number; spent: number }[] = [];

    if (period === "weekly") {
      for (let i = 6; i >= 0; i--) {
        const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
        const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
        const [s, r, sp] = await Promise.all([
          prisma.sale.aggregate({ where: { createdAt: { gte: dayStart, lt: dayEnd } }, _sum: { totalAmount: true } }),
          prisma.return.aggregate({ where: { createdAt: { gte: dayStart, lt: dayEnd } }, _sum: { totalAmount: true } }),
          getSpent(dayStart, dayEnd),
        ]);
        salesByDay.push({
          label: dayStart.toISOString().split("T")[0],
          revenue: (s._sum.totalAmount ?? 0) - (r._sum.totalAmount ?? 0),
          spent: sp,
        });
      }
    } else if (period === "monthly") {
      for (let i = 3; i >= 0; i--) {
        const wStart = new Date(now.getTime() - (i + 1) * 7 * 24 * 60 * 60 * 1000);
        const wEnd   = new Date(now.getTime() - i       * 7 * 24 * 60 * 60 * 1000);
        const [s, r, sp] = await Promise.all([
          prisma.sale.aggregate({ where: { createdAt: { gte: wStart, lt: wEnd } }, _sum: { totalAmount: true } }),
          prisma.return.aggregate({ where: { createdAt: { gte: wStart, lt: wEnd } }, _sum: { totalAmount: true } }),
          getSpent(wStart, wEnd),
        ]);
        salesByDay.push({
          label: `Week ${4 - i}`,
          revenue: (s._sum.totalAmount ?? 0) - (r._sum.totalAmount ?? 0),
          spent: sp,
        });
      }
    } else {
      for (let i = 11; i >= 0; i--) {
        const mStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const mEnd   = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
        const [s, r, sp] = await Promise.all([
          prisma.sale.aggregate({ where: { createdAt: { gte: mStart, lt: mEnd } }, _sum: { totalAmount: true } }),
          prisma.return.aggregate({ where: { createdAt: { gte: mStart, lt: mEnd } }, _sum: { totalAmount: true } }),
          getSpent(mStart, mEnd),
        ]);
        salesByDay.push({
          label: mStart.toLocaleString("en-US", { month: "short", year: "2-digit" }),
          revenue: (s._sum.totalAmount ?? 0) - (r._sum.totalAmount ?? 0),
          spent: sp,
        });
      }
    }

    res.json({
      period,
      totalSales: salesCount,
      totalRevenue,
      totalSpent,
      netProfit,
      isLoss: netProfit < 0,
      returnRate: Math.round(returnRate * 10) / 10,
      topProducts,
      salesByDay,
    });
  } catch (error) {
    console.error("Reports summary error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/reports/profit?period=weekly|monthly|yearly
router.get("/profit", authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const period = (req.query.period as string) || "weekly";
  const start  = getPeriodStart(period);
  const now    = new Date();

  try {
    // Fetch all sale items in period with product buying price
    const saleItems = await prisma.saleItem.findMany({
      where: { sale: { createdAt: { gte: start } } },
      include: {
        product: { select: { id: true, name: true, buyingPrice: true } },
        sale:    { select: { totalAmount: true } },
      },
    });

    // Fetch return items in period to subtract their profit contribution
    const returnItems = await prisma.returnItem.findMany({
      where: { return: { createdAt: { gte: start } } },
      include: { product: { select: { buyingPrice: true } } },
    });

    // Fetch revenue (sales minus returns)
    const [salesAgg, returnsAgg] = await Promise.all([
      prisma.sale.aggregate({ where: { createdAt: { gte: start } }, _sum: { totalAmount: true } }),
      prisma.return.aggregate({ where: { createdAt: { gte: start } }, _sum: { totalAmount: true } }),
    ]);
    const totalRevenue = (salesAgg._sum.totalAmount ?? 0) - (returnsAgg._sum.totalAmount ?? 0);

    // Calculate totals
    let totalGain = 0;
    let totalCost = 0;
    for (const item of saleItems) {
      const bp   = item.product.buyingPrice ?? 0;
      const gain = (item.priceAtSale - bp) * item.quantity;
      totalGain += gain;
      totalCost += bp * item.quantity;
    }
    // Subtract returned items' gain
    for (const ri of returnItems) {
      const bp         = ri.product.buyingPrice ?? 0;
      const returnGain = (ri.priceAtSale - bp) * ri.quantity;
      totalGain       -= returnGain;
    }

    const averageMarginPercent = totalRevenue > 0
      ? Math.round((totalGain / totalRevenue) * 1000) / 10
      : 0;

    // Per-product gain map
    const productMap: Record<string, { name: string; unitsSold: number; gain: number; revenue: number; cost: number }> = {};
    for (const item of saleItems) {
      const pid = item.product.id;
      if (!productMap[pid]) {
        productMap[pid] = { name: item.product.name, unitsSold: 0, gain: 0, revenue: 0, cost: 0 };
      }
      const bp = item.product.buyingPrice ?? 0;
      productMap[pid].unitsSold += item.quantity;
      productMap[pid].gain     += (item.priceAtSale - bp) * item.quantity;
      productMap[pid].revenue  += item.priceAtSale * item.quantity;
      productMap[pid].cost     += bp * item.quantity;
    }

    const topProfitableProducts = Object.entries(productMap)
      .map(([productId, v]) => ({
        productId,
        productName:    v.name,
        unitsSold:      v.unitsSold,
        totalGain:      Math.round(v.gain),
        totalRevenue:   Math.round(v.revenue),
        marginPercent:  v.revenue > 0 ? Math.round((v.gain / v.revenue) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.totalGain - a.totalGain)
      .slice(0, 10);

    // Helper: gain in a time window
    const getWindowGain = async (from: Date, to: Date) => {
      const items = await prisma.saleItem.findMany({
        where: { sale: { createdAt: { gte: from, lt: to } } },
        include: { product: { select: { buyingPrice: true } } },
      });
      const [sAgg, rAgg] = await Promise.all([
        prisma.sale.aggregate({ where: { createdAt: { gte: from, lt: to } }, _sum: { totalAmount: true } }),
        prisma.return.aggregate({ where: { createdAt: { gte: from, lt: to } }, _sum: { totalAmount: true } }),
      ]);
      const rev  = (sAgg._sum.totalAmount ?? 0) - (rAgg._sum.totalAmount ?? 0);
      const cost = items.reduce((s, i) => s + (i.product.buyingPrice ?? 0) * i.quantity, 0);
      const gain = items.reduce((s, i) => s + (i.priceAtSale - (i.product.buyingPrice ?? 0)) * i.quantity, 0);
      return { revenue: Math.round(rev), cost: Math.round(cost), gain: Math.round(gain) };
    };

    // Build time-series breakdown
    const gainByPeriod: { label: string; gain: number; revenue: number; cost: number }[] = [];
    if (period === "weekly") {
      for (let i = 6; i >= 0; i--) {
        const dStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
        const dEnd   = new Date(dStart.getTime() + 24 * 60 * 60 * 1000);
        const w = await getWindowGain(dStart, dEnd);
        gainByPeriod.push({ label: dStart.toISOString().split("T")[0], ...w });
      }
    } else if (period === "monthly") {
      for (let i = 3; i >= 0; i--) {
        const wStart = new Date(now.getTime() - (i + 1) * 7 * 24 * 60 * 60 * 1000);
        const wEnd   = new Date(now.getTime() - i       * 7 * 24 * 60 * 60 * 1000);
        const w = await getWindowGain(wStart, wEnd);
        gainByPeriod.push({ label: `Week ${4 - i}`, ...w });
      }
    } else {
      for (let i = 11; i >= 0; i--) {
        const mStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const mEnd   = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
        const w = await getWindowGain(mStart, mEnd);
        gainByPeriod.push({ label: mStart.toLocaleString("en-US", { month: "short", year: "2-digit" }), ...w });
      }
    }

    res.json({
      period,
      totalGain:            Math.round(totalGain),
      totalRevenue:         Math.round(totalRevenue),
      totalCost:            Math.round(totalCost),
      averageMarginPercent,
      gainByPeriod,
      topProfitableProducts,
    });
  } catch (error) {
    console.error("Profit report error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
