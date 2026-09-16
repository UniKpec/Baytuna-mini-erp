"use client";

import Link from "next/link";
import { AiSummaryCard } from "@/components/AiSummaryCard";
import { AskBox } from "@/components/AskBox";
import { ProtectedPage } from "@/components/ProtectedPage";
import { useAuth } from "@/components/AuthProvider";
import { ROLE_LABELS } from "@/lib/types";

export default function HomePage() {
  return (
    <ProtectedPage>
      <Ozet />
    </ProtectedPage>
  );
}

function Ozet() {
  const { claims } = useAuth();
  if (!claims) return null;

  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight">Özet</h1>
      <p className="mt-1 text-sm text-slate-500">
        {ROLE_LABELS[claims.role]} olarak giriş yaptın.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Kart
          href="/orders"
          baslik="Siparişler"
          aciklama="Oluşturulmuş siparişleri ve durumlarını gör."
        />
        {claims.role === "sales" && (
          <Kart
            href="/orders/new"
            baslik="Yeni sipariş"
            aciklama="Müşteri ve ürün seçip sipariş oluştur."
          />
        )}
      </div>

      <div className="mt-8 space-y-4">
        <AiSummaryCard />
        <AskBox />
      </div>
    </div>
  );
}

function Kart({ href, baslik, aciklama }: { href: string; baslik: string; aciklama: string }) {
  return (
    <Link
      href={href}
      className="rounded-lg border border-slate-200 bg-white p-5 transition hover:border-slate-400"
    >
      <h2 className="font-medium text-slate-900">{baslik}</h2>
      <p className="mt-1 text-sm text-slate-500">{aciklama}</p>
    </Link>
  );
}
