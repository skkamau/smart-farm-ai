import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import Animal from "../models/Animal.js";
import BirthRecord from "../models/BirthRecord.js";
import BreedingRecord from "../models/BreedingRecord.js";
import Crop from "../models/Crop.js";
import HealthRecord from "../models/HealthRecord.js";
import Transaction from "../models/Transaction.js";
import VaccinationRecord from "../models/VaccinationRecord.js";
import { generateFarmIntelligence } from "./aiService.js";

const reportTypes = ["animals", "health", "vaccinations", "breeding", "births", "crops", "financial", "ai"];

function fmt(value) {
  if (value === null || value === undefined || value === "") return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") return value.animalId || value.name || String(value._id || "");
  return String(value);
}

function csvEscape(value) {
  const text = fmt(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(rows) {
  if (!rows.length) return "No data\n";
  const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  return [headers.join(","), ...rows.map((row) => headers.map((key) => csvEscape(row[key])).join(","))].join("\n");
}

function moneyRows(transactions) {
  const income = transactions.filter((item) => item.type === "income").reduce((sum, item) => sum + item.amount, 0);
  const expenses = transactions.filter((item) => item.type === "expense").reduce((sum, item) => sum + item.amount, 0);
  const categories = transactions.filter((item) => item.type === "expense").reduce((acc, item) => {
    acc[item.category] = (acc[item.category] || 0) + item.amount;
    return acc;
  }, {});
  const monthly = {};
  const annual = {};
  transactions.forEach((item) => {
    const date = new Date(item.transactionDate);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const yearKey = String(date.getFullYear());
    monthly[monthKey] = monthly[monthKey] || { income: 0, expenses: 0 };
    annual[yearKey] = annual[yearKey] || { income: 0, expenses: 0 };
    const bucket = item.type === "income" ? "income" : "expenses";
    monthly[monthKey][bucket] += item.amount;
    annual[yearKey][bucket] += item.amount;
  });
  return [
    { Metric: "Total income", Amount: income },
    { Metric: "Total expenses", Amount: expenses },
    { Metric: "Profit/Loss", Amount: income - expenses },
    ...Object.entries(categories).map(([category, amount]) => ({ Metric: `Expense - ${category}`, Amount: amount })),
    ...Object.entries(monthly).map(([period, values]) => ({ Metric: `Monthly summary ${period}`, Amount: values.income - values.expenses, Income: values.income, Expenses: values.expenses })),
    ...Object.entries(annual).map(([period, values]) => ({ Metric: `Annual summary ${period}`, Amount: values.income - values.expenses, Income: values.income, Expenses: values.expenses }))
  ];
}

export async function getReportRows(user, type) {
  if (!reportTypes.includes(type)) throw new Error("Unsupported report type");
  if (type === "animals") {
    const animals = await Animal.find({ user }).populate("mother", "animalId name").populate("father", "animalId name").populate("children", "animalId name").lean();
    const [health, vaccinations, breeding, births] = await Promise.all([
      HealthRecord.find({ user }).lean(),
      VaccinationRecord.find({ user }).lean(),
      BreedingRecord.find({ user }).lean(),
      BirthRecord.find({ user }).lean()
    ]);
    return animals.map((animal) => ({
      AnimalID: animal.animalId,
      Name: animal.name,
      Species: animal.species,
      Breed: animal.breed,
      Gender: animal.gender,
      Status: animal.status,
      Weight: animal.weight,
      Location: animal.location,
      EstimatedValue: animal.estimatedValue,
      QRCode: animal.qrCodeValue,
      Mother: animal.mother?.animalId,
      Father: animal.father?.animalId,
      Children: (animal.children || []).map((child) => child.animalId).join("; "),
      HealthRecords: health.filter((item) => String(item.animal) === String(animal._id)).length,
      Vaccinations: vaccinations.filter((item) => String(item.animal) === String(animal._id)).length,
      BreedingRecords: breeding.filter((item) => [item.femaleAnimal, item.maleAnimal].map(String).includes(String(animal._id))).length,
      BirthRecords: births.filter((item) => [item.mother, item.father, ...(item.offspring || [])].map(String).includes(String(animal._id))).length,
      ProductionRecords: "Not added yet",
      Notes: animal.notes
    }));
  }
  if (type === "health") {
    const rows = await HealthRecord.find({ user }).populate("animal", "animalId name species").sort({ recordDate: -1 }).lean();
    return rows.map((r) => ({ AnimalID: r.animal?.animalId, Date: r.recordDate, Condition: r.condition, Symptoms: r.symptoms, Diagnosis: r.diagnosis, Treatment: r.treatment, Medication: r.medication, Dosage: r.dosage, Vet: r.vetName, Status: r.recoveryStatus, Notes: r.notes }));
  }
  if (type === "vaccinations") {
    const rows = await VaccinationRecord.find({ user }).populate("animal", "animalId name species").sort({ nextDueDate: 1 }).lean();
    return rows.map((r) => ({ AnimalID: r.animal?.animalId, Vaccine: r.vaccineName, DateGiven: r.dateGiven, NextDue: r.nextDueDate, Vet: r.vetName, Batch: r.batchNumber, Status: r.status, Notes: r.notes }));
  }
  if (type === "breeding") {
    const rows = await BreedingRecord.find({ user }).populate("femaleAnimal", "animalId name").populate("maleAnimal", "animalId name").sort({ matingDate: -1 }).lean();
    return rows.map((r) => ({ Female: r.femaleAnimal?.animalId, Male: r.maleAnimal?.animalId, MatingDate: r.matingDate, PregnancyStatus: r.pregnancyStatus, ExpectedBirth: r.expectedBirthDate, ActualBirth: r.actualBirthDate, Result: r.breedingResult, VetNotes: r.vetNotes, Notes: r.notes }));
  }
  if (type === "births") {
    const rows = await BirthRecord.find({ user }).populate("mother", "animalId name").populate("father", "animalId name").populate("offspring", "animalId name").sort({ birthDate: -1 }).lean();
    return rows.map((r) => ({ Mother: r.mother?.animalId, Father: r.father?.animalId, BirthDate: r.birthDate, OffspringCount: r.numberOfOffspring, Offspring: (r.offspring || []).map((a) => a.animalId).join("; "), Complications: r.birthComplications, VetNotes: r.vetNotes, Notes: r.notes }));
  }
  if (type === "crops") {
    const rows = await Crop.find({ user }).sort({ harvestDate: 1 }).lean();
    return rows.map((r) => ({ Crop: r.name, Field: r.field, Plot: r.plot, Area: r.area, PlantingDate: r.plantingDate, HarvestDate: r.harvestDate, ExpectedYield: r.expectedYield, ActualYield: r.actualYield, Costs: r.cost, Revenue: r.revenue, ProfitLoss: (r.revenue || 0) - (r.cost || 0), Status: r.status, Notes: r.notes }));
  }
  if (type === "financial") {
    const rows = await Transaction.find({ user }).sort({ transactionDate: -1 }).lean();
    return [...moneyRows(rows), ...rows.map((r) => ({ Metric: r.description, Amount: r.type === "income" ? r.amount : -r.amount, Type: r.type, Category: r.category, Date: r.transactionDate, Notes: r.notes }))];
  }
  const intelligence = await generateFarmIntelligence(user);
  return intelligence.recommendations.map((r) => ({ Type: r.type, Priority: r.priority, Related: r.related?.label || r.related?.kind, Message: r.message, SuggestedAction: r.suggestedAction, DateCreated: r.dateCreated }));
}

export function sendCsv(res, name, rows) {
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="${name}.csv"`);
  res.send(toCsv(rows));
}

export async function sendExcel(res, name, rows) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Report");
  const headers = rows.length ? [...new Set(rows.flatMap((row) => Object.keys(row)))] : ["Message"];
  sheet.columns = headers.map((header) => ({ header, key: header, width: Math.min(Math.max(header.length + 8, 14), 32) }));
  rows.forEach((row) => sheet.addRow(row));
  sheet.getRow(1).font = { bold: true };
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${name}.xlsx"`);
  await workbook.xlsx.write(res);
  res.end();
}

export async function sendPdf(res, name, rows, type) {
  const doc = new PDFDocument({ margin: 42, size: "A4" });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${name}.pdf"`);
  doc.pipe(res);
  doc.fontSize(18).text(`Smart Farm AI - ${type} report`, { underline: true });
  doc.moveDown();
  if (type === "animals") {
    for (const row of rows.slice(0, 30)) {
      doc.fontSize(12).text(`${row.AnimalID} - ${row.Name || row.Species}`, { continued: false });
      doc.fontSize(9).text(`Species: ${row.Species} | Breed: ${row.Breed || ""} | Status: ${row.Status} | Weight: ${row.Weight}`);
      doc.text(`Parents: ${row.Mother || "N/A"} / ${row.Father || "N/A"} | Children: ${row.Children || "None"}`);
      doc.text(`Health: ${row.HealthRecords} | Vaccinations: ${row.Vaccinations} | Breeding: ${row.BreedingRecords} | Births: ${row.BirthRecords}`);
      if (row.QRCode) {
        const dataUrl = await QRCode.toDataURL(row.QRCode, { width: 90, margin: 1 });
        doc.image(Buffer.from(dataUrl.split(",")[1], "base64"), { width: 70 });
      }
      doc.moveDown();
    }
  } else {
    rows.slice(0, 80).forEach((row) => {
      doc.fontSize(9).text(Object.entries(row).map(([key, value]) => `${key}: ${fmt(value)}`).join(" | "));
      doc.moveDown(0.4);
    });
  }
  doc.end();
}
