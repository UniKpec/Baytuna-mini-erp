const moneyFormatter = new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" });
const dateFormatter = new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" });
const dayFormatter = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short" });

export function formatMoney(value: number | null | undefined): string {
  if (value === null || value === undefined) return "-";
  return moneyFormatter.format(value);
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "-";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "-" : dateFormatter.format(parsed);
}

/** "2026-09-15" -> "15 Eyl". Öğlen saati veriliyor ki saat dilimi farkı günü bir öncekine kaydırmasın. */
export function formatDay(isoDate: string): string {
  const parsed = new Date(`${isoDate}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? isoDate : dayFormatter.format(parsed);
}

/** Türkçede yüzde işareti sayıdan önce yazılır: +%12,5 */
export function formatPercentChange(percent: number): string {
  const sign = percent > 0 ? "+" : percent < 0 ? "−" : "";
  const value = Math.abs(percent).toLocaleString("tr-TR", { maximumFractionDigits: 1 });
  return `${sign}%${value}`;
}
