import { Badge } from "@/components/ui/badge";
import type { OrderStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

// Renkler planda tanımlı anlamı taşıyor (beklemede sarı, onaylandı yeşil, reddedildi kırmızı);
// bu yüzden tema rengi yerine sabit renk kullanılıyor.
const STYLES: Record<OrderStatus, { label: string; className: string }> = {
  pending: {
    label: "Beklemede",
    className: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400",
  },
  confirmed: {
    label: "Onaylandı",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-400",
  },
  rejected: {
    label: "Reddedildi",
    className: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-400",
  },
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  const style = STYLES[status];
  if (!style) return <Badge variant="outline">{status}</Badge>;

  return (
    <Badge variant="outline" className={cn("gap-1.5", style.className)}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {style.label}
    </Badge>
  );
}
