"use client";

import { useEffect, useState } from "react";
import { ProtectedPage } from "@/components/ProtectedPage";
import { getCustomers } from "@/lib/api";
import type { Customer } from "@/lib/types";
import Link from "next/link";

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getCustomers()
      .then(data => setCustomers(data))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
        <ProtectedPage>
        <p>Yükleniyor...</p>
        </ProtectedPage>
    );
    }

    if (error) {
    return (
        <ProtectedPage>
        <p>Hata: {error}</p>
        </ProtectedPage>
    );
    }

  return (
    <ProtectedPage>
        <div className="max-w-5xl">
            <div className="flex items-center justify-between">
                <h1 className="text-xl font-semibold">Müşteriler</h1>

                <Link
                    href="/customers/new"
                    className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white"
                >
                    Yeni Müşteri
                </Link>
            </div>

            {customers.length === 0 ? (
                <p className="mt-4 text-sm text-slate-500">
                Henüz müşteri bulunmuyor.
                </p>
            ) : (
                <table className="mt-4 w-full border-collapse">
                <thead>
                    <tr>
                    <th className="border p-2 text-left">Ad Soyad</th>
                    <th className="border p-2 text-left">E-posta</th>
                    <th className="border p-2 text-left">Telefon</th>
                    </tr>
                </thead>

                <tbody>
                    {customers.map(customer => (
                    <tr key={customer.id}>
                        <td className="border p-2">{customer.name}</td>
                        <td className="border p-2">{customer.email}</td>
                        <td className="border p-2">{customer.phone ?? "-"}</td>
                    </tr>
                    ))}
                </tbody>
                </table>
            )}
        </div>
    </ProtectedPage>
  );
}