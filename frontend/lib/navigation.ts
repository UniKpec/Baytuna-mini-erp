import {
  CirclePlusIcon,
  LayoutDashboardIcon,
  PackageIcon,
  PackagePlusIcon,
  ShoppingCartIcon,
  UsersIcon,
  WarehouseIcon,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "./types";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Boş bırakılırsa giriş yapmış her rol görür. */
  roles?: Role[];
};

// Rol tablosu: contracts planı bölüm 1.5. Menüdeki filtre yalnızca kolaylık;
// asıl yetki kontrolü backend'de ve ProtectedPage'de yapılıyor.
export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Özet", icon: LayoutDashboardIcon },
  { href: "/products", label: "Ürünler", icon: PackageIcon },
  { href: "/products/new", label: "Ürün Ekle", icon: PackagePlusIcon, roles: ["admin"] },
  { href: "/stock/new", label: "Stok Girişi", icon: WarehouseIcon, roles: ["warehouse"] },
  { href: "/orders", label: "Siparişler", icon: ShoppingCartIcon },
  { href: "/orders/new", label: "Yeni Sipariş", icon: CirclePlusIcon, roles: ["sales"] },
  { href: "/customers", label: "Müşteriler", icon: UsersIcon },
];

// Menüde olmayan sayfalar da başlıkta doğru adla görünsün.
const EXTRA_TITLES: { pattern: RegExp; title: string }[] = [
  { pattern: /^\/orders\/[^/]+$/, title: "Sipariş Detayı" },
  { pattern: /^\/customers\/new$/, title: "Müşteri Ekle" },
];

export function visibleNavItems(role: Role): NavItem[] {
  return NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(role));
}

/** Adrese en uygun menü öğesi: /orders/123 -> Siparişler, /orders/new -> Yeni Sipariş. */
export function activeNavHref(pathname: string, items: NavItem[]): string | undefined {
  return items
    .filter((item) => pathname === item.href || (item.href !== "/" && pathname.startsWith(`${item.href}/`)))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
}

export function pageTitle(pathname: string): string {
  const exact = NAV_ITEMS.find((item) => item.href === pathname);
  if (exact) return exact.label;
  return EXTRA_TITLES.find((entry) => entry.pattern.test(pathname))?.title ?? "Mini ERP";
}
