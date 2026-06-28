import { Router, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { authenticate, AuthRequest } from "../middleware/auth";

const router = Router();
const prisma = new PrismaClient();

// POST /api/stock/restock
router.post("/restock", authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const { productId, quantity, buyingPrice, note } = req.body;

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

// GET /api/stock/purchases
router.get("/purchases", authenticate, async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const purchases = await prisma.stockPurchase.findMany({
      include: {
        product: { select: { id: true, name: true, category: { select: { name: true } } } },
        cashier: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(purchases);
  } catch (error) {
    console.error("Get purchases error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
