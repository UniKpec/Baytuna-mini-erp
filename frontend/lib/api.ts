import { SERVICE_A_URL, SERVICE_B_URL } from "./config";
import { getToken } from "./auth";
import type { Customer, Order, Product } from "./types";

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

type RequestOptions = {
  method?: string;
  body?: unknown;
  auth?: boolean;
};

/** Backend'in döndürdüğü hata gövdesinden okunabilir bir mesaj çıkarır.
 *  FastAPI {"detail": "..."} döner, ASP.NET düz metin veya ProblemDetails döndürebilir. */
function errorMessage(status: number, body: unknown): string {
  if (typeof body === "string" && body.trim()) return body;
  if (body && typeof body === "object") {
    const record = body as Record<string, unknown>;
    if (typeof record.detail === "string") return record.detail;
    if (typeof record.title === "string") return record.title;
  }
  if (status === 401) return "Oturumun geçersiz, tekrar giriş yap.";
  if (status === 403) return "Bu işlem için yetkin yok.";
  return `Beklenmeyen hata (${status}).`;
}

async function request<T>(baseUrl: string, path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, auth = true } = options;
  const headers: Record<string, string> = {};

  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (auth) {
    const token = getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    // fetch yalnızca ağ seviyesinde patlarsa buraya düşer (servis kapalı, CORS engeli).
    throw new ApiError(0, "Sunucuya ulaşılamıyor. Servis ayakta mı?", null);
  }

  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (!response.ok) {
    throw new ApiError(response.status, errorMessage(response.status, payload), payload);
  }
  return payload as T;
}

const serviceA = <T>(path: string, options?: RequestOptions) => request<T>(SERVICE_A_URL, path, options);
const serviceB = <T>(path: string, options?: RequestOptions) => request<T>(SERVICE_B_URL, path, options);

// --- Servis A ---

export function login(email: string, password: string) {
  return serviceA<{ access_token: string; token_type: string }>("/auth/login", {
    method: "POST",
    body: { email, password },
    auth: false,
  });
}

export function getProducts() {
  return serviceA<Product[]>("/products");
}

// --- Servis B ---

export function getCustomers() {
  return serviceB<Customer[]>("/api/customers");
}

export function createOrder(customerId: string, items: { productId: string; quantity: number }[]) {
  return serviceB<Order>("/api/orders", { method: "POST", body: { customerId, items } });
}

export function getOrders() {
  return serviceB<Order[]>("/api/orders");
}

export function getOrder(id: string) {
  return serviceB<Order>(`/api/orders/${id}`);
}
