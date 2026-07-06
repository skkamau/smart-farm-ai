import { getBackup, getReportRows, importBackupData, sendCsv, sendExcel, sendIndividualAnimal, sendIndividualCrop, sendPdf } from "../services/reportService.js";

export async function exportReport(req, res, next) {
  try {
    const { type, format } = req.params;
    const rows = await getReportRows(req.user._id, type, req.query);
    const name = `smart-farm-${type}-report-${new Date().toISOString().slice(0, 10)}`;
    if (format === "csv") return sendCsv(res, name, rows);
    if (format === "xlsx") return sendExcel(res, name, rows);
    if (format === "pdf") return sendPdf(res, name, rows, type);
    return res.status(400).json({ message: "Unsupported export format" });
  } catch (error) {
    next(error);
  }
}

export async function exportAnimalRecord(req, res, next) {
  try {
    await sendIndividualAnimal(res, req.user._id, req.params.id, req.params.format);
  } catch (error) {
    next(error);
  }
}

export async function exportCropRecord(req, res, next) {
  try {
    await sendIndividualCrop(res, req.user._id, req.params.id, req.params.format);
  } catch (error) {
    next(error);
  }
}

export async function exportBackup(req, res, next) {
  try {
    const backup = await getBackup(req.user._id);
    const today = new Date().toISOString().slice(0, 10);
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="full_farm_backup_${today}.json"`);
    res.json(backup);
  } catch (error) {
    next(error);
  }
}

export async function importBackup(req, res, next) {
  try {
    if (req.query.confirm !== "true") return res.status(400).json({ message: "Import requires confirmation" });
    const result = await importBackupData(req.user._id, req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
}
