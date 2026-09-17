"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PackageIcon, PlusIcon } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { PageToolbar } from "@/components/page-toolbar";
import { ProtectedPage } from "@/components/ProtectedPage";
import { ErrorState, LoadingState } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ApiError, getProducts } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import { CRITICAL_STOCK_THRESHOLD, type Product } from "@/lib/types";

export default function ProductsPage() {
  return (
    <ProtectedPage>
      <ProductList />
    </ProtectedPage>
  );
}

function ProductList() {
  const { claims } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getProducts()
      .then((list) => setProducts([...list].sort((a, b) => a.name.localeCompare(b.name, "tr"))))
      .catch((caught) => setError(caught instanceof ApiError ? caught.message : "Ürünler yüklenemedi."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <PageToolbar description="Satış fiyatları ortalama maliyet ve kâr marjından otomatik hesaplanır.">
        {claims?.role === "admin" && (
          <Link href="/products/new" className={buttonVariants()}>
            <PlusIcon />
            Ürün ekle
          </Link>
        )}
      </PageToolbar>

      <ProductTable products={products} loading={loading} error={error} />
    </>
  );
}

function ProductTable({ products, loading, error }: { products: Product[]; loading: boolean; error: string | null }) {
  if (loading) return <LoadingState />;
  if (error) return <ErrorState title="Ürünler yüklenemedi" message={error} />;

  if (products.length === 0) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <PackageIcon />
          </EmptyMedia>
          <EmptyTitle>Henüz ürün yok</EmptyTitle>
          <EmptyDescription>Admin ürün tanımladığında burada listelenecek.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-4">Ürün</TableHead>
            <TableHead>SKU</TableHead>
            <TableHead className="text-right">Stok</TableHead>
            <TableHead className="pr-4 text-right">Satış fiyatı</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.map((product) => (
            <TableRow key={product.id}>
              <TableCell className="pl-4 font-medium">{product.name}</TableCell>
              <TableCell className="font-mono text-xs text-muted-foreground">{product.sku}</TableCell>
              <TableCell className="text-right tabular-nums">
                {product.stock_quantity < CRITICAL_STOCK_THRESHOLD ? (
                  <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400">
                    {product.stock_quantity} · kritik
                  </Badge>
                ) : (
                  product.stock_quantity
                )}
              </TableCell>
              <TableCell className="pr-4 text-right tabular-nums">{formatMoney(product.sale_price)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
