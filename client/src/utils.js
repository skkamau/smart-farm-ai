import { storageGet } from "./utils/storage";

function selectedCurrency() {
  try {
    const user = JSON.parse(storageGet("smartFarmUser") || "{}");
    return user?.preferences?.currency || "KES";
  } catch {
    return "KES";
  }
}

export const currency = {
  format(value) {
    const code = selectedCurrency();
    try {
      return new Intl.NumberFormat("en-KE", {
        style: "currency",
        currency: code,
        maximumFractionDigits: 0
      }).format(Number(value || 0));
    } catch {
      return `${code} ${Number(value || 0).toLocaleString("en-KE", { maximumFractionDigits: 0 })}`;
    }
  }
};

export function formatDate(value) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

export function inputDate(value) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}
