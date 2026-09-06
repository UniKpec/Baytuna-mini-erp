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
