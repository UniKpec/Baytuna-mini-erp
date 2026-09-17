# Mini ERP — Frontend

Next.js (App Router) + Tailwind 4 + TypeScript + [shadcn/ui](https://ui.shadcn.com). Tek uygulama, iki backend'e birden konuşuyor:
Servis A (FastAPI) kimlik doğrulama, ürün/stok ve raporlar; Servis B (.NET) müşteri ve sipariş.

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

Canlıda ikisi de `https://api.minierp.net.tr` adresini gösterir; Caddy yola göre yönlendirir
(`/api/*` Servis B'ye, geri kalanı Servis A'ya).

Servis A'nın `CORS_ORIGINS` değişkeninde ve Servis B'nin `Program.cs` içindeki `WithOrigins`
listesinde frontend adresinin yazılı olması gerekir, yoksa tarayıcı istekleri engeller.

## Deploy (Netlify)

Repo kökündeki `netlify.toml` gerekli ayarları içeriyor. Netlify panelinde ek build ayarı gerekmez.

Panelde **Site configuration → Environment variables** altına eklenmesi gerekenler:

| Değişken | Değer |
|---|---|
| `NEXT_PUBLIC_SERVICE_A_URL` | `https://api.minierp.net.tr` |
| `NEXT_PUBLIC_SERVICE_B_URL` | `https://api.minierp.net.tr` |

`NEXT_PUBLIC_*` değişkenleri **build sırasında** koda gömülür. Değerini sonradan
değiştirirsen yeniden deploy etmen gerekir, sadece kaydetmek yetmez.

## Arayüz bileşenleri (shadcn/ui)

Bileşenler `components/ui/` altında ve projenin parçası; npm paketi değil, gerektiğinde düzenlenebilir.
Yeni bileşen eklemek için:

```bash
npx shadcn@latest add <bileşen-adı>     # örnek: npx shadcn@latest add table dialog
```

Kurulum `base-nova` ön ayarını kullanıyor, yani bileşenlerin altında **Base UI** var (Radix değil).
İnternetteki örneklerin çoğu Radix'e göre yazıldığı için tek önemli fark şu: bir bileşeni başka
bir öğe olarak çizdirmek için `asChild` yok, `render` kullanılıyor.

```tsx
// Radix örneklerinde:  <SidebarMenuButton asChild><Link href="/orders" /></SidebarMenuButton>
<SidebarMenuButton render={<Link href="/orders" />}>Siparişler</SidebarMenuButton>
```

### Yeni sayfa eklerken

1. Sayfayı `app/` altına koy ve içeriğini `ProtectedPage` ile sar (rol kısıtı varsa `allowedRoles`).
2. Menüde görünecekse **yalnızca `lib/navigation.ts` içindeki `NAV_ITEMS`'a ekle**: adres, başlık,
   ikon ve varsa roller. Kenar menü, aktif öğe vurgusu ve üst başlık buradan otomatik oluşur.
   Menüde olmayan bir sayfanın başlığı gerekiyorsa aynı dosyadaki `EXTRA_TITLES`'a ekle.
3. Sayfaya ayrı menü, başlık çubuğu veya dış kenar boşluğu koyma; bunları `AppShell` sağlıyor.
4. Yükleniyor, hata ve form sonucu için `components/states.tsx` içindeki `LoadingState`, `ErrorState` ve
   `FormResultAlert`'i kullan; sayfanın üst satırı için `PageToolbar`. Böylece bütün ekranlar aynı davranır.
5. Renklerde sabit Tailwind renkleri (`slate-500` gibi) yerine tema değişkenlerini kullan:
   `bg-background`, `bg-card`, `text-muted-foreground`, `border`, `text-destructive`.

## Klasör yapısı

```
app/
  layout.tsx             fontlar, oturum sağlayıcı, AppShell
  page.tsx               dashboard: özet kartları, ciro grafiği, kritik stok, son siparişler, yapay zekâ
  login/                 giriş
  products/              ürün listesi · products/new: ürün ekleme (admin)
  stock/new/             stok girişi (depo)
  orders/                sipariş listesi · orders/new: oluşturma · orders/[id]: detay + fatura
  customers/             müşteri listesi · customers/new: ekleme
components/
  app-shell.tsx          kenar menülü ana düzen; giriş ekranında ve oturum yokken devre dışı
  app-sidebar.tsx        kenar menü (logo, menü, kullanıcı)
  nav-main.tsx           role göre menü öğeleri
  nav-user.tsx           kullanıcı alanı ve çıkış
  site-header.tsx        üst başlık, sayfa adı
  login-form.tsx         giriş formu
  AuthProvider.tsx       token saklama, rol, çıkış
  ProtectedPage.tsx      giriş ve rol kontrolü
  page-toolbar.tsx       sayfanın açıklama + eylem butonu satırı
  states.tsx             yükleniyor, hata ve form sonucu durumları
  AiSummaryCard.tsx      yapay zekâ haftalık yorumu
  AskBox.tsx             verilere soru sorma kutusu
  StatusBadge.tsx        pending / confirmed / rejected rozeti
  ui/                    shadcn/ui bileşenleri
hooks/
  use-mobile.ts          mobil ekran algılama (kenar menü kullanıyor)
lib/
  navigation.ts          menü öğeleri, roller, sayfa başlıkları
  api.ts                 iki servise fetch sarmalayıcısı, hata çevirisi
  auth.ts                localStorage token + JWT payload okuma
  types.ts               API tipleri
  format.ts              para ve tarih biçimlendirme
  utils.ts               cn() sınıf birleştirici
```

## Notlar

- Token `localStorage`'da tutuluyor ve süresi dolmuşsa açılışta siliniyor.
- `lib/auth.ts` JWT'yi yalnızca **okur**, imzayı doğrulamaz — doğrulama backend'in işi.
  Buradaki tek amaç arayüzde rolü bilmek.
- Servis A `snake_case`, Servis B `camelCase` döner. `lib/types.ts` ikisini de olduğu gibi yansıtır.
- Lint, `useEffect` içinde doğrudan `setState` çağrısını hata sayıyor (React 19 kuralı).
  Tarayıcıdan okunan değerler (localStorage, ekran genişliği) için `useSyncExternalStore`
  kullanılıyor; örnekler `AuthProvider.tsx` ve `hooks/use-mobile.ts`.
