import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import { Nav } from "@/components/Nav";

export const metadata: Metadata = {
  title: "Mini ERP",
  description: "Sipariş ve stok yönetimi",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        <AuthProvider>
          <Nav />
          <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}
