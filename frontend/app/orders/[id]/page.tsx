"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeftIcon, CircleAlertIcon, ClockIcon, DownloadIcon } from "lucide-react";
import { ProtectedPage } from "@/components/ProtectedPage";
import { ErrorState, LoadingState } from "@/components/states";
import { StatusBadge } from "@/components/StatusBadge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ApiError, downloadInvoicePdf, getOrder } from "@/lib/api";
import { formatDate, formatMoney } from "@/lib/format";
import type { Invoice, Order } from "@/lib/types";

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

      <InvoiceCard order={order} />
    </>
  );
}

function InvoiceCard({ order }: { order: Order }) {
  const invoice = order.invoice;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Fatura</CardTitle>
        {invoice && (
          <CardAction>
            <InvoiceDownloadButton invoice={invoice} />
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        {invoice ? (
          <dl className="grid gap-x-8 gap-y-1 text-sm sm:grid-cols-2">
            <Row label="Fatura no" value={<span className="font-mono text-xs">{invoice.invoiceNumber}</span>} />
            <Row label="Tarih" value={formatDate(invoice.createdAt)} />
            <Row label="Tutar" value={formatMoney(invoice.totalAmount)} />
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
  );
}

function InvoiceDownloadButton({ invoice }: { invoice: Invoice }) {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDownload() {
    setDownloading(true);
    setError(null);
    try {
      const pdf = await downloadInvoicePdf(invoice.id);
      const url = URL.createObjectURL(pdf);
      const link = document.createElement("a");
      link.href = url;
      // Servis B dosya adını Content-Disposition'da veriyor ama CORS o başlığı tarayıcıya açmıyor;
      // adı fatura numarasından kendimiz üretiyoruz.
      link.download = `${invoice.invoiceNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      // Tarayıcı indirmeyi başlatmadan adresi iptal edersek dosya inmeyebilir.
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "PDF indirilemedi.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button variant="outline" size="sm" onClick={handleDownload} disabled={downloading}>
        {downloading ? <Spinner aria-label="PDF hazırlanıyor" /> : <DownloadIcon />}
        {downloading ? "Hazırlanıyor…" : "PDF indir"}
      </Button>
      {error && (
        <p role="alert" className="max-w-56 text-right text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
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
