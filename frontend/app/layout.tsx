import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/app-shell";
import { AuthProvider } from "@/components/AuthProvider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

// latin-ext şart: ğ, ş, ı, İ gibi Türkçe harfler bu alt kümede. Olmazsa o harfler
// başka bir fontla çizilir ve yazı yamalı görünür.
const geist = Geist({ subsets: ["latin", "latin-ext"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Mini ERP",
  description: "Sipariş ve stok yönetimi",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" className={cn("font-sans", geist.variable)}>
      <body className="min-h-svh bg-background text-foreground antialiased">
        <AuthProvider>
          <TooltipProvider>
            <AppShell>{children}</AppShell>
          </TooltipProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
