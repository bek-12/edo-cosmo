import { Router, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { authenticate, AuthRequest } from "../middleware/auth";

const router = Router();
const prisma = new PrismaClient();

// POST /api/stock/restock
router.post("/restock", authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const { productId, quantity, buyingPrice, sellingPrice, note } = req.body;

  if (!productId || quantity == null || buyingPrice == null) {
    res.status(400).json({ message: "productId, quantity, and buyingPrice are required" });
    return;
  }
  if (Number(quantity) < 1) {
    res.status(400).json({ message: "quantity must be at least 1" });
    return;
  }

  const cashierId = req.user!.id;
  const qty = Number(quantity);
  const bp  = Number(buyingPrice);
  const totalCost = qty * bp;

  try {
    const existing = await prisma.product.findUnique({ where: { id: productId } });
    if (!existing) {
      res.status(404).json({ message: "Product not found" });
      return;
    }

    const sp = sellingPrice != null ? Number(sellingPrice) : null;

    const [purchase, updatedProduct] = await prisma.$transaction([
      prisma.stockPurchase.create({
        data: {
          productId,
          cashierId,
          quantity: qty,
          buyingPrice: bp,
          totalCost,
          note: note || null,
        },
        include: {
          product: { select: { id: true, name: true } },
          cashier: { select: { id: true, name: true } },
        },
      }),
      prisma.product.update({
        where: { id: productId },
        data: {
          stock: { increment: qty },
          buyingPrice: bp,
          ...(sp != null && sp > 0 ? { sellingPrice: sp } : {}),
        },
        include: { category: true },
      }),
    ]);

    res.status(201).json({ purchase, product: updatedProduct });
  } catch (error) {
    console.error("Restock error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/stock/purchases  (with pagination)
router.get("/purchases", authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const page  = Math.max(1, parseInt(String(req.query.page  ?? 1)));
    const limit = Math.max(1, parseInt(String(req.query.limit ?? 15)));
    const skip  = (page - 1) * limit;

    const [purchases, total] = await Promise.all([
      prisma.stockPurchase.findMany({
        include: {
          product: { select: { id: true, name: true, category: { select: { name: true } } } },
          cashier: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.stockPurchase.count(),
    ]);

    res.json({ purchases, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (error) {
    console.error("Get purchases error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/stock/stats  – top restocked products + total invested
router.get("/stats", authenticate, async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const [grouped, totalInvested] = await Promise.all([
      prisma.stockPurchase.groupBy({
        by: ["productId"],
        _sum: { quantity: true, totalCost: true },
        _count: { id: true },
        orderBy: { _sum: { quantity: "desc" } },
        take: 5,
      }),
      prisma.stockPurchase.aggregate({ _sum: { totalCost: true } }),
    ]);

    // fetch product names
    const productIds = grouped.map((g) => g.productId);
    const products   = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true, category: { select: { name: true } } },
    });
    const productMap = Object.fromEntries(products.map((p) => [p.id, p]));

    const topRestocked = grouped.map((g) => ({
      productId:   g.productId,
      productName: productMap[g.productId]?.name ?? "Unknown",
      category:    productMap[g.productId]?.category?.name ?? "",
      totalQty:    g._sum.quantity ?? 0,
      totalCost:   g._sum.totalCost ?? 0,
      restockCount: g._count.id,
    }));

    res.json({
      totalInvested: totalInvested._sum.totalCost ?? 0,
      topRestocked,
    });
  } catch (error) {
    console.error("Stock stats error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/stock/report?period=weekly|monthly|yearly
router.get("/report", authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const period = ((req.query.period as string) || "weekly").toLowerCase();
    const now    = new Date();
    let startDate: Date;

    if (period === "yearly") {
      startDate = new Date(now);
      startDate.setFullYear(now.getFullYear() - 1);
      startDate.setHours(0, 0, 0, 0);
    } else if (period === "monthly") {
      startDate = new Date(now);
      startDate.setDate(now.getDate() - 30);
      startDate.setHours(0, 0, 0, 0);
    } else {
      // weekly — last 7 days
      startDate = new Date(now);
      startDate.setDate(now.getDate() - 7);
      startDate.setHours(0, 0, 0, 0);
    }

    const where = { createdAt: { gte: startDate } };

    // Aggregates
    const [agg, purchases] = await Promise.all([
      prisma.stockPurchase.aggregate({
        where,
        _sum: { totalCost: true, quantity: true },
        _count: { _all: true },
      }),
      prisma.stockPurchase.findMany({
        where,
        include: {
          product: { select: { id: true, name: true, category: { select: { name: true } } } },
          cashier: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    // Spending by day/bucket
    const bucketMap: Record<string, number> = {};
    for (const p of purchases) {
      let key: string;
      const d = new Date(p.createdAt);
      if (period === "weekly") {
        key = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      } else if (period === "monthly") {
        // group by week number within month
        const weekNum = Math.ceil(d.getDate() / 7);
        key = `Week ${weekNum}`;
      } else {
        key = d.toLocaleDateString("en-US", { month: "short" });
      }
      bucketMap[key] = (bucketMap[key] ?? 0) + p.totalCost;
    }
    const spendingByDay = Object.entries(bucketMap).map(([date, amount]) => ({ date, amount }));

    // Top restocked products in period
    const productTotals: Record<string, { productName: string; category: string; totalQty: number; totalCost: number }> = {};
    for (const p of purchases) {
      const pid = p.productId;
      if (!productTotals[pid]) {
        productTotals[pid] = {
          productName: p.product.name,
          category: p.product.category.name,
          totalQty: 0,
          totalCost: 0,
        };
      }
      productTotals[pid].totalQty  += p.quantity;
      productTotals[pid].totalCost += p.totalCost;
    }
    const topRestockedProducts = Object.entries(productTotals)
      .map(([productId, v]) => ({ productId, ...v }))
      .sort((a, b) => b.totalCost - a.totalCost)
      .slice(0, 10);

    // Recent 10 purchases
    const recentPurchases = purchases.slice(0, 10).map((p) => ({
      id: p.id,
      date: p.createdAt,
      productName: p.product.name,
      category: p.product.category.name,
      quantity: p.quantity,
      buyingPrice: p.buyingPrice,
      totalCost: p.totalCost,
      restockedBy: p.cashier.name,
    }));

    res.json({
      period,
      totalSpent: agg._sum.totalCost ?? 0,
      totalPurchases: agg._count._all,
      totalUnitsRestocked: agg._sum.quantity ?? 0,
      spendingByDay,
      topRestockedProducts,
      recentPurchases,
    });
  } catch (error) {
    console.error("Stock report error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
