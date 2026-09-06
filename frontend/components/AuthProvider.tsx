"use client";

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from "react";
import {
  clearToken,
  getServerToken,
  getToken,
  isExpired,
  readClaims,
  saveToken,
  subscribeToken,
  type Claims,
} from "@/lib/auth";
import { login as loginRequest } from "@/lib/api";

type AuthState = {
  claims: Claims | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Token localStorage'da, yani React'in dışında bir kaynakta duruyor.
  // useSyncExternalStore tam olarak bunun için var: sunucuda null, tarayıcıda gerçek değer.
  const token = useSyncExternalStore(subscribeToken, getToken, getServerToken);

  const claims = useMemo(() => {
    if (!token) return null;
    const parsed = readClaims(token);
    // Süresi dolmuş token'ı giriş yapılmış saymıyoruz; her istekte 401 alırdık.
    return parsed && !isExpired(parsed) ? parsed : null;
  }, [token]);

  const login = useCallback(async (email: string, password: string) => {
    const response = await loginRequest(email, password);
    saveToken(response.access_token);
  }, []);

  const logout = useCallback(() => {
    clearToken();
  }, []);

  const value = useMemo(() => ({ claims, login, logout }), [claims, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth yalnızca AuthProvider içinde kullanılabilir.");
  return context;
}
