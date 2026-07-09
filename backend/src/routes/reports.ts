import { Router, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { authenticate, AuthRequest } from "../middleware/auth";
import { getPeriodRange } from "../utils/periods";

const router = Router();
const prisma = new PrismaClient();

function getPeriodStart(period: string): Date {
  return getPeriodRange(period).start;
}

// GET /api/reports/summary?period=weekly|monthly|yearly
router.get("/summary", authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const period = (req.query.period as string) || "weekly";
  const { start, end } = getPeriodRange(period);
  const now = new Date();

  try {
    // Sales & returns counts/amounts
    const [salesCount, returnsCount, salesAgg, returnsAgg] = await Promise.all([
      prisma.sale.count({ where: { createdAt: { gte: start, lt: end } } }),
      prisma.return.count({ where: { createdAt: { gte: start, lt: end } } }),
      prisma.sale.aggregate({ where: { createdAt: { gte: start, lt: end } }, _sum: { totalAmount: true } }),
      prisma.return.aggregate({ where: { createdAt: { gte: start, lt: end } }, _sum: { totalAmount: true } }),
    ]);

    const totalRevenue = (salesAgg._sum.totalAmount ?? 0) - (returnsAgg._sum.totalAmount ?? 0);
    const returnRate   = salesCount > 0 ? (returnsCount / salesCount) * 100 : 0;

    // Total spent = all stock purchases in this calendar period
    const purchasesAgg = await prisma.stockPurchase.aggregate({
      where: { createdAt: { gte: start, lt: end } },
      _sum: { totalCost: true },
    });
    const totalSpent = purchasesAgg._sum.totalCost ?? 0;
    const netProfit  = totalRevenue - totalSpent;

    // Top 10 products
    const topRaw = await prisma.saleItem.groupBy({
      by: ["productId"],
      where: { sale: { createdAt: { gte: start, lt: end } } },
      _sum: { quantity: true, priceAtSale: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 10,
    });

    const topProducts = await Promise.all(
      topRaw.map(async (item) => {
        const product  = await prisma.product.findUnique({ where: { id: item.productId }, select: { name: true } });
        const unitsSold = item._sum?.quantity ?? 0;
        const revenue   = (item._sum?.priceAtSale ?? 0) * unitsSold;
        return { productName: product?.name ?? "Unknown", unitsSold, revenue };
      })
    );

    // Helper: stock purchase spend in a window
    const getSpent = async (from: Date, to: Date): Promise<number> => {
      const result = await prisma.stockPurchase.aggregate({
        where: { createdAt: { gte: from, lt: to } },
        _sum: { totalCost: true },
      });
      return result._sum.totalCost ?? 0;
    };

    // Calendar-aligned breakdown chart
    const salesByDay: { label: string; revenue: number; spent: number }[] = [];

    if (period === "weekly") {
      // Monday–Sunday, 7 fixed points
      for (let i = 0; i < 7; i++) {
        const dayStart = new Date(start);
        dayStart.setDate(start.getDate() + i);
        const dayEnd = new Date(dayStart);
        dayEnd.setDate(dayStart.getDate() + 1);
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
      // Week 1–N buckets within the current month
      let cursor = new Date(start);
      let weekNum = 1;
      while (cursor < end) {
        const weekEnd = new Date(cursor);
        weekEnd.setDate(cursor.getDate() + 7);
        const bucketEnd = weekEnd < end ? weekEnd : end;
        const [s, r, sp] = await Promise.all([
          prisma.sale.aggregate({ where: { createdAt: { gte: cursor, lt: bucketEnd } }, _sum: { totalAmount: true } }),
          prisma.return.aggregate({ where: { createdAt: { gte: cursor, lt: bucketEnd } }, _sum: { totalAmount: true } }),
          getSpent(cursor, bucketEnd),
        ]);
        salesByDay.push({
          label: `Week ${weekNum}`,
          revenue: (s._sum.totalAmount ?? 0) - (r._sum.totalAmount ?? 0),
          spent: sp,
        });
        cursor = weekEnd;
        weekNum++;
      }
    } else {
      // Jan–Dec, 12 fixed months
      for (let m = 0; m < 12; m++) {
        const mStart = new Date(now.getFullYear(), m, 1);
        const mEnd   = new Date(now.getFullYear(), m + 1, 1);
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
      totalSales:  salesCount,
      totalRevenue,
      totalSpent,
      netProfit,
      isLoss:     netProfit < 0,
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
  const { start, end } = getPeriodRange(period);
  const now = new Date();

  try {
    const saleItems = await prisma.saleItem.findMany({
      where: { sale: { createdAt: { gte: start, lt: end } } },
      include: {
        product: { select: { id: true, name: true, buyingPrice: true } },
        sale:    { select: { totalAmount: true } },
      },
    });

    const returnItems = await prisma.returnItem.findMany({
      where: { return: { createdAt: { gte: start, lt: end } } },
      include: { product: { select: { buyingPrice: true } } },
    });

    const [salesAgg, returnsAgg] = await Promise.all([
      prisma.sale.aggregate({ where: { createdAt: { gte: start, lt: end } }, _sum: { totalAmount: true } }),
      prisma.return.aggregate({ where: { createdAt: { gte: start, lt: end } }, _sum: { totalAmount: true } }),
    ]);
    const totalRevenue = (salesAgg._sum.totalAmount ?? 0) - (returnsAgg._sum.totalAmount ?? 0);

    let totalGain = 0;
    let totalCost = 0;
    for (const item of saleItems) {
      const bp = item.product.buyingPrice ?? 0;
      totalGain += (item.priceAtSale - bp) * item.quantity;
      totalCost += bp * item.quantity;
    }
    for (const ri of returnItems) {
      const bp = ri.product.buyingPrice ?? 0;
      totalGain -= (ri.priceAtSale - bp) * ri.quantity;
    }

    const averageMarginPercent = totalRevenue > 0
      ? Math.round((totalGain / totalRevenue) * 1000) / 10 : 0;

    const productMap: Record<string, { name: string; unitsSold: number; gain: number; revenue: number; cost: number }> = {};
    for (const item of saleItems) {
      const pid = item.product.id;
      if (!productMap[pid]) productMap[pid] = { name: item.product.name, unitsSold: 0, gain: 0, revenue: 0, cost: 0 };
      const bp = item.product.buyingPrice ?? 0;
      productMap[pid].unitsSold += item.quantity;
      productMap[pid].gain     += (item.priceAtSale - bp) * item.quantity;
      productMap[pid].revenue  += item.priceAtSale * item.quantity;
      productMap[pid].cost     += bp * item.quantity;
    }

    const topProfitableProducts = Object.entries(productMap)
      .map(([productId, v]) => ({
        productId,
        productName:   v.name,
        unitsSold:     v.unitsSold,
        totalGain:     Math.round(v.gain),
        totalRevenue:  Math.round(v.revenue),
        marginPercent: v.revenue > 0 ? Math.round((v.gain / v.revenue) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.totalGain - a.totalGain)
      .slice(0, 10);

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

    const gainByPeriod: { label: string; gain: number; revenue: number; cost: number }[] = [];
    if (period === "weekly") {
      for (let i = 0; i < 7; i++) {
        const dStart = new Date(start); dStart.setDate(start.getDate() + i);
        const dEnd   = new Date(dStart); dEnd.setDate(dStart.getDate() + 1);
        const w = await getWindowGain(dStart, dEnd);
        gainByPeriod.push({ label: dStart.toISOString().split("T")[0], ...w });
      }
    } else if (period === "monthly") {
      let cursor = new Date(start); let wk = 1;
      while (cursor < end) {
        const wEnd = new Date(cursor); wEnd.setDate(cursor.getDate() + 7);
        const bucketEnd = wEnd < end ? wEnd : end;
        const w = await getWindowGain(cursor, bucketEnd);
        gainByPeriod.push({ label: `Week ${wk}`, ...w });
        cursor = wEnd; wk++;
      }
    } else {
      for (let m = 0; m < 12; m++) {
        const mStart = new Date(now.getFullYear(), m, 1);
        const mEnd   = new Date(now.getFullYear(), m + 1, 1);
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
