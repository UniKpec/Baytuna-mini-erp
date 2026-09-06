"""Demo verisi yükler: 3 kullanıcı (Admin/Satış/Depo) ve 20 ürün.

Kullanım:  python seed.py
Tekrar çalıştırılabilir; zaten var olan kayıtlar atlanır.
"""
import uuid
from decimal import Decimal, ROUND_HALF_UP

from database import sessionLocal
from models import Product, StockMovement, User
from auth import hash_password

USERS = [
    ("admin@baytuna.com", "admin123", "admin"),
    ("satis@baytuna.com", "satis123", "sales"),
    ("depo@baytuna.com", "depo123", "warehouse"),
]

# (isim, sku, marj%, stok adedi, birim alış fiyatı)
# Son üç ürün bilerek 10'un altında: kritik stok maili demoda tetiklenebilsin.
PRODUCTS = [
    ("Vida M8 x 40", "VDA-M8-40", 20, 250, "1.75"),
    ("Vida M10 x 50", "VDA-M10-50", 20, 180, "2.40"),
    ("Somun M8", "SMN-M8", 30, 400, "0.85"),
    ("Somun M10", "SMN-M10", 30, 320, "1.10"),
    ("Pul M8", "PUL-M8", 35, 500, "0.35"),
    ("Rulman 6203", "RLM-6203", 25, 60, "48.00"),
    ("Rulman 6205", "RLM-6205", 25, 45, "62.50"),
    ("Kayış A-42", "KYS-A42", 22, 75, "34.90"),
    ("Kayış B-60", "KYS-B60", 22, 55, "51.00"),
    ("Zincir 08B-1", "ZNC-08B", 18, 90, "27.30"),
    ("Conta 25mm", "CNT-25", 40, 300, "3.20"),
    ("Conta 40mm", "CNT-40", 40, 220, "5.10"),
    ("Yağ Keçesi 30x47", "YKC-3047", 33, 140, "9.75"),
    ("Hidrolik Hortum 1/2", "HDR-12", 28, 40, "112.00"),
    ("Hidrolik Hortum 3/4", "HDR-34", 28, 30, "148.50"),
    ("Elektrot 2.5mm (kg)", "ELK-25", 15, 200, "68.00"),
    ("Kesme Taşı 115mm", "KST-115", 45, 160, "12.40"),
    ("Matkap Ucu 6mm", "MTK-6", 50, 8, "18.90"),
    ("Matkap Ucu 8mm", "MTK-8", 50, 5, "22.60"),
    ("Havşa Ucu 10mm", "HVS-10", 50, 3, "41.00"),
]


def to_money(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def seed():
    db = sessionLocal()
    try:
        depo_user = None
        for email, password, role in USERS:
            user = db.query(User).filter(User.email == email).first()
            if user is None:
                user = User(email=email, hashed_password=hash_password(password), role=role)
                db.add(user)
                db.flush()
                print(f"kullanıcı eklendi: {email} ({role})")
            if role == "warehouse":
                depo_user = user

        eklenen = 0
        for name, sku, margin, quantity, unit_cost in PRODUCTS:
            if db.query(Product).filter(Product.sku == sku).first() is not None:
                continue

            unit_cost = Decimal(unit_cost)
            margin_percent = Decimal(margin)
            product = Product(
                name=name,
                sku=sku,
                margin_percent=margin_percent,
                # Ürün sıfır stokla açıldığı için ortalama maliyet doğrudan alış fiyatına eşit.
                avg_cost=to_money(unit_cost),
                sale_price=to_money(unit_cost * (1 + margin_percent / 100)),
                stock_quantity=quantity,
            )
            db.add(product)
            db.flush()

            # Stok bir yerden gelmiş olmalı: geçmiş boş kalmasın diye giriş hareketini de yazıyoruz.
            db.add(StockMovement(
                product_id=product.id,
                quantity=quantity,
                unit_cost=unit_cost,
                created_by=depo_user.id,
            ))
            eklenen += 1

        db.commit()
        print(f"{eklenen} ürün eklendi, toplam {db.query(Product).count()} ürün var.")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
