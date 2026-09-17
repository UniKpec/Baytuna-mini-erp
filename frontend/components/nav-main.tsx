"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { activeNavHref, visibleNavItems } from "@/lib/navigation";

export function NavMain() {
  const { claims } = useAuth();
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();

  if (!claims) return null;

  const items = visibleNavItems(claims.role);
  const activeHref = activeNavHref(pathname, items);

  // Mobilde menü açılır bir panel; sayfa değişince kendiliğinden kapanmıyor.
  function closeOnMobile() {
    if (isMobile) setOpenMobile(false);
  }

  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton
                tooltip={item.label}
                isActive={item.href === activeHref}
                render={<Link href={item.href} />}
                onClick={closeOnMobile}
              >
                <item.icon />
                <span>{item.label}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
