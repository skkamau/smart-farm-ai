import mongoose from "mongoose";
import AdminActivityLog from "../models/AdminActivityLog.js";
import Animal from "../models/Animal.js";
import BugReport from "../models/BugReport.js";
import Crop from "../models/Crop.js";
import HealthRecord from "../models/HealthRecord.js";
import Transaction from "../models/Transaction.js";
import UsageEvent from "../models/UsageEvent.js";
import User from "../models/User.js";

const inventorySections = ["Equipment", "Feed", "Fuel", "Consumables"];

function safeRegex(value) {
  const text = String(value || "").slice(0, 100);
  return new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
}

function startOfUtcDay(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function daysAgo(days) {
  const date = startOfUtcDay();
  date.setUTCDate(date.getUTCDate() - days);
  return date;
}

function countLookup(from, as, extraMatch = []) {
  return {
    $lookup: {
      from,
      let: { userId: "$_id" },
      pipeline: [
        { $match: { $expr: { $eq: ["$user", "$$userId"] } } },
        ...extraMatch,
        { $count: "value" }
      ],
      as
    }
  };
}

function countValue(field) {
  return { $ifNull: [{ $arrayElemAt: [`$${field}.value`, 0] }, 0] };
}

export async function adminDashboardData() {
  const weekStart = daysAgo(7);
  const [
    totalUsers, activeUsers, newUsersThisWeek, totalFarms, totalAnimals, totalCrops,
    totalHealthRecords, totalInventoryItems, totalFinanceRecords, newBugReports,
    recentRegistrations, recentReports
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ accountStatus: { $ne: "suspended" } }),
    User.countDocuments({ createdAt: { $gte: weekStart } }),
    User.countDocuments({ farmName: { $type: "string", $ne: "" } }),
    Animal.countDocuments(),
    Crop.countDocuments(),
    HealthRecord.countDocuments(),
    Transaction.countDocuments({ financeSection: { $in: inventorySections }, item: { $type: "string", $ne: "" } }),
    Transaction.countDocuments(),
    BugReport.countDocuments({ status: "New" }),
    User.find().select("name email farmName role accountStatus createdAt").sort({ createdAt: -1 }).limit(8).lean(),
    BugReport.find().populate("user", "name email farmName").sort({ createdAt: -1 }).limit(8).lean()
  ]);

  return {
    summary: { totalUsers, activeUsers, newUsersThisWeek, totalFarms, totalAnimals, totalCrops, totalHealthRecords, totalInventoryItems, totalFinanceRecords, newBugReports },
    recentRegistrations,
    recentReports
  };
}

export async function adminUsersData({ search = "", role = "", status = "", page = 1, limit = 50 } = {}) {
  const clauses = [];
  if (search) {
    const regex = safeRegex(search);
    clauses.push({ $or: [{ name: regex }, { email: regex }, { farmName: regex }] });
  }
  if (role === "user") clauses.push({ $or: [{ role: "user" }, { role: { $exists: false } }] });
  else if (["admin", "super_admin"].includes(role)) clauses.push({ role });
  if (status === "active") clauses.push({ $or: [{ accountStatus: "active" }, { accountStatus: { $exists: false } }] });
  else if (status === "suspended") clauses.push({ accountStatus: "suspended" });
  const match = clauses.length ? { $and: clauses } : {};

  const safePage = Math.max(Number(page) || 1, 1);
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
  const [users, total] = await Promise.all([
    User.aggregate([
      { $match: match },
      countLookup("animals", "animalStats"),
      countLookup("crops", "cropStats"),
      countLookup("healthrecords", "healthStats"),
      countLookup("transactions", "inventoryStats", [{ $match: { financeSection: { $in: inventorySections }, item: { $type: "string", $ne: "" } } }]),
      {
        $project: {
          name: 1, email: 1, farmName: 1, farmLocation: 1, farmType: 1,
          role: { $ifNull: ["$role", "user"] },
          accountStatus: { $ifNull: ["$accountStatus", "active"] },
          suspensionReason: 1, createdAt: 1, lastLoginAt: 1, lastActiveAt: 1,
          animalCount: countValue("animalStats"),
          cropCount: countValue("cropStats"),
          healthRecordCount: countValue("healthStats"),
          inventoryRecordCount: countValue("inventoryStats")
        }
      },
      { $sort: { createdAt: -1 } },
      { $skip: (safePage - 1) * safeLimit },
      { $limit: safeLimit }
    ]),
    User.countDocuments(match)
  ]);
  return { users, pagination: { page: safePage, limit: safeLimit, total, pages: Math.max(Math.ceil(total / safeLimit), 1) } };
}

export async function adminUserDetail(userId) {
  if (!mongoose.Types.ObjectId.isValid(userId)) return null;
  const result = await adminUsersData({ limit: 100 });
  const fromPage = result.users.find((user) => String(user._id) === String(userId));
  if (fromPage) return fromPage;
  const user = await User.findById(userId).select("name email farmName farmLocation farmType mainActivities phone role accountStatus suspensionReason suspendedAt createdAt lastLoginAt lastActiveAt").lean();
  if (!user) return null;
  const [animalCount, cropCount, healthRecordCount, inventoryRecordCount, financeRecordCount] = await Promise.all([
    Animal.countDocuments({ user: user._id }),
    Crop.countDocuments({ user: user._id }),
    HealthRecord.countDocuments({ user: user._id }),
    Transaction.countDocuments({ user: user._id, financeSection: { $in: inventorySections }, item: { $type: "string", $ne: "" } }),
    Transaction.countDocuments({ user: user._id })
  ]);
  return { ...user, animalCount, cropCount, healthRecordCount, inventoryRecordCount, financeRecordCount };
}

export async function adminReportsData({ search = "", status = "", reportType = "", limit = 100 } = {}) {
  const query = {};
  if (search) {
    const regex = safeRegex(search);
    query.$or = [{ title: regex }, { description: regex }];
  }
  if (["New", "Reviewing", "In progress", "Resolved", "Rejected"].includes(status)) query.status = status;
    if (["Bug", "Suggestion", "Feature request", "Account issue", "Data issue", "Payment issue", "Other"].includes(reportType)) query.reportType = reportType;
  return BugReport.find(query)
    .populate("user", "name email farmName")
    .populate("lastUpdatedBy", "name email")
    .sort({ createdAt: -1 })
    .limit(Math.min(Math.max(Number(limit) || 100, 1), 500))
    .lean();
}

export async function adminAnalyticsData() {
  const today = startOfUtcDay();
  const weekStart = daysAgo(6);
  const monthStart = daysAgo(29);
  const [dailyUsers, weeklyUsers, newRegistrations, featureUsage, dailyActive, recordCounts] = await Promise.all([
    UsageEvent.distinct("user", { day: { $gte: today } }),
    UsageEvent.distinct("user", { day: { $gte: weekStart } }),
    User.countDocuments({ createdAt: { $gte: weekStart } }),
    UsageEvent.aggregate([
      { $match: { createdAt: { $gte: monthStart } } },
      { $group: { _id: "$feature", uses: { $sum: 1 }, uniqueUsers: { $addToSet: "$user" } } },
      { $project: { _id: 0, feature: "$_id", uses: 1, uniqueUsers: { $size: "$uniqueUsers" } } },
      { $sort: { uses: -1 } }
    ]),
    UsageEvent.aggregate([
      { $match: { day: { $gte: monthStart } } },
      { $group: { _id: { day: "$day", user: "$user" } } },
      { $group: { _id: "$_id.day", users: { $sum: 1 } } },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, date: "$_id", users: 1 } }
    ]),
    Promise.all([
      Animal.countDocuments({ createdAt: { $gte: monthStart } }),
      Crop.countDocuments({ createdAt: { $gte: monthStart } }),
      HealthRecord.countDocuments({ createdAt: { $gte: monthStart } }),
      Transaction.countDocuments({ createdAt: { $gte: monthStart }, financeSection: { $in: inventorySections }, item: { $type: "string", $ne: "" } }),
      Transaction.countDocuments({ createdAt: { $gte: monthStart } })
    ])
  ]);

  return {
    summary: {
      dailyActiveUsers: dailyUsers.length,
      weeklyActiveUsers: weeklyUsers.length,
      newRegistrations,
      animalRecordsCreated: recordCounts[0],
      cropRecordsCreated: recordCounts[1],
      healthRecordsCreated: recordCounts[2],
      inventoryRecordsCreated: recordCounts[3],
      financeRecordsCreated: recordCounts[4]
    },
    featureUsage,
    dailyActive
  };
}

export async function adminLogsData({ action = "", outcome = "", limit = 100 } = {}) {
  const query = {};
  const actions = AdminActivityLog.schema.path("action").enumValues;
  if (actions.includes(action)) query.action = action;
  if (["success", "failure"].includes(outcome)) query.outcome = outcome;
  return AdminActivityLog.find(query)
    .populate("actorUser", "name email")
    .populate("targetUser", "name email")
    .sort({ createdAt: -1 })
    .limit(Math.min(Math.max(Number(limit) || 100, 1), 500))
    .lean();
}

export async function adminExportRows(type) {
  if (type === "users") {
    const users = [];
    for (let page = 1; page <= 100; page += 1) {
      const result = await adminUsersData({ page, limit: 100 });
      users.push(...result.users);
      if (page >= result.pagination.pages) break;
    }
    return users.map((user) => ({ Name: user.name, Email: user.email, Farm: user.farmName, Role: user.role, Status: user.accountStatus, Joined: user.createdAt, LastLogin: user.lastLoginAt, Animals: user.animalCount, Crops: user.cropCount, HealthRecords: user.healthRecordCount, InventoryRecords: user.inventoryRecordCount }));
  }
  if (type === "farms") {
    const users = await User.find({ farmName: { $type: "string", $ne: "" } }).select("farmName farmLocation farmType name email accountStatus createdAt").sort({ farmName: 1 }).limit(10000).lean();
    return users.map((user) => ({ Farm: user.farmName, Location: user.farmLocation, Type: user.farmType, Owner: user.name, Email: user.email, Status: user.accountStatus || "active", Joined: user.createdAt }));
  }
  if (type === "reports") {
    const reports = await adminReportsData({ limit: 500 });
    return reports.map((report) => ({ Type: report.reportType, Title: report.title, Description: report.description, Status: report.status, User: report.user?.name, Email: report.user?.email, Farm: report.user?.farmName, Submitted: report.createdAt, Updated: report.updatedAt, AdminNotes: report.adminNotes }));
  }
  if (type === "analytics") {
    const analytics = await adminAnalyticsData();
    return [
      ...Object.entries(analytics.summary).map(([metric, value]) => ({ Section: "Summary", Metric: metric, Value: value })),
      ...analytics.featureUsage.map((item) => ({ Section: "Feature usage", Metric: item.feature, Value: item.uses, UniqueUsers: item.uniqueUsers }))
    ];
  }
  return null;
}
