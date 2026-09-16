"use client";

import { useEffect, useState } from "react";
import { ApiError, getDailySummary } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import type { DailySummary } from "@/lib/types";

export function AiSummaryCard() {
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDailySummary()
      .then(setSummary)
      .catch((caught) => setError(caught instanceof ApiError ? caught.message : "Özet yüklenemedi."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5">
      <h2 className="text-sm font-medium text-slate-700">Yapay zekâ haftalık yorumu</h2>

      {loading && (
        <p className="mt-2 text-sm text-slate-500">Veriler yorumlanıyor, bu birkaç saniye sürebilir…</p>
      )}

      {error && (
        <p role="alert" className="mt-2 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      )}

      {summary && <SummaryBody summary={summary} />}
    </section>
  );
}

function SummaryBody({ summary }: { summary: DailySummary }) {
  if (!summary.orders_available || !summary.week) {
    return (
      <p className="mt-2 text-sm text-amber-800">
        Sipariş verilerine şu an ulaşılamıyor, yorum üretilemedi. Kritik stok bilgisi etkilenmedi.
      </p>
    );
  }

  return (
    <>
      <p className="mt-1 text-xs text-slate-500">
        Bu hafta {formatMoney(summary.week.revenue)}
        {summary.week.revenue_change_percent !== null &&
          ` · geçen haftaya göre ${formatChange(summary.week.revenue_change_percent)}`}
      </p>

      {summary.ai_summary ? (
        <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-800">{summary.ai_summary}</p>
      ) : (
        <p className="mt-3 text-sm text-slate-500">Yorum şu an üretilemedi. Sayısal özet etkilenmedi.</p>
      )}
    </>
  );
}

// Türkçede yüzde işareti sayıdan önce yazılır: +%12,5
function formatChange(percent: number): string {
  const sign = percent > 0 ? "+" : percent < 0 ? "−" : "";
  const value = Math.abs(percent).toLocaleString("tr-TR", { maximumFractionDigits: 1 });
  return `${sign}%${value}`;
}
