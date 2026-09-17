"use client";

import { useEffect, useState } from "react";
import { PageToolbar } from "@/components/page-toolbar";
import { ProtectedPage } from "@/components/ProtectedPage";
import { ErrorState, FormResultAlert, LoadingState, type FormResult } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { ApiError, createStockMovement, getProducts } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import type { Product } from "@/lib/types";

export default function NewStockMovementPage() {
  return (
    <ProtectedPage allowedRoles={["warehouse"]}>
      <StockEntryForm />
    </ProtectedPage>
  );
}

function StockEntryForm() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [result, setResult] = useState<FormResult>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getProducts()
      .then((list) => setProducts([...list].sort((a, b) => a.name.localeCompare(b.name, "tr"))))
      .catch((caught) => setLoadError(caught instanceof ApiError ? caught.message : "Ürünler yüklenemedi."))
      .finally(() => setLoading(false));
  }, []);

  const selected = products.find((product) => product.id === productId);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setResult(null);

    try {
      const movement = await createStockMovement(productId, Number(quantity), Number(unitCost));
      const updated = movement.product;

      // Sistemin hesapladığı yeni maliyet ve fiyatı gösteriyoruz: fiyatın elle değil otomatik belirlendiği burada görünüyor.
      setResult({
        type: "success",
        title: "Stok girişi kaydedildi",
        message: `${selected?.name ?? "Ürün"}: stok ${updated.stock_quantity} adet, ortalama maliyet ${formatMoney(updated.avg_cost)}, yeni satış fiyatı ${formatMoney(updated.sale_price)}.`,
      });
      // Seçim listesindeki stok ve fiyat bilgisi yeniden yüklemeden güncel kalsın.
      setProducts((current) =>
        current.map((product) =>
          product.id === productId
            ? { ...product, stock_quantity: updated.stock_quantity, avg_cost: updated.avg_cost, sale_price: updated.sale_price }
            : product,
        ),
      );
      setProductId("");
      setQuantity("");
      setUnitCost("");
    } catch (caught) {
      setResult({
        type: "error",
        title: "Stok girişi kaydedilemedi",
        message: caught instanceof ApiError ? caught.message : "Beklenmeyen bir hata oluştu.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <LoadingState />;
  if (loadError) return <ErrorState title="Ürünler yüklenemedi" message={loadError} />;

  return (
    <>
      <PageToolbar description="Gelen malı kaydet; ortalama maliyet ve satış fiyatı otomatik güncellenir." />

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Mal girişi</CardTitle>
          <CardDescription>Yalnızca miktar ve birim alış fiyatı girilir.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="product">Ürün</FieldLabel>
                <NativeSelect
                  id="product"
                  required
                  className="w-full"
                  value={productId}
                  onChange={(event) => setProductId(event.target.value)}
                >
                  <NativeSelectOption value="">Ürün seç…</NativeSelectOption>
                  {products.map((product) => (
                    <NativeSelectOption key={product.id} value={product.id}>
                      {product.name} ({product.sku})
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
                {selected && (
                  <FieldDescription>
                    Mevcut stok {selected.stock_quantity} adet · ortalama maliyet {formatMoney(selected.avg_cost)} · satış
                    fiyatı {formatMoney(selected.sale_price)}
                  </FieldDescription>
                )}
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="quantity">Miktar</FieldLabel>
                  <Input
                    id="quantity"
                    type="number"
                    inputMode="numeric"
                    required
                    min="1"
                    step="1"
                    value={quantity}
                    onChange={(event) => setQuantity(event.target.value)}
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="unit-cost">Birim alış fiyatı (₺)</FieldLabel>
                  <Input
                    id="unit-cost"
                    type="number"
                    inputMode="decimal"
                    required
                    min="0.01"
                    step="0.01"
                    value={unitCost}
                    onChange={(event) => setUnitCost(event.target.value)}
                  />
                </Field>
              </div>

              <FormResultAlert result={result} />

              <Button type="submit" disabled={submitting} className="w-fit">
                {submitting && <Spinner aria-label="Kaydediliyor" />}
                {submitting ? "Kaydediliyor…" : "Stok girişi yap"}
              </Button>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
