"use client";

import { useState } from "react";
import { ProtectedPage } from "@/components/ProtectedPage";
import { useAuth } from "@/components/AuthProvider";
import { createProduct } from "@/lib/api";

export default function NewProductPage() {
  const { claims } = useAuth();

  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [marginPercent, setMarginPercent] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setSubmitting(true);
    setMessage(null);

    try {
      await createProduct(
        name,
        sku,
        Number(marginPercent)
      );

      setMessage("Ürün başarıyla eklendi.");

      setName("");
      setSku("");
      setMarginPercent("");
    } catch (err) {
      setMessage(
        err instanceof Error ? err.message : "Ürün eklenemedi."
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (!claims) return null;

  if (claims.role !== "admin") {
    return (
      <ProtectedPage>
        <p>Bu sayfaya erişim yetkin yok.</p>
      </ProtectedPage>
    );
  }

  return (
    <ProtectedPage>
      <div className="max-w-xl">
        <h1 className="text-xl font-semibold">Yeni Ürün</h1>

        <form
          onSubmit={handleSubmit}
          className="mt-6 space-y-4"
        >
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">
              Ürün Adı
            </label>

            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">
              SKU
            </label>

            <input
              type="text"
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">
              Marj (%)
            </label>

            <input
              type="number"
              value={marginPercent}
              onChange={(e) => setMarginPercent(e.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-slate-900 px-4 py-2 text-white disabled:opacity-50"
          >
            {submitting ? "Ekleniyor..." : "Ürün Ekle"}
          </button>

          {message && (
            <p className="text-sm text-slate-600">
              {message}
            </p>
          )}
        </form>
      </div>
    </ProtectedPage>
  );
}