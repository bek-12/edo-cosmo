import { Router, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { authenticate, AuthRequest } from "../middleware/auth";

const router = Router();
const prisma = new PrismaClient();

function getPeriodStart(period: string): Date {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (period === "weekly") return new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  if (period === "monthly") return new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
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

    // Total spent (buying cost)
    const saleItems = await prisma.saleItem.findMany({
      where: { sale: { createdAt: { gte: start } } },
      include: {
        product: { select: { buyingPrice: true } },
        variant: { select: { buyingPrice: true } },
      },
    });
    const totalSpent = saleItems.reduce((sum, item) => {
      const bp = item.variant?.buyingPrice ?? item.product.buyingPrice;
      return sum + item.quantity * bp;
    }, 0);
    const netProfit = totalRevenue - totalSpent;

    // Top 10 products
    const topRaw = await prisma.saleItem.groupBy({
      by: ["productId", "variantId"],
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
        const variant = item.variantId
          ? await prisma.productVariant.findUnique({
              where: { id: item.variantId },
              select: { variantValue: true, variantType: true },
            })
          : null;
        return {
          productName: product?.name ?? "Unknown",
          variantValue: variant ? `${variant.variantType} ${variant.variantValue}` : null,
          unitsSold: item._sum.quantity ?? 0,
          revenue: (item._sum.priceAtSale ?? 0) * (item._sum.quantity ?? 0),
        };
      })
    );

    // Sales by day/week/month
    const salesByDay: { label: string; revenue: number; spent: number }[] = [];

    if (period === "weekly") {
      for (let i = 6; i >= 0; i--) {
        const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
        const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
        const [s, r, items] = await Promise.all([
          prisma.sale.aggregate({ where: { createdAt: { gte: dayStart, lt: dayEnd } }, _sum: { totalAmount: true } }),
          prisma.return.aggregate({ where: { createdAt: { gte: dayStart, lt: dayEnd } }, _sum: { totalAmount: true } }),
          prisma.saleItem.findMany({
            where: { sale: { createdAt: { gte: dayStart, lt: dayEnd } } },
            include: { product: { select: { buyingPrice: true } }, variant: { select: { buyingPrice: true } } },
          }),
        ]);
        const dayRevenue = (s._sum.totalAmount ?? 0) - (r._sum.totalAmount ?? 0);
        const daySpent = items.reduce((sum, it) => sum + it.quantity * (it.variant?.buyingPrice ?? it.product.buyingPrice), 0);
        salesByDay.push({ label: dayStart.toISOString().split("T")[0], revenue: dayRevenue, spent: daySpent });
      }
    } else if (period === "monthly") {
      for (let i = 3; i >= 0; i--) {
        const weekStart = new Date(now.getTime() - (i + 1) * 7 * 24 * 60 * 60 * 1000);
        const weekEnd = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
        const [s, r, items] = await Promise.all([
          prisma.sale.aggregate({ where: { createdAt: { gte: weekStart, lt: weekEnd } }, _sum: { totalAmount: true } }),
          prisma.return.aggregate({ where: { createdAt: { gte: weekStart, lt: weekEnd } }, _sum: { totalAmount: true } }),
          prisma.saleItem.findMany({
            where: { sale: { createdAt: { gte: weekStart, lt: weekEnd } } },
            include: { product: { select: { buyingPrice: true } }, variant: { select: { buyingPrice: true } } },
          }),
        ]);
        const rev = (s._sum.totalAmount ?? 0) - (r._sum.totalAmount ?? 0);
        const sp = items.reduce((sum, it) => sum + it.quantity * (it.variant?.buyingPrice ?? it.product.buyingPrice), 0);
        salesByDay.push({ label: `Week ${4 - i}`, revenue: rev, spent: sp });
      }
    } else {
      for (let i = 11; i >= 0; i--) {
        const mStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const mEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
        const [s, r, items] = await Promise.all([
          prisma.sale.aggregate({ where: { createdAt: { gte: mStart, lt: mEnd } }, _sum: { totalAmount: true } }),
          prisma.return.aggregate({ where: { createdAt: { gte: mStart, lt: mEnd } }, _sum: { totalAmount: true } }),
          prisma.saleItem.findMany({
            where: { sale: { createdAt: { gte: mStart, lt: mEnd } } },
            include: { product: { select: { buyingPrice: true } }, variant: { select: { buyingPrice: true } } },
          }),
        ]);
        const rev = (s._sum.totalAmount ?? 0) - (r._sum.totalAmount ?? 0);
        const sp = items.reduce((sum, it) => sum + it.quantity * (it.variant?.buyingPrice ?? it.product.buyingPrice), 0);
        salesByDay.push({
          label: mStart.toLocaleString("en-US", { month: "short", year: "2-digit" }),
          revenue: rev, spent: sp,
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

export default router;
