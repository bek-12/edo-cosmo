import { Router, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { authenticate, AuthRequest } from "../middleware/auth";

const router = Router();
const prisma = new PrismaClient();

// GET /api/dashboard
router.get("/", authenticate, async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);
    const in90Days = new Date(startOfToday.getTime() + 90 * 24 * 60 * 60 * 1000);

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
    const allProducts = await prisma.product.findMany({ include: { category: true } });
    const lowStockProducts = allProducts.filter((p) => p.stock <= p.lowStockAlert);

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
    });
  } catch (error) {
    console.error("Dashboard error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
