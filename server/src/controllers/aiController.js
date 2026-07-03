import { body } from "express-validator";
import { answerFarmQuestion, generateFarmIntelligence } from "../services/aiService.js";

export const assistantRules = [
  body("question").trim().notEmpty().withMessage("Question is required")
];

export async function getRecommendations(req, res, next) {
  try {
    const intelligence = await generateFarmIntelligence(req.user._id);
    res.json({ recommendations: intelligence.recommendations });
  } catch (error) {
    next(error);
  }
}

export async function getAlerts(req, res, next) {
  try {
    const intelligence = await generateFarmIntelligence(req.user._id);
    res.json({ alerts: intelligence.alerts });
  } catch (error) {
    next(error);
  }
}

export async function askAssistant(req, res, next) {
  try {
    const answer = await answerFarmQuestion(req.user._id, req.body.question);
    res.json({ answer });
  } catch (error) {
    next(error);
  }
}
