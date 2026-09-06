"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "./AuthProvider";
import { getToken } from "@/lib/auth";
import { ROLE_LABELS, type Role } from "@/lib/types";

type Props = {
  children: React.ReactNode;
  /** Boş bırakılırsa giriş yapmış her rol görebilir. */
  allowedRoles?: Role[];
};

export function ProtectedPage({ children, allowedRoles }: Props) {
  const { claims } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // localStorage'ı doğrudan okuyoruz: hydration sırasında context henüz
    // dolmamış olabilir, bu kontrol her zaman doğru cevabı verir.
    if (!getToken()) router.replace("/login");
  }, [router]);

  if (!claims) {
    // Token okunana kadar (ya da giriş sayfasına yönlenene kadar) içerik sızmasın.
    return <p className="text-sm text-slate-500">Yükleniyor…</p>;
  }

  if (allowedRoles && !allowedRoles.includes(claims.role)) {
    return (
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-6">
        <h2 className="font-medium text-amber-900">Bu sayfaya erişimin yok</h2>
        <p className="mt-1 text-sm text-amber-800">
          Bu ekran {allowedRoles.map((role) => ROLE_LABELS[role]).join(", ")} rolüne açık. Sen{" "}
          {ROLE_LABELS[claims.role]} olarak giriş yaptın.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
