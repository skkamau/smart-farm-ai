import { param, query } from "express-validator";

export const mongoIdParam = (name = "id") => param(name).isMongoId().withMessage(`Valid ${name} is required`);
export const optionalMongoIdQuery = (name) => query(name).optional({ values: "falsy" }).isMongoId().withMessage(`Valid ${name} is required`);

export const reportFormatParam = param("format")
  .isIn(["pdf", "csv", "xlsx"])
  .withMessage("Unsupported export format");

export const backupConfirmQuery = query("confirm")
  .equals("true")
  .withMessage("Import requires confirmation");
