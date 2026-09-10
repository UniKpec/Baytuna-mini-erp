"""Gün 11 — hata senaryoları: geçersiz token, olmayan ürün, yetersiz stok, negatif adet."""
import uuid


def test_gecersiz_token_401(client):
    response = client.get("/products", headers={"Authorization": "Bearer uydurma.token.degeri"})
    assert response.status_code == 401


def test_token_olmadan_erisim_reddedilir(client):
    assert client.get("/products").status_code == 401


def test_yanlis_rol_403(client, tokens):
    # Ürün tanımı yalnızca Admin'in işi, Satış kullanıcısı ekleyemez.
    response = client.post(
        "/products",
        json={"name": "Vida", "sku": "YENI-SKU", "margin_percent": 20},
        headers=tokens["sales"],
    )
    assert response.status_code == 403


def test_olmayan_urun_404(client, tokens):
    response = client.get(f"/products/{uuid.uuid4()}", headers=tokens["admin"])
    assert response.status_code == 404
    assert response.json()["detail"] == "Ürün bulunamadı."


def test_ayni_sku_ikinci_kez_eklenemez(client, tokens, product):
    response = client.post(
        "/products",
        json={"name": "Baska Vida", "sku": product.sku, "margin_percent": 15},
        headers=tokens["admin"],
    )
    assert response.status_code == 400


def test_negatif_adet_stok_girisi_422(client, tokens, product):
    response = client.post(
        "/stock-movements",
        json={"product_id": str(product.id), "quantity": -5, "unit_cost": "10.00"},
        headers=tokens["warehouse"],
    )
    assert response.status_code == 422


def test_sifir_alis_fiyati_422(client, tokens, product):
    response = client.post(
        "/stock-movements",
        json={"product_id": str(product.id), "quantity": 5, "unit_cost": "0"},
        headers=tokens["warehouse"],
    )
    assert response.status_code == 422


def test_yetersiz_stok_409(client, tokens, product, db_session):
    response = client.post(
        "/internal/stock/reserve",
        json={"reservationId": str(uuid.uuid4()), "items": [{"productId": str(product.id), "quantity": 99}]},
        headers=tokens["sales"],
    )
    assert response.status_code == 409
    assert "Yetersiz stok" in response.json()["detail"]
    # Reddedilen rezervasyon stoğa dokunmamalı.
    db_session.refresh(product)
    assert product.stock_quantity == 5


def test_bir_kalem_yetmezse_hicbiri_dusmez(client, tokens, db_session, product):
    from decimal import Decimal
    from models import Product

    ikinci = Product(name="Somun M8", sku="SMN-M8", margin_percent=Decimal("30"),
                     avg_cost=Decimal("10.00"), sale_price=Decimal("13.00"), stock_quantity=50)
    db_session.add(ikinci)
    db_session.commit()

    response = client.post(
        "/internal/stock/reserve",
        json={"reservationId": str(uuid.uuid4()), "items": [
            {"productId": str(ikinci.id), "quantity": 10},
            {"productId": str(product.id), "quantity": 99},
        ]},
        headers=tokens["sales"],
    )
    assert response.status_code == 409

    db_session.refresh(ikinci)
    db_session.refresh(product)
    assert ikinci.stock_quantity == 50
    assert product.stock_quantity == 5


def test_ayni_rezervasyon_stogu_iki_kez_dusurmez(client, tokens, product, db_session):
    govde = {"reservationId": str(uuid.uuid4()), "items": [{"productId": str(product.id), "quantity": 2}]}

    ilk = client.post("/internal/stock/reserve", json=govde, headers=tokens["sales"])
    assert ilk.json()["status"] == "reserved"

    ikinci = client.post("/internal/stock/reserve", json=govde, headers=tokens["sales"])
    assert ikinci.json()["status"] == "already_reserved"

    db_session.refresh(product)
    assert product.stock_quantity == 3


def test_stok_girisi_ortalama_maliyeti_ve_satis_fiyatini_gunceller(client, tokens, product, db_session):
    from decimal import Decimal

    # 5 adet x 100 TL mevcut, üzerine 5 adet x 200 TL giriyor -> ortalama 150, marj %20 -> 180
    response = client.post(
        "/stock-movements",
        json={"product_id": str(product.id), "quantity": 5, "unit_cost": "200.00"},
        headers=tokens["warehouse"],
    )
    assert response.status_code == 200

    db_session.refresh(product)
    assert product.stock_quantity == 10
    assert product.avg_cost == Decimal("150.00")
    assert product.sale_price == Decimal("180.00")


def test_kullanici_olusturmak_admin_yetkisi_ister(client, tokens):
    yeni = {"email": "yeni@test", "password": "sifre123", "role": "admin"}

    assert client.post("/auth/register", json=yeni).status_code == 401
    assert client.post("/auth/register", json=yeni, headers=tokens["sales"]).status_code == 403
    assert client.post("/auth/register", json=yeni, headers=tokens["admin"]).status_code == 200


def test_urun_guncelleme_marj_degisince_satis_fiyatini_yeniden_hesaplar(client, tokens, product, db_session):
    from decimal import Decimal

    # Ortalama maliyet 100 TL; marj %20'den %50'ye çıkınca satış 120'den 150'ye çıkmalı.
    response = client.put(
        f"/products/{product.id}",
        json={"name": "Vida M8 (yeni)", "sku": product.sku, "margin_percent": 50},
        headers=tokens["admin"],
    )
    assert response.status_code == 200

    db_session.refresh(product)
    assert product.name == "Vida M8 (yeni)"
    assert product.sale_price == Decimal("150.00")
    # Maliyet ve stok güncellemeyle değişmemeli, onlar Depo'nun alanı.
    assert product.avg_cost == Decimal("100.00")
    assert product.stock_quantity == 5


def test_urun_guncelleme_baska_urunun_skusunu_alamaz(client, tokens, product, db_session):
    from decimal import Decimal
    from models import Product

    diger = Product(name="Somun", sku="SMN-M8", margin_percent=Decimal("30"),
                    avg_cost=Decimal("10.00"), sale_price=Decimal("13.00"), stock_quantity=1)
    db_session.add(diger)
    db_session.commit()

    response = client.put(
        f"/products/{product.id}",
        json={"name": "Vida", "sku": "SMN-M8", "margin_percent": 20},
        headers=tokens["admin"],
    )
    assert response.status_code == 400


def test_urun_guncelleme_yetki_ve_olmayan_urun(client, tokens, product):
    govde = {"name": "Vida", "sku": product.sku, "margin_percent": 20}

    assert client.put(f"/products/{product.id}", json=govde, headers=tokens["sales"]).status_code == 403
    assert client.put(f"/products/{uuid.uuid4()}", json=govde, headers=tokens["admin"]).status_code == 404
