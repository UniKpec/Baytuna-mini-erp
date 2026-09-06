const moneyFormatter = new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" });
const dateFormatter = new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" });

export function formatMoney(value: number | null | undefined): string {
  if (value === null || value === undefined) return "-";
  return moneyFormatter.format(value);
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "-";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "-" : dateFormatter.format(parsed);
}
