"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ProtectedPage } from "@/components/ProtectedPage";
import { StatusBadge } from "@/components/StatusBadge";
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

  if (loading) return <p className="text-sm text-slate-500">Yükleniyor…</p>;

  if (error) {
    return (
      <div>
        <BackLink />
        {error.status === 404 ? (
          <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-4">
            <h2 className="text-sm font-medium text-amber-900">Sipariş detayı görüntülenemiyor</h2>
            <p className="mt-1 text-sm text-amber-800">
              Sipariş bulunamadı ya da Servis B&apos;de{" "}
              <code className="font-mono">GET /api/orders/{"{id}"}</code> endpoint&apos;i henüz tanımlı değil.
            </p>
          </div>
        ) : (
          <p role="alert" className="mt-4 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error.message}
          </p>
        )}
      </div>
    );
  }

  if (!order) return null;

  return (
    <div>
      <BackLink />

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold tracking-tight">Sipariş detayı</h1>
        <StatusBadge status={order.status} />
      </div>

      <dl className="mt-4 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
        <Row label="Sipariş no" value={<span className="font-mono text-xs">{order.id}</span>} />
        <Row label="Tarih" value={formatDate(order.createdAt)} />
        <Row label="Müşteri" value={order.customerName ?? "-"} />
        <Row label="Toplam" value={<span className="font-medium">{formatMoney(order.totalAmount)}</span>} />
      </dl>

      {order.status === "rejected" && (
        <div className="mt-6 rounded-lg border border-rose-200 bg-rose-50 p-4">
          <h2 className="text-sm font-medium text-rose-900">Red sebebi</h2>
          <p className="mt-1 text-sm text-rose-800">
            {order.rejectionReason ?? "Stok yetersiz olduğu için reddedildi."}
          </p>
        </div>
      )}

      {order.status === "pending" && (
        <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm text-amber-800">
            Sipariş beklemede. Stok rezervasyonu tamamlanmadığı için stok düşülmedi ve fatura oluşmadı.
          </p>
        </div>
      )}

      <section className="mt-6 overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Ürün</th>
              <th className="px-4 py-3 text-right font-medium">Adet</th>
              <th className="px-4 py-3 text-right font-medium">Birim fiyat</th>
              <th className="px-4 py-3 text-right font-medium">Satır toplamı</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {order.items.map((item) => (
              <tr key={item.productId}>
                <td className="px-4 py-3">{item.productName}</td>
                <td className="px-4 py-3 text-right tabular-nums">{item.quantity}</td>
                <td className="px-4 py-3 text-right tabular-nums">{formatMoney(item.unitPrice)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{formatMoney(item.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t border-slate-200">
            <tr>
              <td colSpan={3} className="px-4 py-3 text-right text-slate-500">
                Toplam
              </td>
              <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatMoney(order.totalAmount)}</td>
            </tr>
          </tfoot>
        </table>
      </section>

      <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-medium text-slate-700">Fatura</h2>
        {order.invoice ? (
          <dl className="mt-3 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
            <Row label="Fatura no" value={<span className="font-mono text-xs">{order.invoice.invoiceNumber}</span>} />
            <Row label="Tarih" value={formatDate(order.invoice.createdAt)} />
            <Row label="Tutar" value={formatMoney(order.invoice.totalAmount)} />
            <Row
              label="PDF"
              value={
                order.invoice.pdfPath
                  ? "Hazır"
                  : "Henüz üretilmedi (Gün 17)"
              }
            />
          </dl>
        ) : (
          <p className="mt-2 text-sm text-slate-500">
            {order.status === "confirmed"
              ? "Fatura bilgisi bu yanıtta gelmiyor."
              : "Fatura yalnızca onaylanmış siparişler için oluşur."}
          </p>
        )}
      </section>
    </div>
  );
}

function BackLink() {
  return (
    <Link href="/orders" className="text-sm text-slate-500 underline-offset-2 hover:text-slate-900 hover:underline">
      ← Siparişler
    </Link>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-slate-100 py-1.5">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right text-slate-900">{value}</dd>
    </div>
  );
}
