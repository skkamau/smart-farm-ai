export function resolveVaccinationStatus(record) {
  if (!record.nextDueDate) return record.status || "completed";

  const due = new Date(record.nextDueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);

  return due < today ? "overdue" : "upcoming";
}

export async function normalizeVaccination(record) {
  record.status = resolveVaccinationStatus(record);
  if (record.isModified?.("status")) {
    await record.save();
  }
  return record;
}
