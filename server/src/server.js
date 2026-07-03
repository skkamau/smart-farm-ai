import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import morgan from "morgan";
import path from "node:path";
import { connectDB } from "./config/db.js";
import animalRoutes from "./routes/animalRoutes.js";
import aiRoutes from "./routes/aiRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import birthRoutes from "./routes/birthRoutes.js";
import breedingRoutes from "./routes/breedingRoutes.js";
import cropRoutes from "./routes/cropRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import documentRoutes from "./routes/documentRoutes.js";
import healthRoutes from "./routes/healthRoutes.js";
import reportRoutes from "./routes/reportRoutes.js";
import transactionRoutes from "./routes/transactionRoutes.js";
import vaccinationRoutes from "./routes/vaccinationRoutes.js";
import { errorHandler, notFound } from "./middleware/error.js";

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;
const allowedOrigins = new Set([
  process.env.CLIENT_URL || "http://localhost:5173",
  "http://localhost:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174"
]);

app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    return callback(new Error(`CORS blocked origin: ${origin}`));
  }
}));
app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 300 }));
app.use("/uploads", express.static(path.resolve("uploads")));

app.get("/api/health", (req, res) => res.json({ status: "ok", service: "Smart Farm AI API" }));
app.use("/api/auth", authRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/animals", animalRoutes);
app.use("/api/breeding-records", breedingRoutes);
app.use("/api/birth-records", birthRoutes);
app.use("/api/crops", cropRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/health-records", healthRoutes);
app.use("/api/vaccinations", vaccinationRoutes);
app.use(notFound);
app.use(errorHandler);

connectDB()
  .then(() => {
    app.listen(port, () => console.log(`API running on http://localhost:${port}`));
  })
  .catch((error) => {
    console.error("Database connection failed", error);
    process.exit(1);
  });
