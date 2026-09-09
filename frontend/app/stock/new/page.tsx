"use client";

import { useEffect, useState } from "react";
import { ProtectedPage } from "@/components/ProtectedPage";
import { useAuth } from "@/components/AuthProvider";
import type { Product } from "@/lib/types";
import { createStockMovement, getProducts } from "@/lib/api";

export default function NewStockMovementPage() {
    const { claims } = useAuth();
    const [productId, setProductId] = useState("");
    const [quantity, setQuantity] = useState("");
    const [unitCost, setUnitCost] = useState("");
    const [message, setMessage] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [products, setProducts] = useState<Product[]>([]);
    const [loadingProducts, setLoadingProducts] = useState(true);

    useEffect(() => {
        getProducts()
            .then(data => setProducts(data))
            .catch(err => setMessage(err.message))
            .finally(() => setLoadingProducts(false));
    }, []);

  if (!claims) return null;

  if (claims.role !== "warehouse") {
    return (
      <ProtectedPage>
        <p>Bu sayfaya erişim yetkin yok.</p>
      </ProtectedPage>
    );
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setSubmitting(true);
    setMessage(null);

    try {
      await createStockMovement(
        productId,
        Number(quantity),
        Number(unitCost)
      );

      setMessage("Stok girişi başarıyla kaydedildi.");

      setProductId("");
      setQuantity("");
      setUnitCost("");
    } catch (err) {
      setMessage(
        err instanceof Error
          ? err.message
          : "Stok girişi kaydedilemedi."
      );
    } finally {
      setSubmitting(false);
    }
  }


  return (
    <ProtectedPage>
        <div className="max-w-xl">
            <h1 className="text-xl font-semibold">Stok Girişi</h1>
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <div className="flex flex-col gap-1">
                <label className="text-sm font-medium">
                    Ürün
                </label>

                <select
                    value={productId}
                    onChange={(e) => setProductId(e.target.value)}
                    disabled={loadingProducts}
                    className="rounded-md border border-slate-300 px-3 py-2">
                    <option value="">
                    {loadingProducts ? "Ürünler yükleniyor..." : "Ürün seç"}
                    </option>

                    {products.map(product => (
                    <option key={product.id} value={product.id}>
                        {product.name} - {product.sku}
                    </option>
                    ))}
                </select>
                </div>

                <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium">
                        Miktar
                    </label>

                    <input
                        type="number"
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        className="rounded-md border border-slate-300 px-3 py-2"
                    />
                </div>

                <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium">
                        Birim Maliyet
                    </label>

                    <input
                        type="number"
                        step="0.01"
                        value={unitCost}
                        onChange={(e) => setUnitCost(e.target.value)}
                        className="rounded-md border border-slate-300 px-3 py-2"
                    />
                </div>
            </form>

            <button
                type="submit"
                disabled={submitting}
                className="rounded-md bg-slate-900 px-4 py-2 text-white disabled:opacity-50"
            >
                {submitting ? "Kaydediliyor..." : "Stok Girişi Yap"}
                </button>

                {message && (
                    <p className="text-sm text-slate-600">
                        {message}
                    </p>
                )}
        </div>
    </ProtectedPage>
  );
}