"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ProtectedPage } from "@/components/ProtectedPage";
import { StatusBadge } from "@/components/StatusBadge";
import { useAuth } from "@/components/AuthProvider";
import { ApiError, getOrders } from "@/lib/api";
import { formatDate, formatMoney } from "@/lib/format";
import type { Order } from "@/lib/types";

export default function OrdersPage() {
  return (
    <ProtectedPage>
      <OrderList />
    </ProtectedPage>
  );
}

function OrderList() {
  const { claims } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getOrders()
      .then(setOrders)
      .catch((caught) => setError(caught instanceof ApiError ? caught : new ApiError(0, "Siparişler yüklenemedi.", null)))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">Siparişler</h1>
        {claims?.role === "sales" && (
          <Link
            href="/orders/new"
            className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
          >
            Yeni sipariş
          </Link>
        )}
      </div>

      {loading && <p className="mt-6 text-sm text-slate-500">Yükleniyor…</p>}

      {/* Endpoint henüz yazılmadıysa kullanıcıya ne eksik olduğunu açıkça söylüyoruz. */}
      {error && error.status === 404 && (
        <div className="mt-6 rounded-lg border border-amber-300 bg-amber-50 p-4">
          <h2 className="text-sm font-medium text-amber-900">Sipariş listesi endpoint&apos;i henüz yok</h2>
          <p className="mt-1 text-sm text-amber-800">
            Servis B&apos;de <code className="font-mono">GET /api/orders</code> tanımlı değil.
            Endpoint eklendiğinde bu sayfa çalışacak.
          </p>
        </div>
      )}

      {error && error.status !== 404 && (
        <p role="alert" className="mt-6 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error.message}
        </p>
      )}

      {!loading && !error && orders.length === 0 && (
        <p className="mt-6 text-sm text-slate-500">Henüz sipariş yok.</p>
      )}

      {orders.length > 0 && (
        <div className="mt-6 overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Tarih</th>
                <th className="px-4 py-3 font-medium">Müşteri</th>
                <th className="px-4 py-3 font-medium">Durum</th>
                <th className="px-4 py-3 text-right font-medium">Tutar</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orders.map((order) => (
                <tr key={order.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 whitespace-nowrap text-slate-600">{formatDate(order.createdAt)}</td>
                  <td className="px-4 py-3">{order.customerName ?? "-"}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={order.status} />
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatMoney(order.totalAmount)}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/orders/${order.id}`} className="text-slate-500 underline-offset-2 hover:text-slate-900 hover:underline">
                      Detay
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
