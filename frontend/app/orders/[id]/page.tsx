"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeftIcon, CircleAlertIcon, ClockIcon } from "lucide-react";
import { ProtectedPage } from "@/components/ProtectedPage";
import { ErrorState, LoadingState } from "@/components/states";
import { StatusBadge } from "@/components/StatusBadge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ApiError, getOrder } from "@/lib/api";
import { formatDate, formatMoney } from "@/lib/format";
import type { Order } from "@/lib/types";

export default function OrderDetailPage() {
  return (
    <ProtectedPage>
      <OrderDetail />
    </ProtectedPage>
  );
}

function OrderDetail() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    getOrder(id)
      .then(setOrder)
      .catch((caught) => setError(caught instanceof ApiError ? caught : new ApiError(0, "Sipariş yüklenemedi.", null)))
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <div className="flex flex-col gap-6">
      <Link href="/orders" className={buttonVariants({ variant: "ghost", size: "sm", className: "w-fit" })}>
        <ArrowLeftIcon />
        Siparişler
      </Link>

      <OrderContent order={order} loading={loading} error={error} />
    </div>
  );
}

function OrderContent({ order, loading, error }: { order: Order | null; loading: boolean; error: ApiError | null }) {
  if (loading) return <LoadingState />;

  if (error) {
    return error.status === 404 ? (
      <ErrorState title="Sipariş bulunamadı" message="Bu numarayla kayıtlı bir sipariş yok." />
    ) : (
      <ErrorState title="Sipariş yüklenemedi" message={error.message} />
    );
  }

  if (!order) return null;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Sipariş bilgileri</CardTitle>
          <CardAction>
            <StatusBadge status={order.status} />
          </CardAction>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-x-8 gap-y-1 text-sm sm:grid-cols-2">
            <Row label="Sipariş no" value={<span className="font-mono text-xs">{order.id}</span>} />
            <Row label="Tarih" value={formatDate(order.createdAt)} />
            <Row label="Müşteri" value={order.customerName ?? "-"} />
            <Row label="Toplam" value={<span className="font-medium">{formatMoney(order.totalAmount)}</span>} />
          </dl>
        </CardContent>
      </Card>

      {order.status === "rejected" && (
        <Alert variant="destructive">
          <CircleAlertIcon />
          <AlertTitle>Red sebebi</AlertTitle>
          <AlertDescription>{order.rejectionReason ?? "Stok yetersiz olduğu için reddedildi."}</AlertDescription>
        </Alert>
      )}

      {order.status === "pending" && (
        <Alert>
          <ClockIcon />
          <AlertTitle>Sipariş beklemede</AlertTitle>
          <AlertDescription>Stok rezervasyonu tamamlanmadığı için stok düşülmedi ve fatura oluşmadı.</AlertDescription>
        </Alert>
      )}

      <Card className="gap-0 overflow-hidden py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Ürün</TableHead>
              <TableHead className="text-right">Adet</TableHead>
              <TableHead className="text-right">Birim fiyat</TableHead>
              <TableHead className="pr-4 text-right">Satır toplamı</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {order.items.map((item) => (
              <TableRow key={item.productId}>
                <TableCell className="pl-4 font-medium">{item.productName}</TableCell>
                <TableCell className="text-right tabular-nums">{item.quantity}</TableCell>
                <TableCell className="text-right tabular-nums">{formatMoney(item.unitPrice)}</TableCell>
                <TableCell className="pr-4 text-right tabular-nums">{formatMoney(item.lineTotal)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={3} className="pl-4 text-right text-muted-foreground">
                Toplam
              </TableCell>
              <TableCell className="pr-4 text-right font-semibold tabular-nums">{formatMoney(order.totalAmount)}</TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Fatura</CardTitle>
        </CardHeader>
        <CardContent>
          {order.invoice ? (
            <dl className="grid gap-x-8 gap-y-1 text-sm sm:grid-cols-2">
              <Row label="Fatura no" value={<span className="font-mono text-xs">{order.invoice.invoiceNumber}</span>} />
              <Row label="Tarih" value={formatDate(order.invoice.createdAt)} />
              <Row label="Tutar" value={formatMoney(order.invoice.totalAmount)} />
              <Row label="PDF" value={order.invoice.pdfPath ? "Hazır" : "Henüz hazır değil"} />
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">
              {order.status === "confirmed"
                ? "Fatura bilgisi bu yanıtta gelmiyor."
                : "Fatura yalnızca onaylanmış siparişler için oluşur."}
            </p>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b py-2 last:border-b-0 sm:nth-last-2:border-b-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  );
}
