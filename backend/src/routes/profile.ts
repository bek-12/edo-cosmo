import { Router, Response, Request } from "express";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { authenticate, AuthRequest } from "../middleware/auth";

const router = Router();
const prisma = new PrismaClient();

// GET /api/profile/public — shop branding, no auth required (used by login page)
router.get("/public", async (_req: Request, res: Response): Promise<void> => {
  try {
    const settings = await prisma.shopSettings.findFirst();
    res.json({
      shopName: settings?.shopName ?? "GlowShop",
      shopLogo: settings?.shopLogo ?? null,
    });
  } catch {
    res.json({ shopName: "GlowShop", shopLogo: null });
  }
});

// GET /api/profile — return user info + shop settings
router.get("/", authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { id: true, name: true, email: true, role: true, profileImage: true, createdAt: true },
    });

    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    // Get the single shop settings record (or default values)
    const shopSettings = await prisma.shopSettings.findFirst();

    res.json({
      user,
      shopSettings: shopSettings ?? { shopName: "GlowShop", shopLogo: null, email: null },
    });
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// PUT /api/profile/personal — update name, email, profileImage
router.put("/personal", authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const { name, email, profileImage } = req.body;

  try {
    const updated = await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        ...(name && { name }),
        ...(email && { email }),
        ...("profileImage" in req.body && { profileImage: profileImage ?? null }),
      },
      select: { id: true, name: true, email: true, role: true, profileImage: true },
    });
    res.json({ message: "Profile updated successfully", user: updated });
  } catch (error) {
    console.error("Update personal error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// PUT /api/profile/password — change password
router.put("/password", authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    res.status(400).json({ message: "currentPassword and newPassword are required" });
    return;
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) {
      res.status(400).json({ message: "Current password is incorrect" });
      return;
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: req.user!.id },
      data: { password: hashed },
    });

    res.json({ message: "Password changed successfully" });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// PUT /api/profile/shop — upsert shop settings
router.put("/shop", authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const { shopName, shopLogo, email } = req.body;

  try {
    const existing = await prisma.shopSettings.findFirst();

    const settings = existing
      ? await prisma.shopSettings.update({
          where: { id: existing.id },
          data: {
            ...(shopName && { shopName }),
            ...("shopLogo" in req.body && { shopLogo: shopLogo ?? null }),
            ...("email" in req.body && { email: email ?? null }),
          },
        })
      : await prisma.shopSettings.create({
          data: {
            shopName: shopName ?? "GlowShop",
            shopLogo: shopLogo ?? null,
            email: email ?? null,
          },
        });

    res.json({ message: "Shop settings updated", shopSettings: settings });
  } catch (error) {
    console.error("Update shop error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
