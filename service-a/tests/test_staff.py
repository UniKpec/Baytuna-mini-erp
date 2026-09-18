"""Personel yönetimi: otomatik e-posta ve şifre üretimi, admin yetkisi, şifre sıfırlama, bildirim adresi."""
import uuid

import main
from auth import hash_password, read_token_claims
from models import User
from staff import STAFF_EMAIL_DOMAIN, email_local_part, generate_password, unique_staff_email


def personel_ekle(client, tokens, **alanlar):
    govde = {"first_name": "Ayşe", "last_name": "Yılmaz", "role": "warehouse"} | alanlar
    return client.post("/staff", json=govde, headers=tokens["admin"])


# --- staff.py ---


def test_eposta_turkce_harfleri_cevirir():
    assert email_local_part("Şükrü", "Öztürk") == "sukru.ozturk"
    assert email_local_part("İsmail", "Işık") == "ismail.isik"
    assert email_local_part("Mehmet Akif", "Akça") == "mehmet.akif.akca"
    assert email_local_part("Ayşe-Nur", "Çelik") == "ayse.nur.celik"
    assert email_local_part("  José ", "Müller") == "jose.muller"
    assert email_local_part("!!!", "???") == ""


def test_ayni_isim_varsa_sayi_eklenir():
    alinmis = {f"ali.veli@{STAFF_EMAIL_DOMAIN}", f"ali.veli2@{STAFF_EMAIL_DOMAIN}"}

    assert unique_staff_email("ali.veli", alinmis.__contains__) == f"ali.veli3@{STAFF_EMAIL_DOMAIN}"
    assert unique_staff_email("ayse.kaya", alinmis.__contains__) == f"ayse.kaya@{STAFF_EMAIL_DOMAIN}"


def test_sifre_rastgele_ve_karistirilabilir_karakter_icermez():
    sifreler = {generate_password() for _ in range(50)}

    assert len(sifreler) == 50
    for sifre in sifreler:
        assert len(sifre) == 12
        assert not set(sifre) & set("0O1lI")


# --- POST /staff ---


def test_admin_personel_ekler_ve_personel_uretilen_bilgilerle_giris_yapar(client, tokens):
    response = personel_ekle(client, tokens, contact_email="ayse@ornek.com.tr")

    assert response.status_code == 201
    govde = response.json()
    assert govde["email"] == f"ayse.yilmaz@{STAFF_EMAIL_DOMAIN}"
    assert govde["first_name"] == "Ayşe"
    assert govde["role"] == "warehouse"
    assert govde["contact_email"] == "ayse@ornek.com.tr"
    assert len(govde["password"]) == 12
    assert "hashed_password" not in govde

    giris = client.post("/auth/login", json={"email": govde["email"], "password": govde["password"]})
    assert giris.status_code == 200
    assert read_token_claims("Bearer " + giris.json()["access_token"])["role"] == "warehouse"


def test_ayni_isimli_ikinci_personele_farkli_eposta_verilir(client, tokens):
    ilk = personel_ekle(client, tokens).json()
    ikinci = personel_ekle(client, tokens, role="sales").json()

    assert ikinci["email"] == f"ayse.yilmaz2@{STAFF_EMAIL_DOMAIN}"
    assert ilk["password"] != ikinci["password"]


def test_personel_yonetimi_yalnizca_admine_acik(client, tokens):
    govde = {"first_name": "Ali", "last_name": "Veli", "role": "sales"}

    assert client.post("/staff", json=govde).status_code == 401
    assert client.post("/staff", json=govde, headers=tokens["sales"]).status_code == 403
    assert client.post("/staff", json=govde, headers=tokens["warehouse"]).status_code == 403
    assert client.get("/staff", headers=tokens["sales"]).status_code == 403


def test_gecersiz_personel_girdileri(client, tokens):
    # Admin hesabı bu yoldan açılmaz; rol yalnızca satış ya da depo olabilir.
    assert personel_ekle(client, tokens, role="admin").status_code == 422
    assert personel_ekle(client, tokens, role="depo").status_code == 422
    assert personel_ekle(client, tokens, first_name="   ").status_code == 422
    assert personel_ekle(client, tokens, contact_email="gecersiz").status_code == 422
    assert personel_ekle(client, tokens, first_name="!!!", last_name="???").status_code == 400


# --- GET /staff ---


def test_personel_listesi_sifre_bilgisi_icermez(client, tokens):
    personel_ekle(client, tokens)

    liste = client.get("/staff", headers=tokens["admin"]).json()

    assert f"ayse.yilmaz@{STAFF_EMAIL_DOMAIN}" in [personel["email"] for personel in liste]
    for personel in liste:
        assert "hashed_password" not in personel
        assert "password" not in personel


# --- POST /staff/{id}/reset-password ---


def test_sifre_sifirlama_eski_sifreyi_gecersiz_kilar(client, tokens):
    personel = personel_ekle(client, tokens).json()

    sifirlama = client.post(f"/staff/{personel['id']}/reset-password", headers=tokens["admin"])

    assert sifirlama.status_code == 200
    yeni_sifre = sifirlama.json()["password"]
    assert yeni_sifre != personel["password"]
    assert client.post("/auth/login", json={"email": personel["email"], "password": personel["password"]}).status_code == 401
    assert client.post("/auth/login", json={"email": personel["email"], "password": yeni_sifre}).status_code == 200


def test_sifre_sifirlama_sinirlari(client, tokens, users):
    assert client.post(f"/staff/{users['admin'].id}/reset-password", headers=tokens["admin"]).status_code == 400
    assert client.post(f"/staff/{uuid.uuid4()}/reset-password", headers=tokens["admin"]).status_code == 404
    assert client.post(f"/staff/{users['warehouse'].id}/reset-password", headers=tokens["sales"]).status_code == 403


# --- /auth/register doğrulaması ---


def test_kayit_endpointi_rol_eposta_ve_sifreyi_dogrular(client, tokens):
    gecersizler = [
        {"email": "a@ornek.com.tr", "password": "sifre1234", "role": "depo"},
        {"email": "gecersiz", "password": "sifre1234", "role": "sales"},
        {"email": "a@ornek.com.tr", "password": "kisa", "role": "sales"},
    ]
    for govde in gecersizler:
        assert client.post("/auth/register", json=govde, headers=tokens["admin"]).status_code == 422


# --- Kritik stok bildirimi ---


def test_kritik_stok_maili_yalnizca_iletisim_epostasina_gider(client, tokens, product, db_session, monkeypatch):
    db_session.add(User(
        email="depo2@test", hashed_password=hash_password("sifre1234"),
        role="warehouse", contact_email="gercek@ornek.com.tr",
    ))
    db_session.commit()
    gonderilen = {}
    monkeypatch.setattr(main, "send_critical_stock_alert", lambda to, products: gonderilen.update(to=to))

    # Fixture ürünün stoğu 5; 1 adet düşünce 4 kalır, kritik eşiğin (10) altında.
    govde = {"reservationId": str(uuid.uuid4()), "items": [{"productId": str(product.id), "quantity": 1}]}
    response = client.post("/internal/stock/reserve", json=govde, headers=tokens["sales"])

    assert response.status_code == 200
    # users fixture'ındaki depo@test'in iletişim adresi yok: ona mail gitmez, geri dönen mail de olmaz.
    assert gonderilen["to"] == ["gercek@ornek.com.tr"]


# --- DELETE /staff/{id} ---


def test_silinen_personel_giris_yapamaz_ve_listeden_kalkar(client, tokens):
    personel = personel_ekle(client, tokens).json()

    assert client.delete(f"/staff/{personel['id']}", headers=tokens["admin"]).status_code == 204

    giris = client.post("/auth/login", json={"email": personel["email"], "password": personel["password"]})
    assert giris.status_code == 401
    # Silinmiş hesap için de "şifre hatalı" ile aynı mesaj: hesabın var olduğu anlaşılmasın.
    assert giris.json()["detail"] == "Email veya şifre hatalı."
    liste = client.get("/staff", headers=tokens["admin"]).json()
    assert personel["id"] not in [kayit["id"] for kayit in liste]


def test_silinen_personelin_kaydi_ve_stok_gecmisi_korunur(client, tokens, users, product, db_session):
    giris_yapan_depo = users["warehouse"]
    hareket = client.post(
        "/stock-movements",
        json={"product_id": str(product.id), "quantity": 3, "unit_cost": "10.00"},
        headers=tokens["warehouse"],
    )
    assert hareket.status_code in (200, 201)

    assert client.delete(f"/staff/{giris_yapan_depo.id}", headers=tokens["admin"]).status_code == 204

    db_session.expire_all()
    kayit = db_session.get(User, giris_yapan_depo.id)
    assert kayit is not None
    assert kayit.deleted_at is not None


def test_silinen_personelin_adresi_yeni_kisiye_verilmez(client, tokens):
    ilk = personel_ekle(client, tokens).json()
    client.delete(f"/staff/{ilk['id']}", headers=tokens["admin"])

    yeni = personel_ekle(client, tokens).json()

    assert yeni["email"] == f"ayse.yilmaz2@{STAFF_EMAIL_DOMAIN}"


def test_personel_silme_sinirlari(client, tokens, users):
    personel = personel_ekle(client, tokens).json()

    assert client.delete(f"/staff/{personel['id']}").status_code == 401
    assert client.delete(f"/staff/{personel['id']}", headers=tokens["sales"]).status_code == 403
    assert client.delete(f"/staff/{users['admin'].id}", headers=tokens["admin"]).status_code == 400
    assert client.delete(f"/staff/{uuid.uuid4()}", headers=tokens["admin"]).status_code == 404

    assert client.delete(f"/staff/{personel['id']}", headers=tokens["admin"]).status_code == 204
    # İkinci silme ve silinmiş kişinin şifresini sıfırlama: kayıt artık "yok" sayılır.
    assert client.delete(f"/staff/{personel['id']}", headers=tokens["admin"]).status_code == 404
    assert client.post(f"/staff/{personel['id']}/reset-password", headers=tokens["admin"]).status_code == 404


def test_silinen_depo_personeline_kritik_stok_maili_gitmez(client, tokens, product, monkeypatch):
    personel = personel_ekle(client, tokens, contact_email="eski@ornek.com.tr").json()
    client.delete(f"/staff/{personel['id']}", headers=tokens["admin"])
    gonderilen = {}
    monkeypatch.setattr(main, "send_critical_stock_alert", lambda to, products: gonderilen.update(to=to))

    govde = {"reservationId": str(uuid.uuid4()), "items": [{"productId": str(product.id), "quantity": 1}]}
    assert client.post("/internal/stock/reserve", json=govde, headers=tokens["sales"]).status_code == 200

    assert "eski@ornek.com.tr" not in gonderilen.get("to", [])
