import { SparklesIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney, formatPercentChange } from "@/lib/format";
import type { DailySummary } from "@/lib/types";

/** Özeti dışarıdan alır: dashboard tek istekle hem sayıları hem yorumu çekiyor. */
export function AiSummaryCard({ summary }: { summary: DailySummary }) {
  const week = summary.orders_available ? summary.week : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <SparklesIcon className="size-4 text-muted-foreground" />
          Yapay zekâ haftalık yorumu
        </CardTitle>
        {week && (
          <CardDescription>
            Bu hafta {formatMoney(week.revenue)}
            {week.revenue_change_percent !== null &&
              ` · geçen haftaya göre ${formatPercentChange(week.revenue_change_percent)}`}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent>
        <SummaryText summary={summary} hasWeek={Boolean(week)} />
      </CardContent>
    </Card>
  );
}

function SummaryText({ summary, hasWeek }: { summary: DailySummary; hasWeek: boolean }) {
  if (!hasWeek) {
    return (
      <p className="text-sm text-muted-foreground">
        Sipariş verilerine şu an ulaşılamıyor, yorum üretilemedi.
      </p>
    );
  }

  if (!summary.ai_summary) {
    return <p className="text-sm text-muted-foreground">Yorum şu an üretilemedi. Sayısal özet etkilenmedi.</p>;
  }

  return <p className="whitespace-pre-line text-sm leading-relaxed">{summary.ai_summary}</p>;
}
