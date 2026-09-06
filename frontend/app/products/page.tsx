"use client";

import { useState, useEffect } from "react";
import type { Product } from "@/lib/types";
import { ProtectedPage } from "@/components/ProtectedPage";
import { getProducts } from "@/lib/api";

export default function ProductsPage() {
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    useEffect(() => {
        getProducts()
        .then(data => setProducts(data))
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
        <div>
        <h1 className="text-xl font-semibold">Ürünler</h1>

        {products.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">
            Henüz ürün bulunmuyor.
            </p>
        ) : (
            <table className="mt-4 w-full border-collapse">
            <thead>
                <tr>
                <th className="border p-2 text-left">Ürün Adı</th>
                <th className="border p-2 text-left">SKU</th>
                <th className="border p-2 text-left">Satış Fiyatı</th>
                </tr>
            </thead>

            <tbody>
                {products.map(product => (
                <tr key={product.id}>
                    <td className="border p-2">{product.name}</td>
                    <td className="border p-2">{product.sku}</td>
                    <td className="border p-2">
                        {product.sale_price.toLocaleString("tr-TR", {
                            style: "currency",
                            currency: "TRY",
                        })}
                    </td>
                </tr>
                ))}
            </tbody>
            </table>
        )}
        </div>
    </ProtectedPage>
    );
}