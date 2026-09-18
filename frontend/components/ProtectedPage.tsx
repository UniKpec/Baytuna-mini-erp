"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ShieldAlertIcon } from "lucide-react";
import { useAuth } from "./AuthProvider";
import { LoadingState } from "./states";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { ensureValidToken } from "@/lib/auth";
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
    // localStorage'ı doğrudan okuyoruz: hydration sırasında context henüz dolmamış olabilir.
    // Yalnızca "token var mı" değil "geçerli mi" diye bakılıyor; süresi dolmuş token burada silinir.
    // claims bağımlılığı: oturum sayfa açıkken düşerse (API 401 döndü) kontrol yeniden çalışsın.
    if (!ensureValidToken()) router.replace("/login");
  }, [claims, router]);

  if (!claims) {
    // Token okunana kadar (ya da giriş sayfasına yönlenene kadar) içerik sızmasın.
    return <LoadingState />;
  }

  if (allowedRoles && !allowedRoles.includes(claims.role)) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ShieldAlertIcon />
          </EmptyMedia>
          <EmptyTitle>Bu sayfaya erişimin yok</EmptyTitle>
          <EmptyDescription>
            Bu ekran {allowedRoles.map((role) => ROLE_LABELS[role]).join(", ")} rolüne açık. Sen{" "}
            {ROLE_LABELS[claims.role]} olarak giriş yaptın.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return <>{children}</>;
}
