  # Mini ERP — Detaylı Proje Dokümantasyonu ve Haftalık Plan

**Ekip:** Mehmet (Servis A — FastAPI, Frontend) · Bedirhan (Servis B — .NET, Frontend 4. haftadan itibaren)
**Başlangıç:** 17 Ağustos 2026 (Pazartesi) · **Planlanan Teslim:** 13 Eylül 2026

---

## 1. Bu Projede Ne Yapıyoruz?

### 1.1 Problem ve Çözüm

Küçük-orta ölçekli bir işletmenin sipariş ve stok sürecini gerçek hayattaki gibi üç farklı rolün elinden geçirerek yönetmesini sağlayan bir sistem kuruyoruz: **ürünü kim tanımlıyor, malı kim depoya sokuyor, satışı kim yapıyor** — bu üçü birbirinden ayrı ve birbirini kontrol eden adımlar.

Tek cümleyle senaryo:

> Depocu mal girişini kaydeder (miktar + alış fiyatı) → sistem satış fiyatını otomatik hesaplar → satış personeli müşteri için sipariş oluşturur → sistem stoğu kontrol eder → stok yeterliyse sipariş onaylanır, stok düşer, fatura üretilir, müşteriye mail gider → yeterli değilse sipariş reddedilir, depocuya kritik stok maili gider.

Bu kadar. Kapsam bilinçli olarak dar tutuluyor. Sonradan akla gelen her fikir önce **Ek Özellikler** listesine yazılıyor, yalnızca ana akış zamanından önce bitmişse devreye alınıyor. Bu belgede zaten kapsama dahil edilmiş üç ek özellik var: **PDF fatura, yapay zekâ ile satış yorumlama, e-posta bildirimleri** — bunlar risk/efor dengesi düşük olduğu için ana plana alındı, geri kalan fikirler (RabbitMQ, Redis, Prometheus vb.) bonus listesinde bekliyor.

### 1.2 Neden Bu Şekilde Kurguluyoruz?

**İki backend, iki dil, tek frontend.** Mehmet Python/FastAPI'de, Bedirhan .NET'te güçlü olduğu için sorumluluklar dile göre ayrıldı. Ama kullanıcı tarafında **tek bir Next.js uygulaması** var — iki ayrı frontend yok. Next.js, Caddy üzerinden path'e göre (`/products/*` → Servis A, `/orders/*` → Servis B) her iki backend'e de konuşuyor; kullanıcı hangi isteğin hangi dilde yazılmış servise gittiğini hiç bilmiyor, tek bir uygulama kullanıyormuş gibi hissediyor.

**Üç rol, üç farklı sorumluluk.** Gerçek bir işletmede ürünü tanımlayan kişi (Admin) ile malın fiziksel girişini sayan kişi (Depo) aynı kişi değildir, satışı yapan kişi de (Satış) fiyatı kendi kafasından belirlemez. Bu ayrımı sistemde birebir uyguluyoruz:

- **Admin** yalnızca ürün kataloğunu tanımlar: isim, SKU, kâr marjı yüzdesi. Ne fiyata ne de stok miktarına dokunmaz.
- **Depo** mal girişini kaydeder: hangi üründen kaç adet, ne zaman, adedi kaç liraya alındı. Fiyat girmez, sadece maliyeti kaydeder.
- **Satış** yalnızca sipariş oluşturur, ürünü ve miktarı seçer; sistemin hesapladığı satış fiyatını görür ama hiçbir zaman değiştiremez.

**Satış fiyatı otomatik hesaplanıyor, elle girilmiyor.** Depo her mal girişinde bir alış fiyatı kaydettiğinde, sistem o ürünün **ağırlıklı ortalama maliyetini** günceller ve Admin'in belirlediği kâr marjını uygulayarak satış fiyatını yeniden hesaplar:

```
yeni_ortalama_maliyet = (eski_stok × eski_ortalama_maliyet + yeni_miktar × yeni_birim_fiyat)
                         / (eski_stok + yeni_miktar)

yeni_satış_fiyatı = yeni_ortalama_maliyet × (1 + marj% / 100)
```

Bu yöntem farklı partilerin farklı alış fiyatlarını adil şekilde harmanlıyor (karmaşık FIFO/LIFO'ya gerek kalmadan) ve kâr marjının her satışta garanti altında olmasını sağlıyor — satış personeli fiyatla hiç uğraşmıyor.

**Deploy en başta yapılıyor, sona bırakılmıyor.** Projenin en büyük riski "her şeyi kodladık ama son gün canlıya alamadık" senaryosu. Bunu önlemek için içi boş iki servisi 3. günde (20 Ağustos) canlıya alıyoruz, geri kalan 17 günde içini dolduruyoruz.

### 1.3 Sistem Mimarisi

```
                    Next.js (TEK frontend, Vercel)
                              │  HTTPS
                              ▼
                    ┌───────────────────┐
                    │       Caddy       │   ← VPS üzerinde, HTTPS otomatik
                    └────┬──────────┬───┘
                         │          │   
                         ▼          ▼
                  ┌───────────┐ ┌───────────┐
                  │  Servis A │ │  Servis B │
                  │  FastAPI  │ │   .NET    │
                  │  (Mehmet) │ │(Bedirhan) │
                  └─────┬─────┘ └─────┬─────┘
                        │             │
                   postgres_a    postgres_b
```

**Servis A — FastAPI (Mehmet):** kullanıcı/kimlik doğrulama, JWT üretimi, roller; Admin'in ürün tanımı CRUD'ı; Depo'nun stok girişi ve ortalama maliyet/fiyat hesaplaması; `POST /internal/stock/reserve` (Servis B'nin çağırdığı iç endpoint); yapay zekâ ile satış yorumlama.

**Servis B — .NET (Bedirhan):** müşteri CRUD; sipariş ve sipariş kalemleri; sipariş durum makinesi (`Pending → Confirmed / Rejected`); fatura kaydı ve PDF üretimi; JWT doğrulama (üretmez, sadece doğrular); müşteriye sipariş onay maili.

**Frontend — Next.js:** tek uygulama, hem Servis A'ya hem Servis B'ye konuşur. Mehmet 1. haftadan başlar, Bedirhan 4. haftada katılır.

### 1.4 Nginx Değil Caddy

Reverse proxy olarak **Caddy** kullanılıyor, nginx değil. Caddy, HTTPS sertifikalarını (Let's Encrypt) otomatik alıp yeniliyor — nginx'te bu iş için ayrıca Certbot kurup cron ile yenileme ayarlamak gerekirdi. 20 günlük bir projede bu, ciddi bir zaman tasarrufu.

### 1.5 Rol / Yetki Özeti

| Uç Nokta | Admin | Satış | Depo |
|---|---|---|---|
| Ürün tanımı CRUD (isim, SKU, marj%) | ✓ | — | — |
| Stok girişi (miktar + alış fiyatı) | — | — | ✓ |
| Stok hareketleri geçmişini görme | — | — | ✓ |
| Satış fiyatını görüntüleme | ✓ | ✓ (salt okunur) | ✓ |
| Sipariş oluşturma | — | ✓ | — |
| Günlük özet raporu (AI destekli) | ✓ | ✓ | ✓ |

---

## 2. Teknoloji Yığını

| Katman | Teknoloji | Sorumlu |
|---|---|---|
| Servis A (Backend) | Python 3.12, FastAPI, SQLAlchemy, Alembic, PostgreSQL | Mehmet |
| Servis B (Backend) | .NET 8, ASP.NET Core, Entity Framework Core, PostgreSQL | Bedirhan |
| Frontend | Next.js (App Router), Tailwind CSS, Vercel | Mehmet → Bedirhan (4. hafta) |
| Reverse Proxy / HTTPS | Caddy | Ortak |
| Altyapı | Docker, Docker Compose, Hetzner CX22 VPS | Ortak |
| CI/CD | GitHub Actions, GHCR (container registry) | Ortak |
| Kimlik Doğrulama | JWT (üretim: Servis A, doğrulama: Servis B) | Ortak sözleşme |
| Yapay Zekâ | LLM API — trend analizi + doğal dil soru-cevap | Mehmet |
| PDF Fatura | reportlab / weasyprint (Python) veya QuestPDF (.NET) | Belirlenecek |
| E-posta | SMTP / Resend API | Mehmet & Bedirhan |

---

## 3. Haftalık Detaylı Plan

> Not: Orijinal 20 iş günlük plan hazırlık günleri (14-16 Ağustos) hiç kullanılmadan, doğrudan bugün (17 Ağustos) başlıyor. Hazırlık ve Gün 1 kapsamı birleştirildi, takvim yaklaşık 2 gün kaydı. **Altın kural değişmedi: 3. günde (20 Ağustos) deploy şart.**

### HAFTA 1 — Temel + Canlıya Çıkış (17–21 Ağustos)

Bu haftanın hedefi: **canlıda, HTTPS'li, otomatik deploy edilen iki boş servis.**

#### Gün 1 — Pazartesi 17 Ağustos · Kurulum + İlk API (Hazırlık 1+2 birleşik)

**Birlikte (sabah):**
- GitHub'da `mini-erp` reposu, klasörler: `service-a/`, `service-b/`, `frontend/`, `contracts/`, `infra/`
- Docker Desktop kurulumu, `docker run hello-world`
- Test PR açıp merge etme (git akışını bir kez yaşayın)
- VPS (Hetzner CX22) ve domain satın alma — bugün alınmazsa Gün 3 deploy'u riske girer

**Mehmet:**
- Python 3.12 + `uv`/`venv` kurulumu
- FastAPI tutorial (path/query param, Pydantic body)
- Bellekte `Product` listesi ile `GET/POST/DELETE /products` — Swagger'dan test

**Bedirhan:**
- .NET 8 SDK kurulumu
- Microsoft Learn minimal API tutorial (Controller, DI, `appsettings.json`)
- Aynı CRUD'ı C# `List<Product>` ile yaz, Swagger'dan test

**Gün sonu:** İkisinde de çalışan, bellekte tutulan basit bir CRUD API.

#### Gün 2 — Salı 18 Ağustos · Veritabanı + Tasarım (Hazırlık 3 + Gün 1 birleşik)

**Birlikte (sabah, 2 saat):**
- SQL temelleri: `CREATE TABLE`, `INSERT`, `SELECT`, `WHERE`, `JOIN`, foreign key
- ER diyagramı mantığı, REST tasarım (kaynak isimleri, HTTP metodları, status kodları)

**Mehmet:** SQLAlchemy + Alembic, dünkü API'yi PostgreSQL'e bağlama
**Bedirhan:** Entity Framework Core (`DbContext`, `DbSet`, migrations), aynı şekilde DB'ye bağlama

**Birlikte (öğleden sonra — asıl tasarım işi):**
- `contracts/database.md`: `users`, `products` (marj%, ortalama maliyet, satış fiyatı dahil), `stock_movements` (birim maliyet dahil), `customers`, `orders`, `order_items`, `invoices`
- `contracts/api.md`: her endpoint için yol/metod/örnek JSON/status kodları
- **Rol/yetki tablosunu netleştirin** — kim hangi endpoint'i çağırabilir (bölüm 1.5)
- **JWT sözleşmesi:** secret paylaşımı, algoritma (`HS256`), claim isimleri — bunu bugün netleştirmezseniz ileride saatler kaybedersiniz
- Stok rezervasyonu sözleşmesi: `POST /internal/stock/reserve`, idempotency key (`reservation_id`)
- Stok girişi sözleşmesi: `POST /stock-movements` (Depo'ya özel, `unit_cost` alanı burada)

**Gün sonu:** İki markdown dosyası repoda, ikiniz de onaylamış.

#### Gün 3 — Çarşamba 19 Ağustos · Docker Compose

**Birlikte (2 saat):**
- Dockerfile nedir, image/container farkı
- `docker compose` — servis, port, volume, network, `depends_on`
- Container'lar birbirine servis adıyla erişir (`localhost` değil, `service-a`)

**Uygulama:**
- Mehmet: `service-a/Dockerfile` · Bedirhan: `service-b/Dockerfile`
- Birlikte: `docker-compose.yml` — 2 servis + 2 postgres
- Her serviste `GET /health` → `{"status": "ok"}`

**Gün sonu:** `docker compose up` ile ikisi de ayağa kalkıyor, `/health` cevap veriyor.

#### Gün 4 — Perşembe 20 Ağustos · Sunucu ve Canlıya Çıkış ⭐

**Birlikte (2 saat, ortak bilgi):**
- Linux temel: `cd, ls, cat, nano, systemctl, journalctl`, dosya izinleri
- SSH key ile bağlanma, firewall/port kavramı, DNS ve A kaydı

**Uygulama (Mehmet liderlik eder, Bedirhan ekrana bakar):**
1. VPS'te root olmayan kullanıcı + `sudo` yetkisi
2. SSH key ile giriş, parola girişini kapat
3. `ufw` ile sadece 22, 80, 443 portları
4. `fail2ban` kurulumu
5. Docker + Docker Compose kurulumu
6. Domain A kaydını VPS IP'sine yönlendirme
7. Caddy kurulumu, `Caddyfile` (path bazlı yönlendirme: `/auth/*`, `/products/*` → Servis A; `/orders/*`, `/customers/*` → Servis B)
8. Repoyu sunucuya çekme, `docker compose up -d`

**Gün sonu:** `https://api.domaininiz.com/health` tarayıcıda yeşil kilitle açılıyor. **Bu günü bitirmeden yatmayın — projenin en kritik günü.**

#### Gün 5 — Cuma 21 Ağustos · CI/CD

**Öğrenme (2 saat):** GitHub Actions (workflow, job, step, secret), container registry (GHCR) mantığı

**Uygulama:** `.github/workflows/deploy.yml` — push sonrası otomatik build + deploy

**Gün sonu:** Bir commit push ettiğinizde değişiklik otomatik canlıya yansıyor.

---

### HAFTA 2 — Çekirdek İş Mantığı (24–28 Ağustos)

Bu haftanın hedefi: **roller, fiyatlandırma ve uçtan uca sipariş akışının canlıda çalışması.**

#### Gün 6 — Pazartesi 24 Ağustos · Kullanıcılar ve Roller

**Öğrenme:** Şifre hashleme (bcrypt), JWT üretim/doğrulama akışı, rol bazlı yetkilendirme (RBAC)

**Mehmet:** `users` tablosu migration, kayıt/giriş, JWT üretimi, rol kontrolü (Admin/Satış/Depo middleware)
**Bedirhan:** `customers` tablosu migration, JWT doğrulama entegrasyonu (.NET tarafında)

#### Gün 7 — Salı 25 Ağustos · Ürün Tanımı ve Müşteri CRUD

**Öğrenme:** Girdi doğrulama (validation) — negatif değer, boş alan, geçersiz email nasıl reddedilir

**Mehmet:** `POST/PUT/DELETE /products` — yalnızca Admin. İsim, SKU (benzersiz), marj% (>0). Fiyat/stok alanı **yok**.
**Bedirhan:** `POST /customers`, `GET /customers` — validation ile

#### Gün 8 — Çarşamba 26 Ağustos · Stok Girişi ve Fiyatlandırma

**Öğrenme:** Ağırlıklı ortalama maliyet mantığı, veritabanı transaction'ı neden atomik olmalı

**Mehmet:** `POST /stock-movements` (yalnızca Depo) — miktar + birim alış fiyatı girilir; sistem ortalama maliyeti ve satış fiyatını otomatik günceller (bölüm 1.2'deki formül); her girişte `stock_movements`'a kayıt
**Bedirhan:** `POST /orders` — şimdilik sadece `Pending` olarak kaydediyor, henüz stok kontrolü yok

#### Gün 9 — Perşembe 27 Ağustos · Stok Rezervasyonu

**Öğrenme:** Satır kilidi (`SELECT ... FOR UPDATE`), idempotency key mantığı, .NET'te `HttpClient`/`IHttpClientFactory`

**Mehmet:** `POST /internal/stock/reserve` — tüm kalemler yeterliyse hepsini düş, biri bile yetmiyorsa hiçbirini düşme, 409 dön. Eşzamanlı isteklerde satır kilidi ile stok eksiye düşmesin. `reservation_id` ile aynı isteğin tekrarında stok iki kez düşmesin.
**Bedirhan:** Servis A'ya HTTP çağrısı yapan sınıfı yaz, önce `/health`'i çağırıp bağlantıyı doğrula

#### Gün 10 — Cuma 28 Ağustos · Uçtan Uca Akış + Kritik Stok Maili ⭐

**Öğrenme:** Durum makinesi (state machine) — geçerli/geçersiz geçişler

**Bedirhan (POST /orders akışını tamamla):**
1. Siparişi `Pending` kaydet
2. Servis A'ya `/internal/stock/reserve` çağrısı at
3. 200 → `Confirmed`, fatura oluştur
4. 409 → `Rejected`, sebep kaydet
5. Servis A'ya ulaşılamıyorsa → 503 dön, sipariş `Pending` kalsın (asla `Confirmed` olmasın)

**Mehmet:** Stok düştüğünde eşik kontrolü (< 10 adet) → Depo rolüne kritik stok e-postası tetikleme

**Gün sonu:** Postman'den sipariş atıyorsunuz, doğru fiyattan (otomatik hesaplanmış) düşüyor, fatura oluşuyor, gerekirse mail gidiyor. **Canlıda.** Bu projenin kalbi.

---

### HAFTA 3 — Sağlamlaştırma + Frontend (31 Ağustos – 4 Eylül)

#### Gün 11 — Pazartesi 31 Ağustos · Sağlamlaştırma

- Yapılandırılmış loglama (hangi kullanıcı, hangi endpoint, ne sonuç)
- `.env` yönetimi, asla commit etmeme
- Hata senaryoları testi: geçersiz token, olmayan ürün, stok yetmeyen sipariş, negatif adet
- Seed script: 20 ürün, 5 müşteri, 3 kullanıcı (Admin/Satış/Depo)
- Cron ile günlük `pg_dump` yedekleme

**Gün sonu:** Backend bitti. Yarım kalan varsa hafta sonuna taşımayın, Gün 12'ye sarkmasın.

#### Gün 12 — Salı 1 Eylül · Frontend Başlangıç

**Öğrenme (Bedirhan için ilk ciddi Next.js günü, 3 saat):** React temelleri (component, props, `useState`, `useEffect`), Next.js App Router

**Mehmet:** Next.js projesi kurulumu, Tailwind, layout/navigasyon iskeleti, Vercel'e ilk deploy
**Bedirhan:** Küçük alıştırmalar — sayaç, liste render, form input'u state'e bağlama

#### Gün 13 — Çarşamba 2 Eylül · Login ve Ürün Listesi

**Öğrenme:** `fetch` ile API çağrısı, `async/await`, loading/error yönetimi, CORS

**Mehmet:** Login sayfası, token saklama, korumalı sayfa mantığı, çıkış yap; backend'de CORS ayarı
**Bedirhan:** Ürün listesi sayfası — API'den çekip tabloda satış fiyatıyla gösterir (fiyat salt okunur)

#### Gün 14 — Perşembe 3 Eylül · Sipariş Oluşturma ve Ürün Yönetimi

**Mehmet:** Sipariş oluşturma sayfası — müşteri seç, ürün ekle/çıkar, adet gir, toplam otomatik hesapla, gönder. **Projenin en zor ekranı.**
**Bedirhan:** Admin için ürün ekleme/düzenleme formu (isim, SKU, marj% — fiyat alanı yok) + Depo için stok girişi formu (miktar, alış fiyatı)

#### Gün 15 — Cuma 4 Eylül · Sipariş Listesi ve Müşteri Ekranı

**Mehmet:** Sipariş listesi + detay sayfası, durum rozetleri (Pending sarı / Confirmed yeşil / Rejected kırmızı), fatura detayı
**Bedirhan:** Müşteri listesi + ekleme sayfası

**Gün sonu:** Frontend'den uçtan uca sipariş verilebiliyor.

---

### HAFTA 4 — Ek Özellikler, Cila, Test, Sunum (7–11 Eylül + hafta sonu)

#### Gün 16 — Pazartesi 7 Eylül · Dashboard + AI Trend Özeti

**Bedirhan:** Dashboard — bugünkü sipariş sayısı, ciro, kritik stok uyarısı, son 5 sipariş
**Mehmet:** `GET /reports/daily-summary` endpoint'i — sayısal veriler + son 7 günün trend analizi (LLM API ile: "ciro geçen haftaya göre %X, muhtemel sebep ..."). AI çağrısı başarısız olursa `ai_summary` boş kalır, sayısal veriler yine döner.

#### Gün 17 — Salı 8 Eylül · AI Soru-Cevap + PDF Fatura + E-posta

**Mehmet:** Dashboard'a doğal dil soru kutusu ("bu hafta en çok hangi ürün reddedildi?") — ilgili veri context olarak LLM'e gönderilir
**Bedirhan:** `GET /invoices/{id}/pdf` — mevcut fatura kaydını PDF'e döker (QuestPDF); sipariş `Confirmed` olduğunda müşteriye onay maili (sipariş özeti, toplam, fatura no, PDF eki)

#### Gün 18 — Çarşamba 9 Eylül · Son Ekleme Günü

- Sabah: kalan hataları listele, önceliklendir
- Öğleden sonra, **yalnızca her şey bittiyse**, bonus listesinden biri (sayfalama/arama, refresh token, vb.)
- Bitmediyse bonus yok, mevcut işi bitirin — bu doğru karardır

#### Gün 19 — Perşembe 10 Eylül · Test ve Kapsam Kilidi

- Mehmet: Servis A'ya 5–8 test (stok rezervasyonu, ortalama maliyet hesabı, yetersiz stok 409, JWT geçersiz 401)
- Bedirhan: Servis B'ye 5–8 test (sipariş oluşturma, durum geçişleri, fatura üretimi)
- Manuel test turu: sıfırdan kullanıcı oluştur → giriş yap → Depo mal girsin → Admin ürün tanımlasın → Satış sipariş versin → dashboard'da görün. İki farklı tarayıcıdan, ayrı ayrı.
- **Bu günün sonunda kod donuyor.** Sadece kritik hata düzeltmesi.

#### Gün 20 — Cuma 11 Eylül · Dokümantasyon

- `README.md`: proje amacı, mimari diyagram, teknoloji listesi, kurulum adımları, canlı link, ekran görüntüleri
- Mimari diyagramı çizin (draw.io / Excalidraw)
- Sıfırdan kurulum testi: repoyu boş klasöre klonlayıp yalnızca README'yi takip ederek `docker compose up`
- Kim ne yaptı — katkı tablosu

#### Cumartesi 12 Eylül · Sunum Hazırlığı

**Sunum akışı (10–15 dk):**
1. Problem: neden böyle bir sistem lazım (1 dk)
2. Mimari: neden 2 servis, neden ayrı veritabanı, iki dil nasıl konuşuyor, roller nasıl ayrıldı (3 dk)
3. **Canlı demo** (5 dk): Depo mal girsin → fiyatın otomatik hesaplandığını göster → Satış sipariş versin, stok düştüğünü göster → sonra stok yetmeyen sipariş dene, reddedildiğini göster → AI özetinin buna nasıl tepki verdiğini göster. **İkinci senaryo en etkileyici kısım.**
4. Deploy hattı: push → Actions → canlı (2 dk)
5. Öğrendiklerimiz, zorlandığımız yerler, sonraki adımlar (2 dk)

- Slaytları hazırlayın (10–12 slayt)
- **Demo videosu çekin** — internet çökerse kurtarıcınız
- Herkes kendi yazdığı kısmı anlatsın

#### Pazar 13 Eylül · Prova ve Teslim

- Sabah: baştan sona 2 tam prova, süre tutarak
- Olası sorulara hazırlık:
  - "Neden microservice?" → İki farklı dil, bağımsız deploy, ayrı sorumluluk
  - "Servis A çökerse ne olur?" → Sipariş `Pending` kalır, `Confirmed` olmaz, veri tutarlılığı korunur
  - "Neden ayrı veritabanı?" → Servisler birbirinin tablosuna dokunmaz
  - "Fiyatı kim belirliyor?" → Depo'nun girdiği alış fiyatı + Admin'in marjı, sistem otomatik hesaplıyor, kimse elle giremiyor
  - "Ölçeklenirse ne yaparsınız?" → Kuyruk, cache, replica, K8s
- Canlı sistemin çalıştığını son kez doğrulayın
- Teslim

---

## 4. Altın Kurallar (Değişmedi)

1. Deploy 3. günde yapılır, 20. günde değil.
2. Her akşam 20 dakika birbirinize demo yapın.
3. Her sabah 30 dakika senkron.
4. 2 saat kuralı: bir hataya 2 saatten fazla takılıyorsan diğerine söyle, 4 saat yakma.
5. Kod dondurma gününden sonra yeni özellik yok.
6. Her akşam commit + push, istisna yok.
7. Sözleşme (contract) önce yazılır — `contracts/` klasöründen ikiniz de bakar.

## 5. Riskler ve Önlemler

| Risk | Belirti | Önlem |
|---|---|---|
| Deploy gecikmesi | Gün 4'te (20 Ağustos) canlıya çıkılamaması | Başka her iş durur, deploy bitene kadar odak sadece bu |
| Stok yarış durumu | Eşzamanlı siparişlerde stok eksiye düşmesi | Satır kilidi (`FOR UPDATE`) + idempotency key |
| Fiyat hesaplama hatası | Ortalama maliyet/satış fiyatı yanlış güncellenmesi | Gün 8'de bu mantığa özel birim test yazın, elle birkaç senaryo doğrulayın |
| JSON alan adı uyuşmazlığı | 400/500 hataları | Gün 2'de `snake_case` + JWT sözleşmesi kesinleşir, pazarlık yok |
| Kapsam şişmesi | "Şunu da ekleyelim" | Bonus listesine yazılır, ana akışa dokunulmaz |
| Bedirhan'ın geride kalması | Gün 8'de hâlâ CRUD bitmemesi | Bir gün eşli programlama, Mehmet yönlendirir |
| AI/SMTP entegrasyon sürtünmesi | API anahtarı/SMTP kimlik doğrulama sorunları | Resend gibi düşük sürtünmeli servisler, 30-60 dk pay bırakılır |
| Son gün her şey çöker | Demoda hata | Gün 12'de çekilen demo videosu yedek olarak kullanılır |
