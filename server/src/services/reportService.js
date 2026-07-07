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
import WeatherRecord from "../models/WeatherRecord.js";
import Document from "../models/Document.js";
import { generateFarmIntelligence } from "./aiService.js";

const reportTypes = [
  "animals", "health", "vet", "vaccinations", "breeding", "births", "family", "crops", "crop-expenses",
  "financial", "finance", "construction", "equipment", "feed", "fuel", "consumables", "cash-savings",
  "animal-health", "weather", "alerts", "monthly-expenses", "expense-by-category", "vet-costs",
  "health-costs", "full-summary", "ai"
];

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

function bullet(doc, label, value) {
  doc.fontSize(10).text(`- ${label}: ${fmt(value) || "Not recorded"}`);
}

function section(doc, title) {
  doc.moveDown(0.7);
  doc.fontSize(13).fillColor("#112617").text(title, { underline: true });
  doc.fillColor("#111827").moveDown(0.3);
}

function barChart(doc, title, values) {
  const entries = Object.entries(values).filter(([, value]) => Number.isFinite(Number(value)));
  if (!entries.length) return;
  section(doc, title);
  const max = Math.max(...entries.map(([, value]) => Math.abs(Number(value))), 1);
  entries.forEach(([label, value]) => {
    const width = Math.max((Math.abs(Number(value)) / max) * 220, 4);
    doc.fontSize(9).text(`${label}: ${value}`, { continued: false });
    const x = doc.x;
    const y = doc.y + 2;
    doc.rect(x, y, width, 8).fill(Number(value) < 0 ? "#b91c1c" : "#206533");
    doc.fillColor("#111827").moveDown(0.8);
  });
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

function transactionQuery(user, filters = {}, section) {
  const query = { user };
  if (section) query.financeSection = section;
  if (filters.financeSection) query.financeSection = filters.financeSection;
  if (filters.crop) query.crop = filters.crop;
  if (filters.animal) query.animal = filters.animal;
  if (filters.category) query.category = filters.category;
  if (filters.paymentMethod) query.paymentMethod = filters.paymentMethod;
  if (filters.type) query.type = filters.type;
  if (filters.dateFrom || filters.dateTo) {
    query.transactionDate = {};
    if (filters.dateFrom) query.transactionDate.$gte = new Date(filters.dateFrom);
    if (filters.dateTo) query.transactionDate.$lte = new Date(filters.dateTo);
  }
  return query;
}

function transactionRows(rows) {
  return rows.map((r) => ({
    Date: r.transactionDate,
    Type: r.type,
    Section: r.financeSection,
    Category: r.category,
    Crop: r.crop ? `${r.crop.name || ""} ${r.crop.field || ""} ${r.crop.plot || ""}`.trim() : "",
    Animal: r.animal ? `${r.animal.animalId || ""} ${r.animal.name || r.animal.species || ""}`.trim() : "",
    Item: r.item,
    Description: r.description,
    Quantity: r.quantity,
    Unit: r.unit,
    UnitCost: r.unitCost,
    TotalCost: r.totalCost || r.amount,
    PaymentMethod: r.paymentMethod,
    SupplierVendor: r.supplierVendor,
    StorageLocation: r.storageLocation,
    QuantityIn: r.quantityIn,
    QuantityOut: r.quantityOut,
    Balance: r.balance,
    Cash: r.cashAmount,
    Savings: r.savingsAmount,
    Notes: r.notes || r.remarks
  }));
}

async function getTransactionRows(user, filters, section) {
  const rows = await Transaction.find(transactionQuery(user, filters, section))
    .populate("crop", "name field plot")
    .populate("animal", "animalId name species")
    .sort({ transactionDate: -1, createdAt: -1 })
    .lean();
  return transactionRows(rows);
}

function expenseSummaryRows(rows, groupKey) {
  const out = {};
  rows.filter((row) => row.Type === "expense").forEach((row) => {
    const key = row[groupKey] || "Unspecified";
    out[key] = (out[key] || 0) + Number(row.TotalCost || 0);
  });
  return Object.entries(out).map(([Name, Amount]) => ({ Name, Amount }));
}

export async function getReportRows(user, type, filters = {}) {
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
    return rows.map((r) => ({ AnimalID: r.animal?.animalId, Date: r.recordDate, Condition: r.condition, ServiceType: r.serviceType, Symptoms: r.symptoms, Diagnosis: r.diagnosis, Treatment: r.treatment, Medication: r.medication, Dosage: r.dosage, Vet: r.vetName, ServiceCharge: r.serviceCharge, MedicineCost: r.medicineCost, TransportCost: r.transportCost, OtherCost: r.otherCost, TotalCost: r.totalCost, PaymentMethod: r.paymentMethod, FollowUpDate: r.followUpDate, Status: r.recoveryStatus, Notes: r.notes }));
  }
  if (type === "vet") return getReportRows(user, "health", filters);
  if (type === "vaccinations") {
    const rows = await VaccinationRecord.find({ user }).populate("animal", "animalId name species").sort({ nextDueDate: 1 }).lean();
    return rows.map((r) => ({ AnimalID: r.animal?.animalId, Vaccine: r.vaccineName, DateGiven: r.dateGiven, NextDue: r.nextDueDate, Vet: r.vetName, Batch: r.batchNumber, ServiceCharge: r.serviceCharge, VaccineCost: r.vaccineCost, TransportCost: r.transportCost, OtherCost: r.otherCost, TotalCost: r.totalCost, PaymentMethod: r.paymentMethod, Status: r.status, Notes: r.notes }));
  }
  if (type === "breeding") {
    const rows = await BreedingRecord.find({ user }).populate("femaleAnimal", "animalId name").populate("maleAnimal", "animalId name").sort({ matingDate: -1 }).lean();
    return rows.map((r) => ({ Female: r.femaleAnimal?.animalId, Male: r.maleAnimal?.animalId, MatingDate: r.matingDate, PregnancyStatus: r.pregnancyStatus, ExpectedBirth: r.expectedBirthDate, ActualBirth: r.actualBirthDate, Result: r.breedingResult, VetNotes: r.vetNotes, Notes: r.notes }));
  }
  if (type === "births") {
    const rows = await BirthRecord.find({ user }).populate("mother", "animalId name").populate("father", "animalId name").populate("offspring", "animalId name").sort({ birthDate: -1 }).lean();
    return rows.map((r) => ({ Mother: r.mother?.animalId, Father: r.father?.animalId, BirthDate: r.birthDate, OffspringCount: r.numberOfOffspring, Offspring: (r.offspring || []).map((a) => a.animalId).join("; "), Complications: r.birthComplications, VetNotes: r.vetNotes, Notes: r.notes }));
  }
  if (type === "family") {
    const animals = await Animal.find({ user }).populate("mother", "animalId name").populate("father", "animalId name").populate("children", "animalId name").sort({ animalId: 1 }).lean();
    return animals.map((a) => ({ AnimalID: a.animalId, Name: a.name, Mother: a.mother?.animalId, Father: a.father?.animalId, Children: (a.children || []).map((c) => c.animalId).join("; "), ChildCount: (a.children || []).length }));
  }
  if (type === "crops") {
    const rows = await Crop.find({ user }).sort({ harvestDate: 1 }).lean();
    return rows.map((r) => ({ Crop: r.name, Field: r.field, Plot: r.plot, Area: r.area, PlantingDate: r.plantingDate, HarvestDate: r.harvestDate, ExpectedYield: r.expectedYield, ActualYield: r.actualYield, Costs: r.cost, Revenue: r.revenue, ProfitLoss: (r.revenue || 0) - (r.cost || 0), Status: r.status, Notes: r.notes }));
  }
  if (type === "financial") {
    const rows = await Transaction.find(transactionQuery(user, filters)).sort({ transactionDate: -1 }).lean();
    return [...moneyRows(rows), ...transactionRows(rows)];
  }
  if (type === "finance") return getTransactionRows(user, filters);
  if (type === "crop-expenses") return getTransactionRows(user, filters, "CropExpense");
  if (type === "animal-health" || type === "vet-costs" || type === "health-costs") return getTransactionRows(user, filters, "AnimalHealth");
  if (type === "construction") return getTransactionRows(user, filters, "Construction");
  if (type === "equipment") return getTransactionRows(user, filters, "Equipment");
  if (type === "feed") return getTransactionRows(user, filters, "Feed");
  if (type === "fuel") return getTransactionRows(user, filters, "Fuel");
  if (type === "consumables") return getTransactionRows(user, filters, "Consumables");
  if (type === "cash-savings") return getTransactionRows(user, filters, "CashSavings");
  if (type === "monthly-expenses") {
    const rows = await getTransactionRows(user, filters);
    return expenseSummaryRows(rows.map((row) => ({ ...row, Month: row.Date ? new Date(row.Date).toISOString().slice(0, 7) : "" })), "Month");
  }
  if (type === "expense-by-category") {
    const rows = await getTransactionRows(user, filters);
    return expenseSummaryRows(rows, "Category");
  }
  if (type === "weather") {
    const rows = await WeatherRecord.find({ user }).sort({ date: -1 }).lean();
    return rows.map((r) => ({ Date: r.recordDate, Condition: r.condition, Temperature: r.temperature, Humidity: r.humidity, Rainfall: r.rainfall, Wind: r.windSpeed, Impact: r.impact, Notes: r.notes }));
  }
  if (type === "alerts") {
    const intelligence = await generateFarmIntelligence(user);
    return intelligence.alerts.map((r) => ({ Type: r.type, Priority: r.priority, Related: r.related?.label || r.related?.kind, Message: r.message, SuggestedAction: r.suggestedAction, DateCreated: r.dateCreated }));
  }
  if (type === "full-summary") {
    const [animals, crops, transactions, health, vaccinations] = await Promise.all([
      Animal.countDocuments({ user }),
      Crop.countDocuments({ user }),
      Transaction.find(transactionQuery(user, filters)).lean(),
      HealthRecord.countDocuments({ user }),
      VaccinationRecord.countDocuments({ user })
    ]);
    const income = transactions.filter((t) => t.type === "income").reduce((sum, t) => sum + Number(t.amount || 0), 0);
    const expenses = transactions.filter((t) => t.type === "expense").reduce((sum, t) => sum + Number(t.amount || 0), 0);
    return [
      { Metric: "Animals", Value: animals },
      { Metric: "Crops", Value: crops },
      { Metric: "Health records", Value: health },
      { Metric: "Vaccinations", Value: vaccinations },
      { Metric: "Income", Value: income },
      { Metric: "Expenses", Value: expenses },
      { Metric: "Profit/Loss", Value: income - expenses }
    ];
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

async function getIndividualAnimalData(user, animalId) {
  const animal = await Animal.findOne({ _id: animalId, user }).populate("mother", "animalId name").populate("father", "animalId name").populate("children", "animalId name");
  if (!animal) return null;
  const [health, vaccinations, breeding, births, costs] = await Promise.all([
    HealthRecord.find({ user, animal: animal._id }).sort({ recordDate: -1 }).lean(),
    VaccinationRecord.find({ user, animal: animal._id }).sort({ nextDueDate: 1 }).lean(),
    BreedingRecord.find({ user, $or: [{ femaleAnimal: animal._id }, { maleAnimal: animal._id }] }).populate("femaleAnimal", "animalId name").populate("maleAnimal", "animalId name").sort({ matingDate: -1 }).lean(),
    BirthRecord.find({ user, $or: [{ mother: animal._id }, { father: animal._id }, { offspring: animal._id }] }).populate("mother", "animalId name").populate("father", "animalId name").populate("offspring", "animalId name").sort({ birthDate: -1 }).lean(),
    Transaction.find({ user, animal: animal._id }).sort({ transactionDate: -1 }).lean()
  ]);
  return { animal, health, vaccinations, breeding, births, costs };
}

function individualAnimalRows(data) {
  const { animal, health, vaccinations, breeding, births, costs } = data;
  return [
    { Section: "Basic", Field: "Animal ID", Value: animal.animalId },
    { Section: "Basic", Field: "Name", Value: animal.name },
    { Section: "Basic", Field: "Species", Value: animal.species },
    { Section: "Basic", Field: "Breed", Value: animal.breed },
    { Section: "Basic", Field: "Gender", Value: animal.gender },
    { Section: "Basic", Field: "Date of birth", Value: animal.dateOfBirth },
    { Section: "Family", Field: "Mother", Value: animal.mother ? `${animal.mother.animalId} - ${animal.mother.name || ""}` : "" },
    { Section: "Family", Field: "Father", Value: animal.father ? `${animal.father.animalId} - ${animal.father.name || ""}` : "" },
    { Section: "Family", Field: "Children", Value: (animal.children || []).map((child) => `${child.animalId} - ${child.name || ""}`).join("; ") },
    { Section: "QR", Field: "QR code", Value: animal.qrCodeValue },
    ...health.map((r) => ({ Section: "Health", Date: r.recordDate, Field: r.condition, Treatment: r.treatment, Medication: r.medication, Vet: r.vetName, TotalCost: r.totalCost, Notes: r.notes })),
    ...vaccinations.map((r) => ({ Section: "Vaccination", Date: r.dateGiven, Field: r.vaccineName, NextDue: r.nextDueDate, Vet: r.vetName, Batch: r.batchNumber, TotalCost: r.totalCost, Notes: r.notes })),
    ...breeding.map((r) => ({ Section: "Breeding", Date: r.matingDate, Field: `${r.femaleAnimal?.animalId} x ${r.maleAnimal?.animalId}`, Status: r.pregnancyStatus, Result: r.breedingResult, Notes: r.notes })),
    ...births.map((r) => ({ Section: "Birth", Date: r.birthDate, Field: `Offspring ${(r.offspring || []).map((a) => a.animalId).join(", ")}`, Mother: r.mother?.animalId, Father: r.father?.animalId, Notes: r.notes })),
    ...costs.map((r) => ({ Section: "Finance", Date: r.transactionDate, Field: r.item || r.category, Description: r.description, Category: r.category, TotalCost: r.totalCost || r.amount, PaymentMethod: r.paymentMethod }))
  ];
}

export async function sendIndividualAnimal(res, user, animalId, format = "pdf") {
  const data = await getIndividualAnimalData(user, animalId);
  if (!data) return res.status(404).json({ message: "Animal not found" });
  const name = `animal_${data.animal.animalId}_report`;
  const rows = individualAnimalRows(data);
  if (format === "csv") return sendCsv(res, name, rows);
  if (format === "xlsx") return sendExcel(res, name, rows);
  if (format !== "pdf") return res.status(400).json({ message: "Unsupported export format" });
  return sendIndividualAnimalPdf(res, data);
}

async function sendIndividualAnimalPdf(res, data) {
  const { animal, health, vaccinations, breeding, births, costs } = data;

  const doc = new PDFDocument({ margin: 42, size: "A4" });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${animal.animalId}-record.pdf"`);
  doc.pipe(res);
  doc.fontSize(18).text(`Animal Record - ${animal.animalId}`, { underline: true });
  doc.moveDown();

  section(doc, "Basic Details");
  bullet(doc, "Name", animal.name);
  bullet(doc, "Species", animal.species);
  bullet(doc, "Breed", animal.breed);
  bullet(doc, "Gender", animal.gender);
  bullet(doc, "Status", animal.status);
  bullet(doc, "Weight", `${animal.weight || 0} kg`);
  bullet(doc, "Location", animal.location);
  bullet(doc, "Estimated value", animal.estimatedValue);
  bullet(doc, "Notes", animal.notes);

  section(doc, "QR Code");
  bullet(doc, "Scan link", animal.qrCodeValue);
  if (animal.qrCodeValue) {
    const dataUrl = await QRCode.toDataURL(animal.qrCodeValue, { width: 120, margin: 1 });
    doc.image(Buffer.from(dataUrl.split(",")[1], "base64"), { width: 95 });
  }

  section(doc, "Family");
  bullet(doc, "Mother", animal.mother ? `${animal.mother.animalId} - ${animal.mother.name || ""}` : "");
  bullet(doc, "Father", animal.father ? `${animal.father.animalId} - ${animal.father.name || ""}` : "");
  bullet(doc, "Children", (animal.children || []).map((child) => `${child.animalId} - ${child.name || ""}`).join("; "));

  barChart(doc, "Record Counts", {
    Health: health.length,
    Vaccinations: vaccinations.length,
    Breeding: breeding.length,
    Births: births.length
  });

  barChart(doc, "Animal Cost Summary", {
    "Health costs": health.reduce((sum, r) => sum + Number(r.totalCost || 0), 0),
    "Vaccination costs": vaccinations.reduce((sum, r) => sum + Number(r.totalCost || 0), 0),
    "Linked finance costs": costs.reduce((sum, r) => sum + Number(r.totalCost || r.amount || 0), 0)
  });

  section(doc, "Health History");
  health.length ? health.forEach((r) => bullet(doc, fmt(r.recordDate), `${r.condition} - ${r.recoveryStatus} - ${r.treatment || ""}`)) : bullet(doc, "Records", "None");

  section(doc, "Vaccination History");
  vaccinations.length ? vaccinations.forEach((r) => bullet(doc, r.vaccineName, `${r.status} - next due ${fmt(r.nextDueDate)} - batch ${r.batchNumber || ""}`)) : bullet(doc, "Records", "None");

  section(doc, "Breeding History");
  breeding.length ? breeding.forEach((r) => bullet(doc, fmt(r.matingDate), `${r.femaleAnimal?.animalId} x ${r.maleAnimal?.animalId} - ${r.pregnancyStatus} - ${r.breedingResult}`)) : bullet(doc, "Records", "None");

  section(doc, "Birth History");
  births.length ? births.forEach((r) => bullet(doc, fmt(r.birthDate), `Mother ${r.mother?.animalId}, Father ${r.father?.animalId}, Offspring ${(r.offspring || []).map((a) => a.animalId).join(", ")}`)) : bullet(doc, "Records", "None");

  section(doc, "Production Records");
  bullet(doc, "Status", "Production module not added yet");
  doc.end();
}

async function getIndividualCropData(user, cropId) {
  const crop = await Crop.findOne({ _id: cropId, user }).lean();
  if (!crop) return null;
  const expenses = await Transaction.find({ user, crop: crop._id }).sort({ transactionDate: -1 }).lean();
  return { crop, expenses };
}

function individualCropRows(data) {
  const { crop, expenses } = data;
  const totalExpenses = expenses.reduce((sum, r) => sum + Number(r.totalCost || r.amount || 0), 0);
  return [
    { Section: "Crop", Field: "Name", Value: crop.name },
    { Section: "Crop", Field: "Plot/location", Value: `${crop.field || ""} ${crop.plot || ""}`.trim() },
    { Section: "Crop", Field: "Planting date", Value: crop.plantingDate },
    { Section: "Crop", Field: "Expected harvest", Value: crop.harvestDate },
    { Section: "Crop", Field: "Status", Value: crop.status },
    { Section: "Crop", Field: "Expected yield", Value: crop.expectedYield },
    { Section: "Crop", Field: "Actual yield", Value: crop.actualYield },
    { Section: "Crop", Field: "Total expenses", Value: totalExpenses },
    { Section: "Crop", Field: "Revenue", Value: crop.revenue },
    { Section: "Crop", Field: "Profit/loss estimate", Value: Number(crop.revenue || 0) - totalExpenses },
    ...expenses.map((r) => ({ Section: "Expense", Date: r.transactionDate, Category: r.category, Item: r.item, Description: r.description, Quantity: r.quantity, Unit: r.unit, UnitCost: r.unitCost, TotalCost: r.totalCost || r.amount, PaymentMethod: r.paymentMethod, SupplierVendor: r.supplierVendor, Notes: r.notes || r.remarks }))
  ];
}

export async function sendIndividualCrop(res, user, cropId, format = "pdf") {
  const data = await getIndividualCropData(user, cropId);
  if (!data) return res.status(404).json({ message: "Crop not found" });
  const name = `crop_${data.crop.name}_${data.crop.plot || data.crop.field || "report"}`.replace(/[^a-z0-9_-]+/gi, "_").toLowerCase();
  const rows = individualCropRows(data);
  if (format === "csv") return sendCsv(res, name, rows);
  if (format === "xlsx") return sendExcel(res, name, rows);
  if (format !== "pdf") return res.status(400).json({ message: "Unsupported export format" });
  return sendIndividualCropPdf(res, data);
}

async function sendIndividualCropPdf(res, data) {
  const { crop, expenses } = data;
  const totalExpenses = expenses.reduce((sum, r) => sum + Number(r.totalCost || r.amount || 0), 0);
  const byCategory = expenses.reduce((out, r) => {
    out[r.category || "Other"] = (out[r.category || "Other"] || 0) + Number(r.totalCost || r.amount || 0);
    return out;
  }, {});

  const doc = new PDFDocument({ margin: 42, size: "A4" });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${crop.name}-crop-record.pdf"`);
  doc.pipe(res);
  doc.fontSize(18).text(`Crop Record - ${crop.name}`, { underline: true });
  doc.moveDown();

  section(doc, "Crop Details");
  bullet(doc, "Crop name", crop.name);
  bullet(doc, "Field", crop.field);
  bullet(doc, "Plot", crop.plot);
  bullet(doc, "Area", `${crop.area || 0} acres`);
  bullet(doc, "Planting date", fmt(crop.plantingDate));
  bullet(doc, "Harvest date", fmt(crop.harvestDate));
  bullet(doc, "Expected yield", crop.expectedYield);
  bullet(doc, "Actual yield", crop.actualYield);
  bullet(doc, "Old cost field", crop.cost);
  bullet(doc, "Linked expenses", totalExpenses);
  bullet(doc, "Revenue", crop.revenue);
  bullet(doc, "Profit/Loss", (crop.revenue || 0) - totalExpenses);
  bullet(doc, "Status", crop.status);
  bullet(doc, "Notes", crop.notes);

  barChart(doc, "Yield Chart", {
    "Expected yield": crop.expectedYield || 0,
    "Actual yield": crop.actualYield || 0
  });

  barChart(doc, "Financial Chart", {
    Expenses: totalExpenses,
    Revenue: crop.revenue || 0,
    "Profit/Loss": (crop.revenue || 0) - totalExpenses
  });

  barChart(doc, "Expenses by Category", byCategory);

  section(doc, "Crop Expenses");
  expenses.length ? expenses.forEach((r) => bullet(doc, fmt(r.transactionDate), `${r.category} - ${r.item || r.description || ""} - ${r.totalCost || r.amount}`)) : bullet(doc, "Expenses", "None");

  doc.end();
}

const backupModels = {
  animals: Animal,
  crops: Crop,
  healthRecords: HealthRecord,
  vaccinations: VaccinationRecord,
  breeding: BreedingRecord,
  births: BirthRecord,
  finance: Transaction,
  documents: Document,
  weather: WeatherRecord
};

function cleanBackupRecord(record, user) {
  const out = { ...record };
  delete out._id;
  delete out.__v;
  out.user = user;
  return out;
}

export async function getBackup(user) {
  const entries = await Promise.all(Object.entries(backupModels).map(async ([key, Model]) => [key, await Model.find({ user }).lean()]));
  return {
    exportedAt: new Date().toISOString(),
    app: "Smart Farm AI",
    version: 1,
    data: Object.fromEntries(entries)
  };
}

export async function importBackupData(user, backup) {
  const data = backup?.data || backup;
  if (!data || typeof data !== "object") throw new Error("Invalid backup file");
  const result = {};
  for (const [key, Model] of Object.entries(backupModels)) {
    const rows = Array.isArray(data[key]) ? data[key] : [];
    if (!rows.length) {
      result[key] = 0;
      continue;
    }
    const cleaned = rows.map((row) => cleanBackupRecord(row, user));
    const inserted = await Model.insertMany(cleaned, { ordered: false });
    result[key] = inserted.length;
  }
  return { message: "Backup imported as new records", imported: result };
}
