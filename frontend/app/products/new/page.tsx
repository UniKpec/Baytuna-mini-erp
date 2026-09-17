"use client";

import { useState } from "react";
import { PageToolbar } from "@/components/page-toolbar";
import { ProtectedPage } from "@/components/ProtectedPage";
import { FormResultAlert, type FormResult } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { ApiError, createProduct } from "@/lib/api";

export default function NewProductPage() {
  return (
    <ProtectedPage allowedRoles={["admin"]}>
      <NewProductForm />
    </ProtectedPage>
  );
}

function NewProductForm() {
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [marginPercent, setMarginPercent] = useState("");
  const [result, setResult] = useState<FormResult>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setResult(null);

    try {
      const product = await createProduct(name.trim(), sku.trim(), Number(marginPercent));
      setResult({
        type: "success",
        title: "Ürün eklendi",
        message: `${product.name} (${product.sku}). Satış fiyatı ilk stok girişinde otomatik hesaplanacak.`,
      });
      setName("");
      setSku("");
      setMarginPercent("");
    } catch (caught) {
      setResult({
        type: "error",
        title: "Ürün eklenemedi",
        message: caught instanceof ApiError ? caught.message : "Beklenmeyen bir hata oluştu.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <PageToolbar description="Ürün kataloğuna yeni ürün tanımla." />

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Ürün bilgileri</CardTitle>
          <CardDescription>
            Fiyat girilmez: satış fiyatı, depo stok girdikçe ortalama maliyet ve bu marjla otomatik hesaplanır.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="name">Ürün adı</FieldLabel>
                <Input id="name" required maxLength={255} value={name} onChange={(event) => setName(event.target.value)} />
              </Field>

              <Field>
                <FieldLabel htmlFor="sku">SKU</FieldLabel>
                <Input id="sku" required maxLength={50} value={sku} onChange={(event) => setSku(event.target.value)} />
                <FieldDescription>Her ürün için benzersiz stok kodu.</FieldDescription>
              </Field>

              <Field>
                <FieldLabel htmlFor="margin">Kâr marjı (%)</FieldLabel>
                {/* Sınırlar Servis A ile aynı: 0'dan büyük, en fazla 999. */}
                <Input
                  id="margin"
                  type="number"
                  inputMode="decimal"
                  required
                  min="0.01"
                  max="999"
                  step="0.01"
                  value={marginPercent}
                  onChange={(event) => setMarginPercent(event.target.value)}
                />
              </Field>

              <FormResultAlert result={result} />

              <Button type="submit" disabled={submitting} className="w-fit">
                {submitting && <Spinner aria-label="Ekleniyor" />}
                {submitting ? "Ekleniyor…" : "Ürün ekle"}
              </Button>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
