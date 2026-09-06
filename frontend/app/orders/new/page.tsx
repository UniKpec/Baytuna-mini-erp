"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ProtectedPage } from "@/components/ProtectedPage";
import { ApiError, createOrder, getCustomers, getProducts } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import type { Customer, Order, Product } from "@/lib/types";

type Line = { productId: string; quantity: number };

export default function NewOrderPage() {
  return (
    <ProtectedPage allowedRoles={["sales"]}>
      <NewOrderForm />
    </ProtectedPage>
  );
}

function NewOrderForm() {
  const router = useRouter();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [customerId, setCustomerId] = useState("");
  const [lines, setLines] = useState<Line[]>([{ productId: "", quantity: 1 }]);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [rejected, setRejected] = useState<string | null>(null);

  useEffect(() => {
    // İki servisten paralel çekiyoruz; biri yavaşsa diğerini bekletmesin.
    Promise.all([getCustomers(), getProducts()])
      .then(([customerList, productList]) => {
        setCustomers(customerList);
        setProducts(productList);
      })
      .catch((caught) => setLoadError(caught instanceof ApiError ? caught.message : "Veriler yüklenemedi."))
      .finally(() => setLoading(false));
  }, []);

  const productsById = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products],
  );

  const total = useMemo(
    () =>
      lines.reduce((sum, line) => {
        const product = productsById.get(line.productId);
        return product ? sum + product.sale_price * line.quantity : sum;
      }, 0),
    [lines, productsById],
  );

  const selectedIds = lines.map((line) => line.productId).filter(Boolean);
  const filledLines = lines.filter((line) => line.productId && line.quantity > 0);
  const canSubmit = Boolean(customerId) && filledLines.length > 0 && !submitting;

  function updateLine(index: number, patch: Partial<Line>) {
    setLines((current) => current.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  function addLine() {
    setLines((current) => [...current, { productId: "", quantity: 1 }]);
  }

  function removeLine(index: number) {
    setLines((current) => (current.length === 1 ? current : current.filter((_, i) => i !== index)));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitError(null);
    setRejected(null);
    setSubmitting(true);

    try {
      const order = await createOrder(
        customerId,
        filledLines.map((line) => ({ productId: line.productId, quantity: line.quantity })),
      );
      router.push(`/orders/${order.id}`);
    } catch (caught) {
      if (!(caught instanceof ApiError)) {
        setSubmitError("Sipariş gönderilemedi.");
        return;
      }
      if (caught.status === 409) {
        // Stok yetmedi: sipariş kaydedildi ama reddedildi.
        const body = caught.body as Partial<Order> | null;
        setRejected(body?.rejectionReason ?? "Stok yetersiz olduğu için sipariş reddedildi.");
      } else if (caught.status === 503) {
        setSubmitError(
          "Servis A'ya ulaşılamıyor. Sipariş beklemede kaldı, stok düşülmedi. Birazdan tekrar dene.",
        );
      } else {
        setSubmitError(caught.message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <p className="text-sm text-slate-500">Yükleniyor…</p>;

  if (loadError) {
    return (
      <p role="alert" className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
        {loadError}
      </p>
    );
  }

  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight">Yeni sipariş</h1>
      <p className="mt-1 text-sm text-slate-500">
        Fiyatlar sistem tarafından hesaplanır, elle değiştirilemez.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-6">
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <label htmlFor="customer" className="block text-sm font-medium text-slate-700">
            Müşteri
          </label>
          <select
            id="customer"
            required
            value={customerId}
            onChange={(event) => setCustomerId(event.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
          >
            <option value="">Müşteri seç…</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name} — {customer.email}
              </option>
            ))}
          </select>
          {customers.length === 0 && (
            <p className="mt-2 text-sm text-amber-700">
              Kayıtlı müşteri yok. Önce müşteri eklenmeli.
            </p>
          )}
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-medium text-slate-700">Kalemler</h2>

          <div className="mt-3 space-y-3">
            {lines.map((line, index) => {
              const product = productsById.get(line.productId);
              const stokYetersiz = product ? line.quantity > product.stock_quantity : false;

              return (
                <div key={index} className="flex flex-wrap items-start gap-3">
                  <div className="min-w-56 flex-1">
                    <select
                      aria-label={`Kalem ${index + 1} ürünü`}
                      value={line.productId}
                      onChange={(event) => updateLine(index, { productId: event.target.value })}
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
                    >
                      <option value="">Ürün seç…</option>
                      {products
                        // Aynı ürün iki ayrı kaleme bölünmesin, listeden düşürüyoruz.
                        .filter((item) => item.id === line.productId || !selectedIds.includes(item.id))
                        .map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name} ({item.sku}) — {formatMoney(item.sale_price)} · stok {item.stock_quantity}
                          </option>
                        ))}
                    </select>
                    {stokYetersiz && (
                      <p className="mt-1 text-xs text-amber-700">
                        Stokta {product?.stock_quantity} adet var, sipariş reddedilebilir.
                      </p>
                    )}
                  </div>

                  <input
                    type="number"
                    min={1}
                    aria-label={`Kalem ${index + 1} adedi`}
                    value={line.quantity}
                    onChange={(event) =>
                      updateLine(index, { quantity: Math.max(1, Number(event.target.value) || 1) })
                    }
                    className="w-24 rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
                  />

                  <span className="w-28 py-2 text-right text-sm tabular-nums text-slate-600">
                    {product ? formatMoney(product.sale_price * line.quantity) : "-"}
                  </span>

                  <button
                    type="button"
                    onClick={() => removeLine(index)}
                    disabled={lines.length === 1}
                    className="py-2 text-sm text-slate-400 hover:text-rose-600 disabled:opacity-30"
                  >
                    Kaldır
                  </button>
                </div>
              );
            })}
          </div>

          <button
            type="button"
            onClick={addLine}
            className="mt-4 rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:border-slate-500"
          >
            + Ürün ekle
          </button>

          <div className="mt-5 flex items-center justify-between border-t border-slate-200 pt-4">
            <span className="text-sm text-slate-500">Toplam</span>
            <span className="text-lg font-semibold tabular-nums">{formatMoney(total)}</span>
          </div>
        </section>

        {rejected && (
          <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-4">
            <h3 className="text-sm font-medium text-rose-900">Sipariş reddedildi</h3>
            <p className="mt-1 text-sm text-rose-800">{rejected}</p>
            <Link href="/orders" className="mt-2 inline-block text-sm text-rose-900 underline">
              Sipariş listesine git
            </Link>
          </div>
        )}

        {submitError && (
          <p role="alert" className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {submitError}
          </p>
        )}

        <button
          type="submit"
          disabled={!canSubmit}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-40"
        >
          {submitting ? "Gönderiliyor…" : "Siparişi oluştur"}
        </button>
      </form>
    </div>
  );
}
