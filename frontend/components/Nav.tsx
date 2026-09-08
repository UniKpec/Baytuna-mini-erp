"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "./AuthProvider";
import { ROLE_LABELS, type Role } from "@/lib/types";

type NavLink = { href: string; label: string; roles?: Role[] };

// roles boşsa herkese görünür. Rol tablosu: contracts planı bölüm 1.5.
const LINKS: NavLink[] = [
  { href: "/", label: "Özet" },
  { href: "/products", label: "Ürünler" },
  { href: "/orders", label: "Siparişler" },
  { href: "/orders/new", label: "Yeni Sipariş", roles: ["sales"] },
  // Bedirhan'ın kalan ekranları hazır olunca açılacak:
  // { href: "/products/new", label: "Ürün Ekle", roles: ["admin"] },
  // { href: "/stock", label: "Stok Girişi", roles: ["warehouse"] },
  // { href: "/customers", label: "Müşteriler" },
];

export function Nav() {
  const { claims, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  if (!claims) return null;

  const visible = LINKS.filter((link) => !link.roles || link.roles.includes(claims.role));

  function handleLogout() {
    logout();
    router.replace("/login");
  }

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-6 py-3">
        <Link href="/" className="font-semibold tracking-tight text-slate-900">
          Mini ERP
        </Link>

        <nav className="flex flex-1 flex-wrap gap-x-4 gap-y-1 text-sm">
          {visible.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={active ? "font-medium text-slate-900" : "text-slate-500 hover:text-slate-900"}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-600">
          {ROLE_LABELS[claims.role]}
        </span>
        <button
          type="button"
          onClick={handleLogout}
          className="text-sm text-slate-500 underline-offset-2 hover:text-slate-900 hover:underline"
        >
          Çıkış yap
        </button>
      </div>
    </header>
  );
}
