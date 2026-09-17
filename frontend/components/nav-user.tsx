"use client";

import { useRouter } from "next/navigation";
import { EllipsisVerticalIcon, LogOutIcon } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { ROLE_LABELS } from "@/lib/types";

export function NavUser() {
  const { claims, logout } = useAuth();
  const { isMobile } = useSidebar();
  const router = useRouter();

  if (!claims) return null;

  // Token'da yalnızca kullanıcı id'si ve rol var; kullanıcıyı rolüyle gösteriyoruz.
  const roleLabel = ROLE_LABELS[claims.role];

  function handleLogout() {
    logout();
    router.replace("/login");
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<SidebarMenuButton size="lg" className="aria-expanded:bg-muted" />}
          >
            <Avatar className="size-8 rounded-lg">
              <AvatarFallback className="rounded-lg">{roleLabel.charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">{roleLabel}</span>
              <span className="truncate text-xs text-foreground/70">Oturum açık</span>
            </div>
            <EllipsisVerticalIcon className="ml-auto size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="min-w-56"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                {roleLabel} olarak giriş yapıldı
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout}>
              <LogOutIcon />
              Çıkış yap
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
