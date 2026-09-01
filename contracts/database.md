# Veritabanı Sözleşmesi (contracts/database.md)

> Bu doküman iki servis arasındaki ortak veri sözleşmesidir. Alan adları, tipleri ve ilişkiler burada netleşir. Değişiklik gerekiyorsa iki taraf da onaylamadan `contracts/` altına merge edilmez.

**Konvansiyon:** Tüm alan adları `snake_case`. Tüm zaman damgaları UTC, `timestamp with time zone`. Tüm id'ler `UUID` (birincil anahtar).

---

## users

Servis A tarafından yönetilir (kimlik doğrulama, JWT üretimi). Servis B sadece JWT içindeki `role` ve `user_id` claim'lerini okur, bu tabloya doğrudan erişmez.

| Alan | Tip | Açıklama |
|---|---|---|
| id | UUID (PK) | |
| email | varchar(255), unique | |
| password_hash | varchar(255) | |
| role | varchar(20) | `admin` \| `sales` \| `warehouse` |
| created_at | timestamptz | |

---

## products

Servis A tarafından yönetilir (Admin CRUD). Servis B, sipariş oluştururken bu tabloyu **salt okunur** olarak kullanır (kendi veritabanında read-only bir kopya/senkron ile ya da Servis A'ya çağrı yaparak — mimari kararı Gün 3-4'te netleşir).

| Alan | Tip | Açıklama |
|---|---|---|
| id | UUID (PK) | |
| name | varchar(255) | |
| sku | varchar(50), unique | |
| margin_percent | numeric(5,2) | Admin'in belirlediği kâr marjı yüzdesi |
| avg_cost | numeric(12,2) | Ağırlıklı ortalama maliyet, her stok girişinde güncellenir |
| sale_price | numeric(12,2) | `avg_cost × (1 + margin_percent / 100)`, sistem hesaplar, kimse elle girmez |
| stock_quantity | integer | Güncel stok adedi |
| created_at | timestamptz | |
| updated_at | timestamptz | |

---

## stock_movements

Servis A tarafından yönetilir (Depo girişi). Her satır bir mal giriş hareketidir, geçmiş asla silinmez/güncellenmez (append-only).

| Alan | Tip | Açıklama |
|---|---|---|
| id | UUID (PK) | |
| product_id | UUID (FK → products.id) | |
| quantity | integer | Girilen miktar |
| unit_cost | numeric(12,2) | Depo'nun girdiği alış fiyatı (birim maliyet) |
| created_by | UUID (FK → users.id) | Girişi yapan Depo kullanıcısı |
| created_at | timestamptz | |

---

## customers

Servis B tarafından yönetilir (Satış CRUD).

| Alan | Tip | Açıklama |
|---|---|---|
| id | UUID (PK) | |
| name | varchar(255) | |
| email | varchar(255) | Sipariş onay maili için |
| phone | varchar(30) | Opsiyonel |
| created_at | timestamptz | |

---

## orders

Servis B tarafından yönetilir. Durum makinesi: `pending → confirmed` veya `pending → rejected`. Geriye geçiş yok.

| Alan | Tip | Açıklama |
|---|---|---|
| id | UUID (PK) | |
| customer_id | UUID (FK → customers.id) | |
| status | varchar(20) | `pending` \| `confirmed` \| `rejected` |
| rejection_reason | varchar(255) | Yalnızca `rejected` durumunda dolu |
| total_amount | numeric(12,2) | Kalemlerin toplamı, sistem hesaplar |
| created_by | UUID (FK → users.id) | Siparişi oluşturan Satış kullanıcısı |
| created_at | timestamptz | |
| updated_at | timestamptz | |

---

## order_items

Servis B tarafından yönetilir. Bir siparişin ürün kalemleri.

| Alan | Tip | Açıklama |
|---|---|---|
| id | UUID (PK) | |
| order_id | UUID (FK → orders.id) | |
| product_id | UUID | Servis A'daki products.id'ye referans (foreign key değil, çünkü ayrı veritabanı — sadece id saklanır) |
| product_name_snapshot | varchar(255) | Sipariş anındaki ürün adı, sonradan ürün adı değişse bile fatura bozulmasın diye |
| quantity | integer | |
| unit_price_snapshot | numeric(12,2) | Sipariş anındaki satış fiyatı, sonradan fiyat değişse bile fatura bozulmasın diye |
| line_total | numeric(12,2) | `quantity × unit_price_snapshot` |

---

## invoices

Servis B tarafından yönetilir. Yalnızca `confirmed` durumundaki siparişler için oluşturulur.

| Alan | Tip | Açıklama |
|---|---|---|
| id | UUID (PK) | |
| order_id | UUID (FK → orders.id), unique | |
| invoice_number | varchar(50), unique | Örn. `INV-2026-0001` |
| total_amount | numeric(12,2) | orders.total_amount ile aynı |
| pdf_path | varchar(500) | Üretilen PDF'in disk/depolama yolu (Gün 17'de doldurulur) |
| created_at | timestamptz | |

---

## İlişki Özeti (ER mantığı)

```
users ──< stock_movements >── products
                                  │
customers ──< orders ──< order_items
                │
                └──1:1── invoices
```

- Bir kullanıcı birden çok stok hareketi girebilir (1:N)
- Bir ürün birden çok stok hareketine sahip olabilir (1:N)
- Bir müşterinin birden çok siparişi olabilir (1:N)
- Bir siparişin birden çok kalemi olabilir (1:N)
- Bir siparişin en fazla bir faturası olabilir (1:1, yalnızca confirmed ise)

## Önemli Notlar

1. **Servis A ve Servis B ayrı veritabanına sahip** (`postgres_a`, `postgres_b`). Bu yüzden `order_items.product_id` gerçek bir foreign key constraint değildir, sadece id değeridir — bütünlük kontrolü uygulama katmanında yapılır.
2. **Snapshot alanları** (`product_name_snapshot`, `unit_price_snapshot`) kasıtlı: ürün bilgisi sonradan değişse bile geçmiş faturalar doğru kalmalı.
3. **Para alanları için `numeric`, asla `float`/`double` kullanılmaz** — yuvarlama hatası riski.
4. Bu dosyada değişiklik gerekiyorsa PR açılır, iki taraf da onaylamadan merge edilmez (bkz. Altın Kural #7).
