import { Router, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { authenticate, AuthRequest } from "../middleware/auth";

const router = Router();
const prisma = new PrismaClient();

// GET /api/sales/:id/eligibility
router.get("/sales/:id/eligibility", authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  try {
    const sale = await prisma.sale.findUnique({
      where: { id },
      include: {
        cashier: { select: { id: true, name: true } },
        items: {
          include: { product: { select: { id: true, name: true } } },
        },
        returns: {
          include: { items: true },
        },
      },
    });

    if (!sale) {
      res.status(404).json({ message: "Sale not found" });
      return;
    }

    const hoursSinceSale =
      (Date.now() - new Date(sale.createdAt).getTime()) / (1000 * 60 * 60);
    const eligible = hoursSinceSale < 24;

    res.json({ eligible, hoursSinceSale, sale });
  } catch (error) {
    console.error("Eligibility error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/returns
router.get("/", authenticate, async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const returns = await prisma.return.findMany({
      include: {
        cashier: { select: { id: true, name: true } },
        sale: { select: { id: true, createdAt: true, totalAmount: true } },
        items: {
          include: { product: { select: { id: true, name: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(returns);
  } catch (error) {
    console.error("Get returns error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/returns
router.post("/", authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const { saleId, items, reason } = req.body as {
    saleId: string;
    items: { productId: string; quantity: number }[];
    reason?: string;
  };

  if (!saleId || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({ message: "saleId and items are required" });
    return;
  }

  const cashierId = req.user!.id;

  try {
    // Fetch sale with its items and existing returns
    const sale = await prisma.sale.findUnique({
      where: { id: saleId },
      include: {
        items: true,
        returns: { include: { items: true } },
      },
    });

    if (!sale) {
      res.status(404).json({ message: "Sale not found" });
      return;
    }

    // 24-hour check
    const hoursSinceSale =
      (Date.now() - new Date(sale.createdAt).getTime()) / (1000 * 60 * 60);
    if (hoursSinceSale >= 24) {
      res.status(400).json({
        message: "This sale is more than 24 hours old and cannot be returned.",
      });
      return;
    }

    // Build a map of already-returned quantities per product for this sale
    const alreadyReturned: Record<string, number> = {};
    for (const ret of sale.returns) {
      for (const ri of ret.items) {
        alreadyReturned[ri.productId] = (alreadyReturned[ri.productId] ?? 0) + ri.quantity;
      }
    }

    // Validate each return item
    const resolvedItems: { productId: string; quantity: number; priceAtSale: number }[] = [];

    for (const item of items) {
      const saleItem = sale.items.find((si) => si.productId === item.productId);
      if (!saleItem) {
        res.status(400).json({
          message: `Product ${item.productId} was not in the original sale`,
        });
        return;
      }

      const previouslyReturned = alreadyReturned[item.productId] ?? 0;
      const maxReturnable = saleItem.quantity - previouslyReturned;

      if (item.quantity <= 0 || item.quantity > maxReturnable) {
        res.status(400).json({
          message: `Cannot return ${item.quantity} of product ${item.productId}. Max returnable: ${maxReturnable}`,
        });
        return;
      }

      resolvedItems.push({
        productId: item.productId,
        quantity: item.quantity,
        priceAtSale: saleItem.priceAtSale,
      });
    }

    const totalAmount = resolvedItems.reduce(
      (sum, i) => sum + i.priceAtSale * i.quantity,
      0
    );

    // Create return + restore stock in one transaction
    const returnRecord = await prisma.$transaction(async (tx) => {
      const newReturn = await tx.return.create({
        data: {
          saleId,
          cashierId,
          reason: reason ?? null,
          totalAmount,
          items: {
            create: resolvedItems.map((i) => ({
              productId: i.productId,
              quantity: i.quantity,
              priceAtSale: i.priceAtSale,
            })),
          },
        },
        include: {
          cashier: { select: { id: true, name: true } },
          sale: { select: { id: true, createdAt: true } },
          items: {
            include: { product: { select: { id: true, name: true } } },
          },
        },
      });

      // Restore stock
      for (const i of resolvedItems) {
        await tx.product.update({
          where: { id: i.productId },
          data: { stock: { increment: i.quantity } },
        });
      }

      return newReturn;
    });

    res.status(201).json(returnRecord);
  } catch (error) {
    console.error("Create return error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    res.status(500).json({ message });
  }
});

export default router;
