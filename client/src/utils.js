export const currency = new Intl.NumberFormat("en-KE", {
  style: "currency",
  currency: "KES",
  maximumFractionDigits: 0
});

export function formatDate(value) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

export function inputDate(value) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}
