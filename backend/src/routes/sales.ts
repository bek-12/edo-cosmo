import { Router, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { authenticate, AuthRequest } from "../middleware/auth";

const router = Router();
const prisma = new PrismaClient();

// GET /api/sales
router.get("/", authenticate, async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const sales = await prisma.sale.findMany({
      include: {
        cashier: { select: { id: true, name: true, email: true } },
        items: {
          select: {
            id: true,
            productId: true,
            quantity: true,
            priceAtSale: true,
            product: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(sales);
  } catch (error) {
    console.error("Get sales error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/sales
router.post("/", authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const { items } = req.body as {
    items: { productId: string; quantity: number; priceAtSale: number }[];
  };

  if (!items || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({ message: "items array is required" });
    return;
  }

  const cashierId = req.user!.id;

  try {
    // Validate stock for all items first
    for (const item of items) {
      const product = await prisma.product.findUnique({ where: { id: item.productId } });
      if (!product) {
        res.status(404).json({ message: `Product ${item.productId} not found` });
        return;
      }
      if (product.stock < item.quantity) {
        res.status(400).json({
          message: `Insufficient stock for "${product.name}". Available: ${product.stock}`,
        });
        return;
      }
    }

    const totalAmount = items.reduce(
      (sum, item) => sum + item.priceAtSale * item.quantity,
      0
    );

    // Create sale and deduct stock in a transaction
    const sale = await prisma.$transaction(async (tx) => {
      const newSale = await tx.sale.create({
        data: {
          cashierId,
          totalAmount,
          items: {
            create: items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              priceAtSale: item.priceAtSale,
            })),
          },
        },
        include: {
          cashier: { select: { id: true, name: true, email: true } },
          items: {
            include: {
              product: { select: { id: true, name: true } },
            },
          },
        },
      });

      // Deduct stock for each item
      for (const item of items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity } },
        });
      }

      return newSale;
    });

    res.status(201).json(sale);
  } catch (error) {
    console.error("Create sale error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    res.status(500).json({ message });
  }
});

export default router;
