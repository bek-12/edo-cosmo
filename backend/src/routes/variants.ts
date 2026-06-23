import { Router, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { authenticate, requireAdmin, AuthRequest } from "../middleware/auth";

const router = Router();
const prisma = new PrismaClient();

// PUT /api/variants/:id
router.put("/:id", authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const { stock, buyingPrice, sellingPrice, variantValue, variantType } = req.body;

  try {
    const existing = await prisma.productVariant.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ message: "Variant not found" });
      return;
    }

    const variant = await prisma.productVariant.update({
      where: { id },
      data: {
        ...(variantValue !== undefined && { variantValue }),
        ...(variantType !== undefined && { variantType }),
        ...(stock !== undefined && { stock: Number(stock) }),
        ...(buyingPrice !== undefined && { buyingPrice: buyingPrice === "" || buyingPrice === null ? null : Number(buyingPrice) }),
        ...(sellingPrice !== undefined && { sellingPrice: sellingPrice === "" || sellingPrice === null ? null : Number(sellingPrice) }),
      },
    });
    res.json(variant);
  } catch (error) {
    console.error("Update variant error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// DELETE /api/variants/:id
router.delete("/:id", authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;

  try {
    const existing = await prisma.productVariant.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ message: "Variant not found" });
      return;
    }

    await prisma.productVariant.delete({ where: { id } });
    res.json({ message: "Variant deleted" });
  } catch (error) {
    console.error("Delete variant error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
