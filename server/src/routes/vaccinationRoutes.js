import express from "express";
import {
  createVaccination,
  deleteVaccination,
  listVaccinations,
  updateVaccination,
  vaccinationRules
} from "../controllers/vaccinationController.js";
import { protect } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { mongoIdParam, optionalMongoIdQuery } from "../middleware/validators.js";
import {
  campaignRules,
  cancelCampaign,
  createCampaign,
  createTemplate,
  deleteCampaign,
  deleteTemplate,
  listCampaigns,
  listTemplates,
  templateRules,
  updateAssignmentStatuses,
  updateCampaign,
  updateTemplate
} from "../controllers/vaccinationCampaignController.js";

const router = express.Router();

router.use(protect);
router.route("/").get(optionalMongoIdQuery("animal"), validate, listVaccinations).post(vaccinationRules, validate, createVaccination);
router.route("/campaigns").get(listCampaigns).post(campaignRules, validate, createCampaign);
router.patch("/campaigns/:id/assignments", mongoIdParam(), validate, updateAssignmentStatuses);
router.patch("/campaigns/:id/cancel", mongoIdParam(), validate, cancelCampaign);
router.route("/campaigns/:id").put(mongoIdParam(), campaignRules, validate, updateCampaign).delete(mongoIdParam(), validate, deleteCampaign);
router.route("/templates").get(listTemplates).post(templateRules, validate, createTemplate);
router.route("/templates/:id").put(templateRules, validate, updateTemplate).delete(deleteTemplate);
router.route("/:id").put(mongoIdParam(), vaccinationRules, validate, updateVaccination).delete(mongoIdParam(), validate, deleteVaccination);

export default router;
