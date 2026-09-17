"use client";

import { BoxesIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import { LoginForm } from "@/components/login-form";
import { getToken } from "@/lib/auth";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();

  // Zaten giriş yapmışsa giriş ekranında oyalanmasın.
  useEffect(() => {
    if (getToken()) router.replace("/");
  }, [router]);

  async function handleLogin(email: string, password: string) {
    await login(email, password);
    router.replace("/");
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex items-center gap-2 self-center font-medium">
          <div className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <BoxesIcon className="size-4" />
          </div>
          Mini ERP
        </div>
        <LoginForm onLogin={handleLogin} />
      </div>
    </div>
  );
}
