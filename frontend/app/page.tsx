"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import {
  PackagePlusIcon,
  PlusIcon,
  TrendingDownIcon,
  TrendingUpIcon,
  TriangleAlertIcon,
  WarehouseIcon,
  type LucideIcon,
} from "lucide-react";
import { AiSummaryCard } from "@/components/AiSummaryCard";
import { AskBox } from "@/components/AskBox";
import { useAuth } from "@/components/AuthProvider";
import { PageToolbar } from "@/components/page-toolbar";
import { ProtectedPage } from "@/components/ProtectedPage";
import { ErrorState, LoadingState } from "@/components/states";
import { StatusBadge } from "@/components/StatusBadge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ApiError, getDailySummary } from "@/lib/api";
import { formatDate, formatDay, formatMoney, formatPercentChange } from "@/lib/format";
import { ROLE_LABELS, type DailySummary, type Role } from "@/lib/types";
import { cn } from "@/lib/utils";

const chartConfig = {
  revenue: { label: "Ciro", color: "var(--chart-1)" },
} satisfies ChartConfig;

// Her rolün en sık yaptığı işe kısa yol.
const QUICK_ACTIONS: Record<Role, { href: string; label: string; icon: LucideIcon }> = {
  sales: { href: "/orders/new", label: "Yeni sipariş", icon: PlusIcon },
  warehouse: { href: "/stock/new", label: "Stok girişi", icon: WarehouseIcon },
  admin: { href: "/products/new", label: "Ürün ekle", icon: PackagePlusIcon },
};

const WARNING_BADGE =
  "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400";

export default function HomePage() {
  return (
    <ProtectedPage>
      <Dashboard />
    </ProtectedPage>
  );
}

function Dashboard() {
  const { claims } = useAuth();
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Tek istek: sayılar, grafik, kritik stok, son siparişler ve yapay zekâ yorumu aynı özetten geliyor.
    getDailySummary()
      .then(setSummary)
      .catch((caught) => setError(caught instanceof ApiError ? caught.message : "Özet yüklenemedi."))
      .finally(() => setLoading(false));
  }, []);

  if (!claims) return null;

  const action = QUICK_ACTIONS[claims.role];

  return (
    <>
      <PageToolbar description={`${ROLE_LABELS[claims.role]} olarak giriş yaptın.`}>
        <Link href={action.href} className={buttonVariants()}>
          <action.icon />
          {action.label}
        </Link>
      </PageToolbar>

      <DashboardContent summary={summary} loading={loading} error={error} />
    </>
  );
}

function DashboardContent({
  summary,
  loading,
  error,
}: {
  summary: DailySummary | null;
  loading: boolean;
  error: string | null;
}) {
  if (loading) return <LoadingState label="Özet hazırlanıyor; yapay zekâ yorumu birkaç saniye sürebilir…" />;
  if (error || !summary) return <ErrorState title="Özet yüklenemedi" message={error ?? "Beklenmeyen bir hata oluştu."} />;

  return (
    <div className="flex flex-col gap-6">
      {!summary.orders_available && (
        <Alert>
          <TriangleAlertIcon />
          <AlertTitle>Sipariş verilerine ulaşılamıyor</AlertTitle>
          <AlertDescription>
            Servis B şu an cevap vermiyor; sipariş ve ciro bilgileri gösterilemiyor. Kritik stok bilgisi günceldir.
          </AlertDescription>
        </Alert>
      )}

      <StatCards summary={summary} />

      <div className="grid gap-6 lg:grid-cols-5">
        <RevenueChart summary={summary} className="lg:col-span-3" />
        <CriticalStockCard summary={summary} className="lg:col-span-2" />
      </div>

      <RecentOrdersCard summary={summary} />

      <div className="grid gap-6 lg:grid-cols-2">
        <AiSummaryCard summary={summary} />
        <AskBox />
      </div>
    </div>
  );
}

function StatCards({ summary }: { summary: DailySummary }) {
  const { today, week } = summary;
  const change = week?.revenue_change_percent ?? null;
  const criticalCount = summary.critical_stock.length;

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        title="Bugünkü sipariş"
        value={today ? String(today.order_count) : "-"}
        footer={today ? `${today.confirmed_count} onaylandı · ${today.rejected_count} reddedildi` : "Veri yok"}
      />
      <StatCard
        title="Bugünkü ciro"
        value={today ? formatMoney(today.revenue) : "-"}
        footer="Yalnızca onaylanan siparişler"
      />
      <StatCard
        title="Bu haftaki ciro"
        value={week ? formatMoney(week.revenue) : "-"}
        footer={week ? `Geçen hafta ${formatMoney(week.previous_week_revenue)}` : "Veri yok"}
        badge={
          change !== null && (
            <Badge variant="outline">
              {change >= 0 ? <TrendingUpIcon /> : <TrendingDownIcon />}
              {formatPercentChange(change)}
            </Badge>
          )
        }
      />
      <StatCard
        title="Kritik stok"
        value={String(criticalCount)}
        valueClassName={criticalCount > 0 ? "text-amber-600 dark:text-amber-400" : undefined}
        footer={`${summary.critical_stock_threshold} adedin altındaki ürünler`}
      />
    </div>
  );
}

function StatCard({
  title,
  value,
  footer,
  badge,
  valueClassName,
}: {
  title: string;
  value: string;
  footer: string;
  badge?: React.ReactNode;
  valueClassName?: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{title}</CardDescription>
        <CardTitle className={cn("text-2xl font-semibold tabular-nums", valueClassName)}>{value}</CardTitle>
        {badge && <CardAction>{badge}</CardAction>}
      </CardHeader>
      <CardFooter className="text-xs text-muted-foreground">{footer}</CardFooter>
    </Card>
  );
}

function RevenueChart({ summary, className }: { summary: DailySummary; className?: string }) {
  const data = summary.last_7_days.map((day) => ({ label: formatDay(day.date), revenue: day.revenue }));

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Son 7 günün cirosu</CardTitle>
        <CardDescription>Onaylanan siparişlerin günlük toplamı</CardDescription>
      </CardHeader>
      <CardContent>
        {summary.orders_available ? (
          <ChartContainer config={chartConfig} className="aspect-auto h-60 w-full">
            <BarChart data={data}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    hideIndicator
                    formatter={(value) => (
                      <div className="flex w-full justify-between gap-4">
                        <span className="text-muted-foreground">Ciro</span>
                        <span className="font-mono font-medium tabular-nums">{formatMoney(Number(value))}</span>
                      </div>
                    )}
                  />
                }
              />
              <Bar dataKey="revenue" fill="var(--color-revenue)" radius={6} />
            </BarChart>
          </ChartContainer>
        ) : (
          <p className="text-sm text-muted-foreground">Sipariş verisi olmadan grafik çizilemiyor.</p>
        )}
      </CardContent>
    </Card>
  );
}

function CriticalStockCard({ summary, className }: { summary: DailySummary; className?: string }) {
  const items = summary.critical_stock;

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Kritik stok</CardTitle>
        <CardDescription>{summary.critical_stock_threshold} adedin altına düşen ürünler</CardDescription>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Kritik stokta ürün yok.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ürün</TableHead>
                <TableHead className="text-right">Stok</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div className="font-medium">{item.name}</div>
                    <div className="font-mono text-xs text-muted-foreground">{item.sku}</div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant="outline" className={WARNING_BADGE}>
                      {item.stock_quantity} adet
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function RecentOrdersCard({ summary }: { summary: DailySummary }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Son siparişler</CardTitle>
        <CardDescription>En son oluşturulan 5 sipariş</CardDescription>
        <CardAction>
          <Link href="/orders" className={buttonVariants({ variant: "outline", size: "sm" })}>
            Tümünü gör
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent>
        <RecentOrdersBody summary={summary} />
      </CardContent>
    </Card>
  );
}

function RecentOrdersBody({ summary }: { summary: DailySummary }) {
  if (!summary.orders_available) {
    return <p className="text-sm text-muted-foreground">Sipariş verilerine ulaşılamıyor.</p>;
  }

  if (summary.recent_orders.length === 0) {
    return <p className="text-sm text-muted-foreground">Henüz sipariş yok.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Tarih</TableHead>
          <TableHead>Müşteri</TableHead>
          <TableHead>Durum</TableHead>
          <TableHead className="text-right">Tutar</TableHead>
          <TableHead>
            <span className="sr-only">Detay</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {summary.recent_orders.map((order) => (
          <TableRow key={order.id}>
            <TableCell className="whitespace-nowrap text-muted-foreground">{formatDate(order.created_at)}</TableCell>
            <TableCell className="font-medium">{order.customer_name ?? "-"}</TableCell>
            <TableCell>
              <StatusBadge status={order.status} />
            </TableCell>
            <TableCell className="text-right tabular-nums">{formatMoney(order.total_amount)}</TableCell>
            <TableCell className="text-right">
              <Link href={`/orders/${order.id}`} className={buttonVariants({ variant: "ghost", size: "sm" })}>
                Detay
              </Link>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
