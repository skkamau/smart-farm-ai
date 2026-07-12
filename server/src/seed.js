import dotenv from "dotenv";
import mongoose from "mongoose";
import { connectDB } from "./config/db.js";
import Animal from "./models/Animal.js";
import BirthRecord from "./models/BirthRecord.js";
import BreedingRecord from "./models/BreedingRecord.js";
import Crop from "./models/Crop.js";
import Document from "./models/Document.js";
import HealthRecord from "./models/HealthRecord.js";
import Transaction from "./models/Transaction.js";
import User from "./models/User.js";
import VaccinationRecord from "./models/VaccinationRecord.js";
import { isStrongPassword } from "./utils/passwordReset.js";
import { ensureAnimalQr } from "./utils/qr.js";

dotenv.config();

async function seed() {
  const seedEmail = process.env.SEED_USER_EMAIL || "admin@smartfarm.local";
  const seedPassword = process.env.SEED_USER_PASSWORD;
  if (!seedPassword) {
    throw new Error("SEED_USER_PASSWORD is required before running the seed script");
  }
  if (!isStrongPassword(seedPassword)) {
    throw new Error("SEED_USER_PASSWORD must be at least 8 characters and include uppercase, lowercase, number, and symbol");
  }

  await connectDB();
  await Promise.all([
    User.deleteMany({}),
    Animal.deleteMany({}),
    Crop.deleteMany({}),
    Transaction.deleteMany({}),
    HealthRecord.deleteMany({}),
    VaccinationRecord.deleteMany({}),
    BreedingRecord.deleteMany({}),
    BirthRecord.deleteMany({})
    , Document.deleteMany({})
  ]);

  const user = await User.create({
    name: "Amina Farm Manager",
    email: seedEmail,
    password: seedPassword,
    farmName: "Green Valley Farm"
  });

  const animals = await Animal.insertMany([
    { user: user._id, animalId: "COW-001", name: "Maziwa", species: "Cow", breed: "Friesian", gender: "Female", dateOfBirth: "2022-04-12", weight: 418, location: "Dairy Pen A", status: "Healthy", estimatedValue: 92000, notes: "High milk producer" },
    { user: user._id, animalId: "COW-002", name: "Lulu", species: "Cow", breed: "Ayrshire", gender: "Female", dateOfBirth: "2021-11-20", weight: 392, location: "Dairy Pen A", status: "Pregnant", estimatedValue: 88000, notes: "Expected calving in August" },
    { user: user._id, animalId: "BULL-001", name: "Jabali", species: "Cow", breed: "Friesian", gender: "Male", dateOfBirth: "2020-03-15", weight: 620, location: "Bull Pen", status: "Healthy", estimatedValue: 125000, notes: "Breeding bull" },
    { user: user._id, animalId: "GOAT-014", name: "Kito", species: "Goat", breed: "Boer", gender: "Male", dateOfBirth: "2023-01-18", weight: 54, location: "Goat Shed", status: "Healthy", estimatedValue: 24000 },
    { user: user._id, animalId: "SHP-007", name: "Nuru", species: "Sheep", breed: "Dorper", gender: "Female", dateOfBirth: "2023-08-09", weight: 43, location: "Paddock 2", status: "Sick", estimatedValue: 18000, notes: "Under observation for cough" },
    { user: user._id, animalId: "CHK-101", name: "Layer Batch 1", species: "Chicken", breed: "Rhode Island Red", gender: "Female", dateOfBirth: "2024-02-01", weight: 2, location: "Coop 1", status: "Healthy", estimatedValue: 650 }
  ]);
  await Promise.all(animals.map((animal) => ensureAnimalQr(animal)));
  const animalById = Object.fromEntries(animals.map((animal) => [animal.animalId, animal]));

  const calf = await Animal.create({
    user: user._id,
    animalId: "CALF-003",
    name: "Baraka",
    species: "Cow",
    breed: "Friesian Cross",
    gender: "Male",
    dateOfBirth: "2026-06-10",
    weight: 62,
    location: "Calf Pen",
    status: "Healthy",
    estimatedValue: 32000,
    mother: animalById["COW-001"]._id,
    father: animalById["BULL-001"]._id,
    notes: "Strong birth weight."
  });
  animalById["CALF-003"] = calf;
  await Animal.updateOne({ _id: animalById["COW-001"]._id }, { $addToSet: { children: calf._id } });
  await Animal.updateOne({ _id: animalById["BULL-001"]._id }, { $addToSet: { children: calf._id } });

  await HealthRecord.insertMany([
    {
      user: user._id,
      animal: animalById["SHP-007"]._id,
      recordDate: "2026-06-25",
      healthCondition: "serious",
      symptoms: "Coughing, low appetite, mild fever",
      diagnosis: "Likely bacterial respiratory infection",
      treatment: "Vet examination and antibiotic course",
      medication: "Oxytetracycline",
      dosage: "5 ml once daily for 3 days",
      vetName: "Dr. Wanjiku",
      notes: "Keep isolated and monitor temperature."
    },
    {
      user: user._id,
      animal: animalById["SHP-007"]._id,
      recordDate: "2026-07-02",
      healthCondition: "recovering",
      symptoms: "Occasional cough after treatment",
      diagnosis: "Recovering but recurrent respiratory irritation",
      treatment: "Extended observation and dry bedding",
      medication: "Vitamin support",
      dosage: "Daily for 5 days",
      vetName: "Dr. Wanjiku",
      notes: "Check housing ventilation."
    },
    {
      user: user._id,
      animal: animalById["COW-002"]._id,
      recordDate: "2026-06-18",
      healthCondition: "healthy",
      symptoms: "Routine reproductive exam",
      diagnosis: "Pregnancy confirmed",
      treatment: "No treatment required",
      medication: "",
      dosage: "",
      vetName: "Dr. Otieno",
      notes: "Schedule next check in four weeks."
    }
  ]);

  await VaccinationRecord.insertMany([
    {
      user: user._id,
      animal: animalById["COW-001"]._id,
      vaccineName: "FMD",
      dateGiven: "2026-01-10",
      nextDueDate: "2026-07-20",
      vetName: "Dr. Wanjiku",
      batchNumber: "FMD-KE-1182",
      status: "upcoming",
      notes: "Booster due soon."
    },
    {
      user: user._id,
      animal: animalById["GOAT-014"]._id,
      vaccineName: "PPR",
      dateGiven: "2025-12-02",
      nextDueDate: "2026-06-25",
      vetName: "Dr. Otieno",
      batchNumber: "PPR-4401",
      status: "overdue",
      notes: "Prioritize this week."
    },
    {
      user: user._id,
      animal: animalById["CHK-101"]._id,
      vaccineName: "Newcastle",
      dateGiven: "2026-06-12",
      nextDueDate: "2026-08-12",
      vetName: "Farm team",
      batchNumber: "ND-910",
      status: "upcoming",
      notes: "Repeat every two months."
    }
  ]);

  await BreedingRecord.insertMany([
    {
      user: user._id,
      femaleAnimal: animalById["COW-002"]._id,
      maleAnimal: animalById["BULL-001"]._id,
      matingDate: "2026-04-20",
      pregnancyStatus: "pregnant",
      expectedBirthDate: "2026-07-20",
      vetNotes: "Pregnancy progressing normally.",
      breedingResult: "pending",
      notes: "Check body condition weekly."
    }
  ]);

  await BirthRecord.insertMany([
    {
      user: user._id,
      mother: animalById["COW-001"]._id,
      father: animalById["BULL-001"]._id,
      birthDate: "2026-06-10",
      numberOfOffspring: 1,
      offspring: [animalById["CALF-003"]._id],
      birthComplications: "None",
      vetNotes: "Normal delivery.",
      notes: "Calf nursing well."
    }
  ]);

  await Crop.insertMany([
    { user: user._id, name: "Maize", field: "North Field", plot: "N-2", area: 4.5, plantingDate: "2026-03-20", harvestDate: "2026-08-15", expectedYield: 6200, cost: 118000, revenue: 0, status: "Growing", notes: "Top dressed in June" },
    { user: user._id, name: "Tomatoes", field: "Greenhouse", plot: "GH-1", area: 0.8, plantingDate: "2026-05-02", harvestDate: "2026-07-25", expectedYield: 2100, cost: 54000, revenue: 0, status: "Ready" },
    { user: user._id, name: "Napier Grass", field: "Fodder Block", plot: "F-1", area: 2, plantingDate: "2026-01-12", harvestDate: "2026-06-20", expectedYield: 9000, actualYield: 8600, cost: 26000, revenue: 0, status: "Harvested" }
  ]);

  await Transaction.insertMany([
    { user: user._id, type: "income", category: "Sales", amount: 82000, description: "Milk sales - July", transactionDate: "2026-07-02" },
    { user: user._id, type: "income", category: "Sales", amount: 21500, description: "Egg sales - July", transactionDate: "2026-07-02" },
    { user: user._id, type: "expense", category: "Feed", amount: 70000, description: "Dairy meal and layers mash", transactionDate: "2026-07-01" },
    { user: user._id, type: "expense", category: "Medicine", amount: 9200, description: "Vet visit and antibiotics", transactionDate: "2026-07-01" },
    { user: user._id, type: "expense", category: "Labour", amount: 30000, description: "Farm wages", transactionDate: "2026-07-01" },
    { user: user._id, type: "income", category: "Crop", amount: 38000, description: "Vegetable sales", transactionDate: "2026-07-02" }
  ]);

  console.log("Seed complete");
  console.log(`Seed user created: ${seedEmail}`);
  await mongoose.connection.close();
}

seed().catch(async (error) => {
  console.error(error);
  await mongoose.connection.close();
  process.exit(1);
});
