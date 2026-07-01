import { Router, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { authenticate, requireAdmin, AuthRequest } from "../middleware/auth";

const router = Router();
const prisma = new PrismaClient();

// GET /api/products
router.get("/", authenticate, async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const products = await prisma.product.findMany({
      include: { category: true },
      orderBy: { name: "asc" },
    });
    res.json(products);
  } catch (error) {
    console.error("Get products error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/products (admin only)
router.post("/", authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const { name, baseName, categoryId, buyingPrice, sellingPrice, stock, expiryDate } = req.body;

  if (!name || !categoryId || buyingPrice == null || sellingPrice == null) {
    res.status(400).json({ message: "name, categoryId, buyingPrice, and sellingPrice are required" });
    return;
  }

  const initialStock = Number(stock ?? 0);
  const bp = Number(buyingPrice);

  try {
    const product = await prisma.product.create({
      data: {
        name,
        baseName: baseName || null,
        categoryId,
        buyingPrice: bp,
        sellingPrice: Number(sellingPrice),
        stock: initialStock,
        lowStockAlert: 3,
        expiryDate: expiryDate ? new Date(expiryDate) : null,
      },
      include: { category: true },
    });

    // Auto-log a StockPurchase for the initial stock so it appears in purchase reports
    if (initialStock > 0 && bp > 0) {
      await prisma.stockPurchase.create({
        data: {
          productId: product.id,
          cashierId: req.user!.id,
          quantity: initialStock,
          buyingPrice: bp,
          totalCost: initialStock * bp,
          note: "Initial stock",
        },
      });
    }

    res.status(201).json(product);
  } catch (error) {
    console.error("Create product error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// PUT /api/products/:id (admin only)
router.put("/:id", authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const { name, baseName, categoryId, buyingPrice, sellingPrice, stock, expiryDate } = req.body;

  try {
    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ message: "Product not found" });
      return;
    }

    const product = await prisma.product.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...("baseName" in req.body && { baseName: baseName || null }),
        ...(categoryId && { categoryId }),
        ...(buyingPrice != null && { buyingPrice: Number(buyingPrice) }),
        ...(sellingPrice != null && { sellingPrice: Number(sellingPrice) }),
        ...(stock != null && { stock: Number(stock) }),
        ...("expiryDate" in req.body && {
          expiryDate: expiryDate ? new Date(expiryDate) : null,
        }),
      },
      include: { category: true },
    });
    res.json(product);
  } catch (error) {
    console.error("Update product error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// DELETE /api/products/:id (admin only)
router.delete("/:id", authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;

  try {
    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ message: "Product not found" });
      return;
    }

    // Delete all child records first (foreign key constraints)
    await prisma.$transaction([
      prisma.stockPurchase.deleteMany({ where: { productId: id } }),
      prisma.returnItem.deleteMany({ where: { productId: id } }),
      prisma.saleItem.deleteMany({ where: { productId: id } }),
      prisma.product.delete({ where: { id } }),
    ]);

    res.json({ message: "Product deleted successfully" });
  } catch (error) {
    console.error("Delete product error:", error);
    const msg = error instanceof Error ? error.message : "Internal server error";
    res.status(500).json({ message: msg });
  }
});

export default router;
