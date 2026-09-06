import type { OrderStatus } from "@/lib/types";

const STYLES: Record<OrderStatus, { label: string; className: string }> = {
  pending: { label: "Beklemede", className: "bg-amber-100 text-amber-800 ring-amber-200" },
  confirmed: { label: "Onaylandı", className: "bg-emerald-100 text-emerald-800 ring-emerald-200" },
  rejected: { label: "Reddedildi", className: "bg-rose-100 text-rose-800 ring-rose-200" },
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  const style = STYLES[status] ?? { label: status, className: "bg-slate-100 text-slate-700 ring-slate-200" };
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${style.className}`}>
      {style.label}
    </span>
  );
}
