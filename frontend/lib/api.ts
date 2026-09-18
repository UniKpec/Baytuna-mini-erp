import { SERVICE_A_URL, SERVICE_B_URL } from "./config";
import { clearToken, getToken } from "./auth";
import type {
  CreatedStaffMember,
  Customer,
  DailySummary,
  Order,
  PasswordResetResult,
  Product,
  ReportAnswer,
  StaffMember,
  StaffRole,
  StockMovementResult,
} from "./types";

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
  /** "blob": dosya indirmeleri (PDF) için; hata ve 401 yönetimi JSON isteklerle aynı yoldan geçer. */
  responseType?: "json" | "blob";
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
  const { method = "GET", body, auth = true, responseType = "json" } = options;
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

  if (response.ok && responseType === "blob") {
    return (await response.blob()) as T;
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
    // Token sunucu tarafında geçersizse (süresi doldu, secret değişti) tutmanın anlamı yok;
    // silinince ProtectedPage bunu fark edip giriş ekranına yönlendirir.
    if (response.status === 401 && auth) clearToken();
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

export function createProduct(
  name: string,
  sku: string,
  marginPercent: number
) {
  return serviceA<Product>("/products", {
    method: "POST",
    body: {
      name,
      sku,
      margin_percent: marginPercent,
    },
  });
}

export function createStockMovement(
  productId: string,
  quantity: number,
  unitCost: number
) {
  return serviceA<StockMovementResult>("/stock-movements", {
    method: "POST",
    body: {
      product_id: productId,
      quantity,
      unit_cost: unitCost,
    },
  });
}

export function getDailySummary() {
  return serviceA<DailySummary>("/reports/daily-summary");
}

export function askReport(question: string) {
  return serviceA<ReportAnswer>("/reports/ask", { method: "POST", body: { question } });
}

export function getStaff() {
  return serviceA<StaffMember[]>("/staff");
}

export function createStaff(firstName: string, lastName: string, role: StaffRole, contactEmail: string | null) {
  return serviceA<CreatedStaffMember>("/staff", {
    method: "POST",
    body: { first_name: firstName, last_name: lastName, role, contact_email: contactEmail },
  });
}

export function resetStaffPassword(id: string) {
  return serviceA<PasswordResetResult>(`/staff/${id}/reset-password`, { method: "POST" });
}

// --- Servis B ---

export function getCustomers() {
  return serviceB<Customer[]>("/api/customers");
}

export function createCustomer(
  name: string,
  email: string,
  phone: string
) {
  return serviceB<Customer>("/api/customers", {
    method: "POST",
    body: {
      name,
      email,
      phone,
    },
  });
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

/** Düz bir <a href> JWT gönderemediği için PDF token'la çekilip Blob olarak dönüyor. */
export function downloadInvoicePdf(invoiceId: string) {
  return serviceB<Blob>(`/api/invoices/${invoiceId}/pdf`, { responseType: "blob" });
}
