"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { CircleAlertIcon, PlusIcon, Trash2Icon, TriangleAlertIcon } from "lucide-react";
import { PageToolbar } from "@/components/page-toolbar";
import { ProtectedPage } from "@/components/ProtectedPage";
import { ErrorState, LoadingState } from "@/components/states";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
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
        setCustomers([...customerList].sort((a, b) => a.name.localeCompare(b.name, "tr")));
        setProducts([...productList].sort((a, b) => a.name.localeCompare(b.name, "tr")));
      })
      .catch((caught) => setLoadError(caught instanceof ApiError ? caught.message : "Veriler yüklenemedi."))
      .finally(() => setLoading(false));
  }, []);

  const productsById = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);

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

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
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
        setSubmitError("Servis A'ya ulaşılamıyor. Sipariş beklemede kaldı, stok düşülmedi. Birazdan tekrar dene.");
      } else {
        setSubmitError(caught.message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <LoadingState />;
  if (loadError) return <ErrorState title="Veriler yüklenemedi" message={loadError} />;

  return (
    <>
      <PageToolbar description="Fiyatlar sistem tarafından hesaplanır, elle değiştirilemez." />

      <form onSubmit={handleSubmit} className="flex max-w-3xl flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Müşteri</CardTitle>
          </CardHeader>
          <CardContent>
            <Field>
              <FieldLabel htmlFor="customer" className="sr-only">
                Müşteri
              </FieldLabel>
              <NativeSelect
                id="customer"
                required
                className="w-full"
                value={customerId}
                onChange={(event) => setCustomerId(event.target.value)}
              >
                <NativeSelectOption value="">Müşteri seç…</NativeSelectOption>
                {customers.map((customer) => (
                  <NativeSelectOption key={customer.id} value={customer.id}>
                    {customer.name} — {customer.email}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              {customers.length === 0 && (
                <FieldDescription>
                  Kayıtlı müşteri yok. <Link href="/customers/new">Önce müşteri ekle.</Link>
                </FieldDescription>
              )}
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Kalemler</CardTitle>
            <CardDescription>Aynı ürün tek satırda toplanır; seçilen ürün diğer satırların listesinden çıkar.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {lines.map((line, index) => {
              const product = productsById.get(line.productId);
              const stockShort = product ? line.quantity > product.stock_quantity : false;

              return (
                <div key={index} className="flex flex-col gap-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <NativeSelect
                      aria-label={`Kalem ${index + 1} ürünü`}
                      className="min-w-56 flex-1"
                      value={line.productId}
                      onChange={(event) => updateLine(index, { productId: event.target.value })}
                    >
                      <NativeSelectOption value="">Ürün seç…</NativeSelectOption>
                      {products
                        .filter((item) => item.id === line.productId || !selectedIds.includes(item.id))
                        .map((item) => (
                          <NativeSelectOption key={item.id} value={item.id}>
                            {item.name} ({item.sku}) — {formatMoney(item.sale_price)} · stok {item.stock_quantity}
                          </NativeSelectOption>
                        ))}
                    </NativeSelect>

                    <Input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      aria-label={`Kalem ${index + 1} adedi`}
                      className="w-24"
                      value={line.quantity}
                      onChange={(event) => updateLine(index, { quantity: Math.max(1, Number(event.target.value) || 1) })}
                    />

                    <span className="w-28 text-right text-sm tabular-nums text-muted-foreground">
                      {product ? formatMoney(product.sale_price * line.quantity) : "-"}
                    </span>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Kalem ${index + 1} kaldır`}
                      onClick={() => removeLine(index)}
                      disabled={lines.length === 1}
                    >
                      <Trash2Icon />
                    </Button>
                  </div>

                  {stockShort && (
                    <p className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                      <TriangleAlertIcon className="size-3.5" />
                      Stokta {product?.stock_quantity} adet var, sipariş reddedilebilir.
                    </p>
                  )}
                </div>
              );
            })}

            <Button type="button" variant="outline" size="sm" className="w-fit" onClick={addLine}>
              <PlusIcon />
              Ürün ekle
            </Button>
          </CardContent>
          <CardFooter className="justify-between border-t">
            <span className="text-sm text-muted-foreground">Toplam</span>
            <span className="text-lg font-semibold tabular-nums">{formatMoney(total)}</span>
          </CardFooter>
        </Card>

        {rejected && (
          <Alert variant="destructive">
            <CircleAlertIcon />
            <AlertTitle>Sipariş reddedildi</AlertTitle>
            <AlertDescription>
              {rejected} <Link href="/orders">Sipariş listesine git</Link>
            </AlertDescription>
          </Alert>
        )}

        {submitError && <ErrorState title="Sipariş gönderilemedi" message={submitError} />}

        <Button type="submit" disabled={!canSubmit} className="w-fit">
          {submitting && <Spinner aria-label="Gönderiliyor" />}
          {submitting ? "Gönderiliyor…" : "Siparişi oluştur"}
        </Button>
      </form>
    </>
  );
}
