import type { Role } from "./types";

const TOKEN_KEY = "mini-erp-token";

export type Claims = {
  user_id: string;
  role: Role;
  exp: number;
};

type Listener = () => void;
const listeners = new Set<Listener>();

function notify(): void {
  listeners.forEach((listener) => listener());
}

/** React'in useSyncExternalStore'u için abonelik. Başka sekmede çıkış yapılırsa
 *  "storage" olayı sayesinde bu sekme de haberdar olur. */
export function subscribeToken(listener: Listener): () => void {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

/** Sunucuda localStorage yok; ilk render'da her zaman null döneriz. */
export function getServerToken(): null {
  return null;
}

export function saveToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
  notify();
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  notify();
}

/** JWT'nin payload kısmını okur. İmzayı DOĞRULAMAZ — o backend'in işi.
 *  Buradaki tek amaç arayüzde rolü ve süreyi bilmek. */
export function readClaims(token: string): Claims | null {
  try {
    const payload = token.split(".")[1];
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(normalized)) as Claims;
  } catch {
    return null;
  }
}

export function isExpired(claims: Claims): boolean {
  return claims.exp * 1000 <= Date.now();
}
