import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

import authRoutes from "./routes/auth";
import productRoutes from "./routes/products";
import categoryRoutes from "./routes/categories";
import saleRoutes from "./routes/sales";
import dashboardRoutes from "./routes/dashboard";
import profileRoutes from "./routes/profile";
import returnsRoutes from "./routes/returns";
import reportsRoutes from "./routes/reports";

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
const allowedOrigins = [
  "http://localhost:3000",
  "https://edo-cosmo.vercel.app",
  process.env.FRONTEND_URL,
].filter(Boolean) as string[];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, Postman)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));
app.use(express.json({ limit: "10mb" }));

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/sales", saleRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/returns", returnsRoutes);
app.use("/api/reports", reportsRoutes);
// eligibility is on the returns router but prefixed under /api/sales
app.use("/api", returnsRoutes);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ message: "Route not found" });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

export default app;
