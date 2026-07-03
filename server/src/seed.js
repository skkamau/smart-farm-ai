import dotenv from "dotenv";
import mongoose from "mongoose";
import { connectDB } from "./config/db.js";
import Animal from "./models/Animal.js";
import Crop from "./models/Crop.js";
import Transaction from "./models/Transaction.js";
import User from "./models/User.js";

dotenv.config();

async function seed() {
  await connectDB();
  await Promise.all([User.deleteMany({}), Animal.deleteMany({}), Crop.deleteMany({}), Transaction.deleteMany({})]);

  const user = await User.create({
    name: "Amina Farm Manager",
    email: "admin@smartfarm.local",
    password: "password123",
    farmName: "Green Valley Farm"
  });

  await Animal.insertMany([
    { user: user._id, animalId: "COW-001", name: "Maziwa", species: "Cow", breed: "Friesian", gender: "Female", dateOfBirth: "2022-04-12", weight: 418, location: "Dairy Pen A", status: "Healthy", estimatedValue: 92000, notes: "High milk producer" },
    { user: user._id, animalId: "COW-002", name: "Lulu", species: "Cow", breed: "Ayrshire", gender: "Female", dateOfBirth: "2021-11-20", weight: 392, location: "Dairy Pen A", status: "Pregnant", estimatedValue: 88000, notes: "Expected calving in August" },
    { user: user._id, animalId: "GOAT-014", name: "Kito", species: "Goat", breed: "Boer", gender: "Male", dateOfBirth: "2023-01-18", weight: 54, location: "Goat Shed", status: "Healthy", estimatedValue: 24000 },
    { user: user._id, animalId: "SHP-007", name: "Nuru", species: "Sheep", breed: "Dorper", gender: "Female", dateOfBirth: "2023-08-09", weight: 43, location: "Paddock 2", status: "Sick", estimatedValue: 18000, notes: "Under observation for cough" },
    { user: user._id, animalId: "CHK-101", name: "Layer Batch 1", species: "Chicken", breed: "Rhode Island Red", gender: "Female", dateOfBirth: "2024-02-01", weight: 2, location: "Coop 1", status: "Healthy", estimatedValue: 650 }
  ]);

  await Crop.insertMany([
    { user: user._id, name: "Maize", field: "North Field", plot: "N-2", area: 4.5, plantingDate: "2026-03-20", harvestDate: "2026-08-15", expectedYield: 6200, cost: 118000, revenue: 0, status: "Growing", notes: "Top dressed in June" },
    { user: user._id, name: "Tomatoes", field: "Greenhouse", plot: "GH-1", area: 0.8, plantingDate: "2026-05-02", harvestDate: "2026-07-25", expectedYield: 2100, cost: 54000, revenue: 0, status: "Ready" },
    { user: user._id, name: "Napier Grass", field: "Fodder Block", plot: "F-1", area: 2, plantingDate: "2026-01-12", harvestDate: "2026-06-20", expectedYield: 9000, actualYield: 8600, cost: 26000, revenue: 0, status: "Harvested" }
  ]);

  await Transaction.insertMany([
    { user: user._id, type: "income", category: "Sales", amount: 82000, description: "Milk sales - June", transactionDate: "2026-06-30" },
    { user: user._id, type: "income", category: "Sales", amount: 21500, description: "Egg sales - June", transactionDate: "2026-06-29" },
    { user: user._id, type: "expense", category: "Feed", amount: 46500, description: "Dairy meal and layers mash", transactionDate: "2026-06-27" },
    { user: user._id, type: "expense", category: "Medicine", amount: 9200, description: "Vet visit and antibiotics", transactionDate: "2026-06-25" },
    { user: user._id, type: "expense", category: "Labour", amount: 30000, description: "Farm wages", transactionDate: "2026-06-28" },
    { user: user._id, type: "income", category: "Crop", amount: 38000, description: "Vegetable sales", transactionDate: "2026-06-21" }
  ]);

  console.log("Seed complete");
  console.log("Login: admin@smartfarm.local / password123");
  await mongoose.connection.close();
}

seed().catch(async (error) => {
  console.error(error);
  await mongoose.connection.close();
  process.exit(1);
});
