"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PlusIcon, UsersIcon } from "lucide-react";
import { PageToolbar } from "@/components/page-toolbar";
import { ProtectedPage } from "@/components/ProtectedPage";
import { ErrorState, LoadingState } from "@/components/states";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ApiError, getCustomers } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { Customer } from "@/lib/types";

export default function CustomersPage() {
  return (
    <ProtectedPage allowedRoles={["sales", "admin"]}>
      <CustomerList />
    </ProtectedPage>
  );
}

function CustomerList() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCustomers()
      .then((list) => setCustomers([...list].sort((a, b) => a.name.localeCompare(b.name, "tr"))))
      .catch((caught) => setError(caught instanceof ApiError ? caught.message : "Müşteriler yüklenemedi."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <PageToolbar description="Sipariş verilebilecek müşteriler.">
        <Link href="/customers/new" className={buttonVariants()}>
          <PlusIcon />
          Yeni müşteri
        </Link>
      </PageToolbar>

      <CustomerTable customers={customers} loading={loading} error={error} />
    </>
  );
}

function CustomerTable({ customers, loading, error }: { customers: Customer[]; loading: boolean; error: string | null }) {
  if (loading) return <LoadingState />;
  if (error) return <ErrorState title="Müşteriler yüklenemedi" message={error} />;

  if (customers.length === 0) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <UsersIcon />
          </EmptyMedia>
          <EmptyTitle>Henüz müşteri yok</EmptyTitle>
          <EmptyDescription>Sipariş verebilmek için önce bir müşteri eklenmeli.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Link href="/customers/new" className={buttonVariants({ variant: "outline" })}>
            <PlusIcon />
            Müşteri ekle
          </Link>
        </EmptyContent>
      </Empty>
    );
  }

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-4">Ad soyad</TableHead>
            <TableHead>E-posta</TableHead>
            <TableHead>Telefon</TableHead>
            <TableHead className="pr-4 text-right">Kayıt tarihi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {customers.map((customer) => (
            <TableRow key={customer.id}>
              <TableCell className="pl-4 font-medium">{customer.name}</TableCell>
              <TableCell className="text-muted-foreground">{customer.email}</TableCell>
              <TableCell className="text-muted-foreground">{customer.phone || "-"}</TableCell>
              <TableCell className="pr-4 text-right text-muted-foreground">{formatDate(customer.createdAt)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
