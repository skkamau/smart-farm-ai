import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { connectDB } from "./config/db.js";
import { migrateAnimalStatuses } from "./services/animalStatusMigration.js";
import { migrateHealthConditions } from "./services/healthConditionMigration.js";
import { migrateUnknownAnimalGenders } from "./services/animalGenderMigration.js";
import { migrateLegacyInventory } from "./services/inventoryMigration.js";
import { migrateProductionInventory } from "./services/productionInventoryMigration.js";
import { allowedOrigins, isLocalNetworkOrigin, validateEnv } from "./config/env.js";
import adminRoutes from "./routes/adminRoutes.js";
import animalRoutes from "./routes/animalRoutes.js";
import animalGroupRoutes from "./routes/animalGroupRoutes.js";
import aiRoutes from "./routes/aiRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import birthRoutes from "./routes/birthRoutes.js";
import breedingRoutes from "./routes/breedingRoutes.js";
import cropRoutes from "./routes/cropRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import documentRoutes from "./routes/documentRoutes.js";
import feedbackRoutes from "./routes/feedbackRoutes.js";
import healthRoutes from "./routes/healthRoutes.js";
import reportRoutes from "./routes/reportRoutes.js";
import transactionRoutes from "./routes/transactionRoutes.js";
import inventoryRoutes from "./routes/inventoryRoutes.js";
import productionRoutes from "./routes/productionRoutes.js";
import produceSaleRoutes from "./routes/produceSaleRoutes.js";
import usageRoutes from "./routes/usageRoutes.js";
import vaccinationRoutes from "./routes/vaccinationRoutes.js";
import weatherRoutes from "./routes/weatherRoutes.js";
import { errorHandler, notFound } from "./middleware/error.js";
import { globalLimiter } from "./middleware/rateLimits.js";
import { auditImportantDeletion } from "./middleware/audit.js";

dotenv.config();
validateEnv();

const app = express();
const port = process.env.PORT || 5000;
const host = process.env.HOST || "0.0.0.0";
const originAllowlist = allowedOrigins();

app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(helmet({
  crossOriginResourcePolicy: { policy: "same-site" }
}));
app.use(cors({
  origin(origin, callback) {
    if (!origin || originAllowlist.has(origin) || isLocalNetworkOrigin(origin)) return callback(null, true);
    return callback(null, false);
  }
}));
app.use(express.json({ limit: "1mb" }));
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev", {
  skip: (req) => req.path === "/api/health"
}));
app.use(globalLimiter);
app.use(auditImportantDeletion);

app.get("/api/health", (req, res) => res.json({ status: "ok", service: "Smart Farm AI API" }));
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/feedback", feedbackRoutes);
app.use("/api/usage", usageRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/animals", animalRoutes);
app.use("/api/animal-groups", animalGroupRoutes);
app.use("/api/breeding-records", breedingRoutes);
app.use("/api/birth-records", birthRoutes);
app.use("/api/crops", cropRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/production", productionRoutes);
app.use("/api/produce-sales", produceSaleRoutes);
app.use("/api/health-records", healthRoutes);
app.use("/api/vaccinations", vaccinationRoutes);
app.use("/api/weather", weatherRoutes);
app.use(notFound);
app.use(errorHandler);

connectDB()
  .then(async () => {
    await migrateAnimalStatuses();
    await migrateUnknownAnimalGenders();
    await migrateHealthConditions();
    await migrateLegacyInventory();
    await migrateProductionInventory();
    app.listen(port, host, () => console.log(`API running on http://${host}:${port}`));
  })
  .catch((error) => {
    console.error("Database connection failed", error);
    process.exit(1);
  });
