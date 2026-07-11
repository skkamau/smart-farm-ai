import { logActivity } from "../services/auditService.js";

const deletionTargets = [
  ["/api/animals/", "animal"],
  ["/api/crops/", "crop"],
  ["/api/transactions/", "finance_record"],
  ["/api/health-records/", "health_record"],
  ["/api/vaccinations/", "vaccination_record"],
  ["/api/breeding-records/", "breeding_record"],
  ["/api/birth-records/", "birth_record"],
  ["/api/weather/", "weather_record"],
  ["/api/documents/", "document"]
];

export function auditImportantDeletion(req, res, next) {
  if (req.method !== "DELETE") return next();
  const match = deletionTargets.find(([prefix]) => req.originalUrl.startsWith(prefix));
  if (!match) return next();

  res.on("finish", () => {
    if (res.statusCode < 200 || res.statusCode >= 300 || !req.user?._id) return;
    const targetId = req.originalUrl.split("?")[0].split("/").filter(Boolean).pop();
    void logActivity({
      actorUser: req.user._id,
      actorRole: req.user.role || "user",
      action: "record_deleted",
      targetType: match[1],
      targetId
    });
  });
  next();
}
