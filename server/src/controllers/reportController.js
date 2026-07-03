import { getReportRows, sendCsv, sendExcel, sendIndividualAnimalPdf, sendIndividualCropPdf, sendPdf } from "../services/reportService.js";

export async function exportReport(req, res, next) {
  try {
    const { type, format } = req.params;
    const rows = await getReportRows(req.user._id, type);
    const name = `smart-farm-${type}-report`;
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
    await sendIndividualAnimalPdf(res, req.user._id, req.params.id);
  } catch (error) {
    next(error);
  }
}

export async function exportCropRecord(req, res, next) {
  try {
    await sendIndividualCropPdf(res, req.user._id, req.params.id);
  } catch (error) {
    next(error);
  }
}
