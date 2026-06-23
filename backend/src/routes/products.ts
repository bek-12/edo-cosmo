import { Router, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { authenticate, requireAdmin, AuthRequest } from "../middleware/auth";

const router = Router();
const prisma = new PrismaClient();

// GET /api/products
router.get("/", authenticate, async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const products = await prisma.product.findMany({
      include: { category: true, variants: { orderBy: { variantValue: "asc" } } },
      orderBy: { name: "asc" },
    });

    // For products with variants, compute total stock as sum of variant stocks
    const result = products.map((p) => {
      if (p.hasVariants) {
        const totalStock = p.variants.reduce((s, v) => s + v.stock, 0);
        return { ...p, stock: totalStock };
      }
      return p;
    });

    res.json(result);
  } catch (error) {
    console.error("Get products error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/products (admin only)
router.post("/", authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const { name, categoryId, buyingPrice, sellingPrice, stock, expiryDate, hasVariants, unit, variants } = req.body;

  if (!name || !categoryId || buyingPrice == null || sellingPrice == null) {
    res.status(400).json({ message: "name, categoryId, buyingPrice, and sellingPrice are required" });
    return;
  }

  if (hasVariants && (!variants || !Array.isArray(variants) || variants.length === 0)) {
    res.status(400).json({ message: "At least one variant is required when hasVariants is true" });
    return;
  }

  try {
    const product = await prisma.$transaction(async (tx) => {
      const newProduct = await tx.product.create({
        data: {
          name,
          categoryId,
          buyingPrice: Number(buyingPrice),
          sellingPrice: Number(sellingPrice),
          stock: hasVariants ? 0 : Number(stock ?? 0),
          lowStockAlert: 5,
          expiryDate: expiryDate ? new Date(expiryDate) : null,
          hasVariants: Boolean(hasVariants),
          unit: unit || null,
        },
      });

      if (hasVariants && variants) {
        for (const v of variants) {
          await tx.productVariant.create({
            data: {
              productId: newProduct.id,
              variantType: v.variantType || "other",
              variantValue: v.variantValue,
              stock: Number(v.stock ?? 0),
              buyingPrice: v.buyingPrice !== "" && v.buyingPrice != null ? Number(v.buyingPrice) : null,
              sellingPrice: v.sellingPrice !== "" && v.sellingPrice != null ? Number(v.sellingPrice) : null,
            },
          });
        }
      }

      return tx.product.findUnique({
        where: { id: newProduct.id },
        include: { category: true, variants: { orderBy: { variantValue: "asc" } } },
      });
    });

    res.status(201).json(product);
  } catch (error) {
    console.error("Create product error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// PUT /api/products/:id (admin only)
router.put("/:id", authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const { name, categoryId, buyingPrice, sellingPrice, stock, expiryDate, hasVariants, unit, variants } = req.body;

  try {
    const existing = await prisma.product.findUnique({
      where: { id },
      include: { variants: true },
    });
    if (!existing) {
      res.status(404).json({ message: "Product not found" });
      return;
    }

    const product = await prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id },
        data: {
          ...(name && { name }),
          ...(categoryId && { categoryId }),
          ...(buyingPrice != null && { buyingPrice: Number(buyingPrice) }),
          ...(sellingPrice != null && { sellingPrice: Number(sellingPrice) }),
          ...(stock != null && !hasVariants && { stock: Number(stock) }),
          ...(hasVariants !== undefined && { hasVariants: Boolean(hasVariants) }),
          ...(unit !== undefined && { unit: unit || null }),
          ...("expiryDate" in req.body && {
            expiryDate: expiryDate ? new Date(expiryDate) : null,
          }),
        },
      });

      if (hasVariants && variants && Array.isArray(variants)) {
        const incomingIds = variants.filter((v: { id?: string }) => v.id).map((v: { id: string }) => v.id);

        // Delete variants not in the incoming list
        const toDelete = existing.variants.filter((ev) => !incomingIds.includes(ev.id));
        for (const v of toDelete) {
          await tx.productVariant.delete({ where: { id: v.id } });
        }

        for (const v of variants) {
          if (v.id) {
            // Update existing
            await tx.productVariant.update({
              where: { id: v.id },
              data: {
                variantType: v.variantType || "other",
                variantValue: v.variantValue,
                stock: Number(v.stock ?? 0),
                buyingPrice: v.buyingPrice !== "" && v.buyingPrice != null ? Number(v.buyingPrice) : null,
                sellingPrice: v.sellingPrice !== "" && v.sellingPrice != null ? Number(v.sellingPrice) : null,
              },
            });
          } else {
            // Create new
            await tx.productVariant.create({
              data: {
                productId: id,
                variantType: v.variantType || "other",
                variantValue: v.variantValue,
                stock: Number(v.stock ?? 0),
                buyingPrice: v.buyingPrice !== "" && v.buyingPrice != null ? Number(v.buyingPrice) : null,
                sellingPrice: v.sellingPrice !== "" && v.sellingPrice != null ? Number(v.sellingPrice) : null,
              },
            });
          }
        }
      }

      return tx.product.findUnique({
        where: { id },
        include: { category: true, variants: { orderBy: { variantValue: "asc" } } },
      });
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

    await prisma.product.delete({ where: { id } });
    res.json({ message: "Product deleted successfully" });
  } catch (error) {
    console.error("Delete product error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
