import { Router, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { authenticate, AuthRequest } from "../middleware/auth";

const router = Router();
const prisma = new PrismaClient();

// GET /api/dashboard — diagnostic version
router.get("/", authenticate, async (_req: AuthRequest, res: Response): Promise<void> => {
  console.log("Dashboard hit - testing basic DB connection");
  try {
    const productCount = await prisma.product.count();
    console.log("Products:", productCount);

    const saleCount = await prisma.sale.count();
    console.log("Sales:", saleCount);

    const returnCount = await prisma.return.count();
    console.log("Returns:", returnCount);

    res.json({ message: "Dashboard working", productCount, saleCount, returnCount });
  } catch (error) {
    const err = error as Error;
    console.error("DASHBOARD ERROR:", err.message);
    console.error("FULL ERROR:", err);
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

export default router;
