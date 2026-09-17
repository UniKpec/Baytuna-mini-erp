"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PlusIcon, ShoppingCartIcon } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { PageToolbar } from "@/components/page-toolbar";
import { ProtectedPage } from "@/components/ProtectedPage";
import { ErrorState, LoadingState } from "@/components/states";
import { StatusBadge } from "@/components/StatusBadge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getOrders()
      // En yeni sipariş en üstte.
      .then((list) => setOrders([...list].sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""))))
      .catch((caught) => setError(caught instanceof ApiError ? caught.message : "Siparişler yüklenemedi."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <PageToolbar description="Oluşturulan siparişler ve durumları.">
        {claims?.role === "sales" && (
          <Link href="/orders/new" className={buttonVariants()}>
            <PlusIcon />
            Yeni sipariş
          </Link>
        )}
      </PageToolbar>

      <OrderTable orders={orders} loading={loading} error={error} />
    </>
  );
}

function OrderTable({ orders, loading, error }: { orders: Order[]; loading: boolean; error: string | null }) {
  if (loading) return <LoadingState />;
  if (error) return <ErrorState title="Siparişler yüklenemedi" message={error} />;

  if (orders.length === 0) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ShoppingCartIcon />
          </EmptyMedia>
          <EmptyTitle>Henüz sipariş yok</EmptyTitle>
          <EmptyDescription>Satış ekibi sipariş oluşturduğunda burada listelenecek.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-4">Tarih</TableHead>
            <TableHead>Müşteri</TableHead>
            <TableHead>Durum</TableHead>
            <TableHead className="text-right">Tutar</TableHead>
            <TableHead className="pr-4">
              <span className="sr-only">Detay</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((order) => (
            <TableRow key={order.id}>
              <TableCell className="pl-4 whitespace-nowrap text-muted-foreground">{formatDate(order.createdAt)}</TableCell>
              <TableCell className="font-medium">{order.customerName ?? "-"}</TableCell>
              <TableCell>
                <StatusBadge status={order.status} />
              </TableCell>
              <TableCell className="text-right tabular-nums">{formatMoney(order.totalAmount)}</TableCell>
              <TableCell className="pr-4 text-right">
                <Link href={`/orders/${order.id}`} className={buttonVariants({ variant: "ghost", size: "sm" })}>
                  Detay
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
