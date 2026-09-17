export type Role = "admin" | "sales" | "warehouse";

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  sales: "Satış",
  warehouse: "Depo",
};

// Servis A snake_case döner (contracts/database.md).
export type Product = {
  id: string;
  name: string;
  sku: string;
  margin_percent: number;
  avg_cost: number;
  sale_price: number;
  stock_quantity: number;
};

// Servis B camelCase döner (.NET varsayılanı).
export type Customer = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  createdAt: string;
};

export type OrderStatus = "pending" | "confirmed" | "rejected";

export type OrderItem = {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

export type Order = {
  id: string;
  status: OrderStatus;
  totalAmount: number;
  createdBy: string;
  items: OrderItem[];
  rejectionReason?: string | null;
  createdAt?: string;
  customerId?: string;
  customerName?: string;
  invoice?: Invoice | null;
};

export type Invoice = {
  id: string;
  invoiceNumber: string;
  totalAmount: number;
  pdfPath: string | null;
  createdAt: string;
};

// Servis A günlük özet (snake_case). Tutarlar sayı olarak gelir.
export type DailyStat = {
  date: string;
  order_count: number;
  confirmed_count: number;
  rejected_count: number;
  pending_count: number;
  revenue: number;
};

export type DailySummary = {
  generated_at: string;
  orders_available: boolean;
  critical_stock_threshold: number;
  critical_stock: { id: string; name: string; sku: string; stock_quantity: number }[];
  today: DailyStat | null;
  last_7_days: DailyStat[];
  week: {
    revenue: number;
    previous_week_revenue: number;
    revenue_change_percent: number | null;
    order_count: number;
    rejected_count: number;
    top_products: { name: string; quantity: number; revenue: number }[];
    top_rejected_products: { name: string; quantity: number; order_count: number }[];
  } | null;
  recent_orders: {
    id: string;
    customer_name: string | null;
    status: OrderStatus;
    total_amount: number;
    created_at: string;
  }[];
  ai_summary: string | null;
};

export type ReportAnswer = {
  question: string;
  answer: string;
};

// Servis A'daki kritik stok eşiğiyle aynı olmalı (service-a/mailer.py CRITICAL_STOCK_THRESHOLD).
export const CRITICAL_STOCK_THRESHOLD = 10;

// POST /stock-movements cevabı: hareket kaydı ve ürünün güncellenmiş maliyet/fiyat bilgisi.
export type StockMovementResult = {
  id: string;
  product_id: string;
  quantity: number;
  unit_cost: number;
  created_by: string;
  created_at: string;
  product: {
    stock_quantity: number;
    avg_cost: number;
    sale_price: number;
  };
};
