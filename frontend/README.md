# Mini ERP — Frontend

Next.js (App Router) + Tailwind + TypeScript. Tek uygulama, iki backend'e birden konuşuyor:
Servis A (FastAPI) kimlik doğrulama ve ürün/stok, Servis B (.NET) müşteri ve sipariş.

## Kurulum

```bash
npm install
cp .env.local.example .env.local
npm run dev
```

`http://localhost:3000` açılır. Backend'lerin de ayakta olması gerekir:

```bash
docker compose up -d          # repo kökünde
docker compose exec service-a python seed.py   # demo verisi
```

Seed sonrası giriş bilgileri:

| Rol | E-posta | Şifre |
|---|---|---|
| Admin | admin@baytuna.com | admin123 |
| Satış | satis@baytuna.com | satis123 |
| Depo | depo@baytuna.com | depo123 |

## Ortam değişkenleri

| Değişken | Açıklama |
|---|---|
| `NEXT_PUBLIC_SERVICE_A_URL` | Servis A adresi. Yerelde `http://localhost:8000` |
| `NEXT_PUBLIC_SERVICE_B_URL` | Servis B adresi. Yerelde `http://localhost:8080` |

Canlıda ikisi de Caddy'nin domain'ini gösterir; yönlendirme yola göre yapılır.

Servis A'nın `CORS_ORIGINS` değişkeninde frontend adresinin yazılı olması gerekir,
yoksa tarayıcı istekleri engeller.

## Deploy (Netlify)

Repo kökündeki `netlify.toml` gerekli ayarları içeriyor (`base = "frontend"`).
Netlify panelinde repoyu bağladıktan sonra ek bir build ayarı yapmaya gerek yok.

Panelde **Site configuration → Environment variables** altına eklenmesi gerekenler:

| Değişken | Değer |
|---|---|
| `NEXT_PUBLIC_SERVICE_A_URL` | `https://api.domaininiz.com` |
| `NEXT_PUBLIC_SERVICE_B_URL` | `https://api.domaininiz.com` |

`NEXT_PUBLIC_*` değişkenleri **build sırasında** koda gömülür. Değerini sonradan
değiştirirsen yeniden deploy etmen gerekir, sadece kaydetmek yetmez.

Deploy bittikten sonra Netlify'ın verdiği adresi backend'lerin CORS listesine ekle:
Servis A'da `CORS_ORIGINS`, Servis B'de `Program.cs` içindeki `WithOrigins`.

## Klasör yapısı

```
app/
  layout.tsx           oturum sağlayıcı + navigasyon
  page.tsx             özet
  login/               giriş
  orders/              sipariş listesi
  orders/new/          sipariş oluşturma
  orders/[id]/         sipariş detayı + fatura
components/
  AuthProvider.tsx     token saklama, rol, çıkış
  ProtectedPage.tsx    giriş ve rol kontrolü
  Nav.tsx              role göre navigasyon
  StatusBadge.tsx      pending / confirmed / rejected rozeti
lib/
  api.ts               iki servise fetch sarmalayıcısı, hata çevirisi
  auth.ts              localStorage token + JWT payload okuma
  types.ts             API tipleri
  format.ts            para ve tarih biçimlendirme
```

## Notlar

- Token `localStorage`'da tutuluyor ve süresi dolmuşsa açılışta siliniyor.
- `lib/auth.ts` JWT'yi yalnızca **okur**, imzayı doğrulamaz — doğrulama backend'in işi.
  Buradaki tek amaç arayüzde rolü bilmek.
- Servis A `snake_case`, Servis B `camelCase` döner. `lib/types.ts` ikisini de olduğu gibi yansıtır.
