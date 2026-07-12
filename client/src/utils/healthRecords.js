import { inputDate } from "../utils.js";

export function createMedicationRow() {
  return { medicationName: "", dosage: "", medicineCharge: "" };
}

export function recordForHealthForm(record) {
  const medications = Array.isArray(record.medications) && record.medications.length
    ? record.medications.map((item) => ({
        medicationName: item.medicationName || "",
        dosage: item.dosage || "",
        medicineCharge: item.medicineCharge ?? ""
      }))
    : (record.medication || record.dosage || Number(record.medicineCost || 0))
      ? [{ medicationName: record.medication || "", dosage: record.dosage || "", medicineCharge: record.medicineCost ?? "" }]
      : [createMedicationRow()];

  return {
    ...record,
    healthCondition: record.healthCondition || legacyHealthCondition(record.condition),
    animal: record.animal?._id || record.animal || "",
    recordDate: inputDate(record.recordDate),
    followUpDate: inputDate(record.followUpDate),
    medications
  };
}

function legacyHealthCondition(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (["healthy", "mild", "moderate", "serious", "critical", "recovering", "chronic", "stable", "unknown"].includes(normalized)) return normalized;
  return normalized === "sick" ? "moderate" : "unknown";
}

export function healthMedicationSummary(record) {
  if (Array.isArray(record.medications) && record.medications.length) {
    return record.medications
      .map((item) => [item.medicationName, item.dosage].filter(Boolean).join(" - "))
      .filter(Boolean)
      .join(", ");
  }
  return [record.medication, record.dosage].filter(Boolean).join(" - ");
}

export function isNonNegativeNumber(value) {
  return value === "" || value === null || value === undefined || (Number.isFinite(Number(value)) && Number(value) >= 0);
}
