import { Router, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { authenticate, AuthRequest } from "../middleware/auth";

const router = Router();
const prisma = new PrismaClient();

// GET /api/categories
router.get("/", authenticate, async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { name: "asc" },
    });
    res.json(categories);
  } catch (error) {
    console.error("Get categories error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/categories — find or create a category by name (case-insensitive)
router.post("/", authenticate, async (req: Request, res: Response): Promise<void> => {
  const { name } = req.body;

  if (!name || typeof name !== "string" || !name.trim()) {
    res.status(400).json({ message: "name is required" });
    return;
  }

  const trimmed = name.trim();

  try {
    // Case-insensitive search
    const existing = await prisma.category.findFirst({
      where: { name: { equals: trimmed, mode: "insensitive" } },
    });

    if (existing) {
      res.json(existing);
      return;
    }

    const created = await prisma.category.create({
      data: { name: trimmed },
    });
    res.status(201).json(created);
  } catch (error) {
    console.error("Create category error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
