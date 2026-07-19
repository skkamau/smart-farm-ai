import dotenv from "dotenv";
import mongoose from "mongoose";
import { connectDB } from "../config/db.js";
import User from "../models/User.js";
import VaccinationTemplate from "../models/VaccinationTemplate.js";

dotenv.config();

const targetEmail = "samkinyanjuik@gmail.com".trim().toLowerCase();
const safetyNotice = "Vaccination timing may vary by location, disease risk, vaccine manufacturer and veterinary guidance. Confirm the programme with a qualified veterinarian or relevant animal-health authority.";

const templates = [
  {
    templateKey: "sheep-enterotoxaemia",
    scheduleName: "Sheep Enterotoxaemia Vaccination",
    supportedSpecies: ["sheep"],
    vaccineName: "Enterotoxaemia vaccine",
    diseasePrevented: "Enterotoxaemia",
    recommendedTiming: "May be given initially at an appropriate time based on veterinary advice\nRepeat annually\nVaccinate ewes approximately 4-6 weeks before lambing\nLambs from vaccinated mothers: first dose at approximately 7 weeks and booster at approximately 11 weeks\nLambs from unvaccinated mothers: first dose at approximately 4 weeks and booster at approximately 8 weeks",
    explanation: "Disease-causing organisms may already be present within the animal, so disease may occur at any time.",
    majorSigns: "Sudden death, particularly among weaner lambs. Well-fed animals may be more susceptible."
  },
  {
    templateKey: "sheep-blue-tongue",
    scheduleName: "Sheep Blue Tongue Vaccination",
    supportedSpecies: ["sheep"],
    vaccineName: "Blue Tongue vaccine",
    diseasePrevented: "Blue Tongue",
    recommendedTiming: "Just before the rainy season.",
    explanation: "The disease is spread by biting insects that multiply during rainy periods.",
    majorSigns: "Swollen or bluish tongue."
  },
  {
    templateKey: "sheep-goat-rift-valley-fever",
    scheduleName: "Sheep and Goat Rift Valley Fever Vaccination",
    supportedSpecies: ["sheep", "goat"],
    vaccineName: "Rift Valley Fever vaccine",
    diseasePrevented: "Rift Valley Fever",
    recommendedTiming: "Just before the rainy season.",
    explanation: "The disease is spread by biting insects that multiply during rainy periods.",
    majorSigns: "Deaths and yellowing of mucous membranes."
  },
  {
    templateKey: "sheep-goat-orf",
    scheduleName: "Sheep and Goat ORF Vaccination",
    supportedSpecies: ["sheep", "goat"],
    vaccineName: "ORF vaccine",
    diseasePrevented: "ORF, also known as contagious ecthyma",
    recommendedTiming: "During dry seasons.",
    explanation: "The disease is commonly spread through direct contact, particularly during dry periods when animals move in search of pasture.",
    majorSigns: "Wounds or sores around the corners of the mouth."
  },
  {
    templateKey: "sheep-goat-ppr",
    scheduleName: "Sheep and Goat PPR Vaccination",
    supportedSpecies: ["sheep", "goat"],
    vaccineName: "PPR vaccine",
    diseasePrevented: "Peste des Petits Ruminants",
    recommendedTiming: "During dry seasons.",
    explanation: "The disease may spread through direct contact, especially when animals move in search of pasture.",
    majorSigns: "Weight loss, diarrhoea and abortion."
  },
  {
    templateKey: "sheep-goat-pox",
    scheduleName: "Sheep and Goat Pox Vaccination",
    supportedSpecies: ["sheep", "goat"],
    vaccineName: "Sheep and Goat Pox vaccine",
    diseasePrevented: "Sheep and Goat Pox",
    recommendedTiming: "During dry seasons.",
    explanation: "The disease may spread through direct contact, especially when animals move in search of pasture.",
    majorSigns: "Large pimples or skin lesions over the body."
  },
  {
    templateKey: "sheep-goat-foot-and-mouth",
    scheduleName: "Sheep and Goat Foot-and-Mouth Disease Vaccination",
    supportedSpecies: ["sheep", "goat"],
    vaccineName: "Foot-and-Mouth Disease vaccine",
    diseasePrevented: "Foot-and-Mouth Disease",
    recommendedTiming: "During dry seasons, according to veterinary and local disease-control guidance.",
    explanation: "The disease may spread through direct contact and animal movement.",
    majorSigns: "Wounds or lesions on the gums and feet."
  },
  {
    templateKey: "goat-ccpp",
    scheduleName: "Goat CCPP Vaccination",
    supportedSpecies: ["goat"],
    vaccineName: "CCPP vaccine",
    diseasePrevented: "Contagious Caprine Pleuropneumonia",
    recommendedTiming: "During dry seasons.",
    explanation: "The disease may spread through direct contact, particularly when animals move in search of pasture.",
    majorSigns: "Severe pneumonia and hardened lung tissue."
  },
  {
    templateKey: "sheep-goat-pasteurellosis",
    scheduleName: "Sheep and Goat Pasteurellosis Vaccination",
    supportedSpecies: ["sheep", "goat"],
    vaccineName: "Pasteurellosis vaccine",
    diseasePrevented: "Pasteurellosis",
    recommendedTiming: "Just before the rainy season.",
    explanation: "Cold-weather stress may trigger disease.",
    majorSigns: "Pneumonia and breathing problems."
  },
  {
    templateKey: "sheep-goat-anthrax",
    scheduleName: "Sheep and Goat Anthrax Vaccination",
    supportedSpecies: ["sheep", "goat"],
    vaccineName: "Anthrax vaccine",
    diseasePrevented: "Anthrax",
    recommendedTiming: "According to veterinary and local animal-health authority guidance.",
    explanation: "Anthrax bacteria may persist in contaminated soil.",
    majorSigns: "Sudden death and blood oozing from the mouth, nose or eyes."
  }
].map((template) => ({
  ...template,
  species: template.supportedSpecies[0],
  treatmentType: "vaccination",
  safetyNotice
}));

function comparable(template) {
  return Object.fromEntries(Object.keys(template).map((key) => [key, template[key]]));
}

async function seedPrivateTemplates() {
  await connectDB();
  const user = await User.findOne({ email: targetEmail }).select("_id email farmName role").lean();
  if (!user) throw new Error(`Target account not found: ${targetEmail}`);

  const summary = { created: [], updated: [], skipped: [] };
  for (const template of templates) {
    const existing = await VaccinationTemplate.findOne({ user: user._id, templateKey: template.templateKey });
    if (!existing) {
      await VaccinationTemplate.create({ ...template, user: user._id });
      summary.created.push(template.templateKey);
      continue;
    }
    const current = comparable(existing.toObject());
    const changed = Object.entries(template).some(([key, value]) => JSON.stringify(current[key]) !== JSON.stringify(value));
    if (!changed) {
      summary.skipped.push(template.templateKey);
      continue;
    }
    Object.assign(existing, template);
    await existing.save();
    summary.updated.push(template.templateKey);
  }

  const total = await VaccinationTemplate.countDocuments({ user: user._id, templateKey: { $in: templates.map((template) => template.templateKey) } });
  console.log(JSON.stringify({ account: user.email, farm: user.farmName || "Smart Farm", role: user.role, total, ...summary }, null, 2));
}

seedPrivateTemplates()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => mongoose.connection.close());
