"""Gün 16-17: günlük özet ve yapay zekâ soru-cevap."""
import uuid
from datetime import datetime, timezone
from decimal import Decimal

import httpx
import pytest

import ai
import main
from models import Product
from reports import build_question_context, build_summary, parse_timestamp

# İstanbul saatiyle 15 Eylül 2026, 12:00.
NOW = datetime(2026, 9, 15, 9, 0, tzinfo=timezone.utc)


@pytest.fixture(autouse=True)
def ozet_onbellegini_sifirla(monkeypatch):
    # Modül düzeyindeki önbellek testler arasında taşınmasın.
    monkeypatch.setattr(ai, "_summary_cache", {"key": None, "text": None, "created_at": 0.0})


def siparis(status, total, created_at, items=None, reason=None, customer="Baytuna A.Ş."):
    return {
        "id": str(uuid.uuid4()),
        "status": status,
        "totalAmount": total,
        "createdAt": created_at,
        "customerId": str(uuid.uuid4()),
        "customerName": customer,
        "rejectionReason": reason,
        "items": items or [],
        "invoice": None,
    }


def kalem(name, quantity, line_total):
    return {
        "productId": str(uuid.uuid4()),
        "productName": name,
        "quantity": quantity,
        "unitPrice": line_total / quantity,
        "lineTotal": line_total,
    }


def urun(name, sku, stock):
    return Product(
        id=uuid.uuid4(), name=name, sku=sku, margin_percent=Decimal("20"),
        avg_cost=Decimal("10.00"), sale_price=Decimal("12.00"), stock_quantity=stock,
    )


def ornek_siparisler():
    return [
        siparis("confirmed", 100.0, "2026-09-15T08:00:00Z", [kalem("Vida M8", 2, 100.0)]),
        # Servis B'nin gerçekte gönderdiği gibi 5 haneli salise.
        siparis("rejected", 50.0, "2026-09-15T07:00:00.69944Z", [kalem("Somun M8", 10, 50.0)], reason="Yetersiz stok: Somun M8"),
        siparis("pending", 30.0, "2026-09-15T06:00:00Z", [kalem("Pul M8", 3, 30.0)]),
        siparis("confirmed", 200.0, "2026-09-12T10:00:00Z", [kalem("Vida M8", 4, 200.0)]),
        # Geçen hafta (2-8 Eylül): yalnızca karşılaştırma cirosuna girer.
        siparis("confirmed", 150.0, "2026-09-06T10:00:00Z", [kalem("Vida M8", 3, 150.0)]),
        # İki haftadan eski: hiçbir hesaba girmemeli.
        siparis("confirmed", 999.0, "2026-08-20T10:00:00Z", [kalem("Vida M8", 99, 999.0)]),
    ]


def simdi_iso():
    return datetime.now(timezone.utc).isoformat()


# --- reports.py ---


def test_ozet_bugunu_haftayi_ve_gecen_haftayi_dogru_hesaplar():
    urunler = [urun("Matkap Ucu", "MTK-6", 3), urun("Vida M8", "VDA-M8", 50), urun("Havşa Ucu", "HVS-10", 9)]
    ozet = build_summary(ornek_siparisler(), urunler, NOW)

    assert ozet["orders_available"] is True
    assert ozet["today"] == {
        "date": "2026-09-15", "order_count": 3, "confirmed_count": 1,
        "rejected_count": 1, "pending_count": 1, "revenue": Decimal("100.00"),
    }

    hafta = ozet["week"]
    # Ciroya yalnızca onaylananlar girer: 100 + 200. Reddedilen ve bekleyen sayılmaz.
    assert hafta["revenue"] == Decimal("300.00")
    assert hafta["previous_week_revenue"] == Decimal("150.00")
    assert hafta["revenue_change_percent"] == 100.0
    assert hafta["order_count"] == 4
    assert hafta["rejected_count"] == 1
    assert hafta["top_products"][0] == {"name": "Vida M8", "quantity": 6, "revenue": Decimal("300.00")}
    assert hafta["top_rejected_products"][0] == {"name": "Somun M8", "quantity": 10, "order_count": 1}

    assert [gun["date"] for gun in ozet["last_7_days"]] == [f"2026-09-{gun:02d}" for gun in range(9, 16)]
    # Eşiğin altındakiler, en az stoklu önce.
    assert [u["sku"] for u in ozet["critical_stock"]] == ["MTK-6", "HVS-10"]
    assert len(ozet["recent_orders"]) == 5
    assert ozet["recent_orders"][0]["total_amount"] == Decimal("100.00")


def test_gun_sinirini_istanbul_saatine_gore_belirler():
    siparisler = [
        siparis("confirmed", 10.0, "2026-09-14T21:30:00Z"),  # İstanbul 15 Eylül 00:30 -> bugün
        siparis("confirmed", 20.0, "2026-09-14T20:59:00Z"),  # İstanbul 14 Eylül 23:59 -> dün
    ]
    ozet = build_summary(siparisler, [], NOW)

    assert ozet["today"]["revenue"] == Decimal("10.00")
    assert ozet["last_7_days"][-2]["revenue"] == Decimal("20.00")


def test_tarih_ayristirma():
    assert parse_timestamp("2026-09-15T08:00:00").tzinfo == timezone.utc
    assert parse_timestamp("2026-09-09T11:27:18.69944Z") == datetime(2026, 9, 9, 11, 27, 18, 699440, tzinfo=timezone.utc)
    assert parse_timestamp("bozuk") is None
    assert parse_timestamp(None) is None


def test_gecen_hafta_ciro_yoksa_degisim_yuzdesi_bos():
    ozet = build_summary([siparis("confirmed", 100.0, "2026-09-15T08:00:00Z")], [], NOW)
    # Sıfıra bölme yok; yüzde anlamsız olduğu için boş dönüyor.
    assert ozet["week"]["revenue_change_percent"] is None


def test_siparis_verisi_yoksa_stok_bilgisi_yine_doner():
    ozet = build_summary(None, [urun("Matkap Ucu", "MTK-6", 3)], NOW)

    assert ozet["orders_available"] is False
    assert ozet["today"] is None
    assert ozet["week"] is None
    assert ozet["critical_stock"][0]["sku"] == "MTK-6"


def test_soru_baglami_reddedilen_siparisleri_ve_urunleri_icerir():
    baglam = build_question_context(ornek_siparisler(), [urun("Vida M8", "VDA-M8", 50)], NOW)

    assert "ai_summary" not in baglam["summary"]
    assert len(baglam["rejected_orders_last_7_days"]) == 1
    red = baglam["rejected_orders_last_7_days"][0]
    assert red["reason"] == "Yetersiz stok: Somun M8"
    assert red["items"] == [{"name": "Somun M8", "quantity": 10}]
    assert baglam["rejected_orders_truncated"] is False
    assert baglam["products"][0]["sku"] == "VDA-M8"


# --- GET /reports/daily-summary ---


def test_gunluk_ozet_token_ister(client):
    assert client.get("/reports/daily-summary").status_code == 401


def test_gunluk_ozet_tokeni_servis_b_ye_iletir_ve_yorumu_ekler(client, tokens, product, monkeypatch):
    gelen = {}

    def sahte_siparisler(authorization):
        gelen["authorization"] = authorization
        return [siparis("confirmed", 120.0, simdi_iso(), [kalem("Vida M8", 1, 120.0)])]

    monkeypatch.setattr(main, "fetch_orders", sahte_siparisler)
    monkeypatch.setattr(main, "summarize_trends", lambda ozet: "Bu hafta ciro 120 TL.")

    response = client.get("/reports/daily-summary", headers=tokens["warehouse"])

    assert response.status_code == 200
    govde = response.json()
    assert gelen["authorization"] == tokens["warehouse"]["Authorization"]
    assert govde["week"]["revenue"] == 120.0
    assert govde["ai_summary"] == "Bu hafta ciro 120 TL."
    # Fixture ürünün stoğu 5, kritik eşiğin altında.
    assert govde["critical_stock"][0]["sku"] == "VDA-M8"


def test_yapay_zeka_basarisiz_olsa_da_sayilar_doner(client, tokens, monkeypatch):
    monkeypatch.setattr(main, "fetch_orders", lambda authorization: [siparis("confirmed", 80.0, simdi_iso())])
    monkeypatch.setattr(main, "summarize_trends", lambda ozet: None)

    govde = client.get("/reports/daily-summary", headers=tokens["sales"]).json()

    assert govde["week"]["revenue"] == 80.0
    assert govde["ai_summary"] is None


def test_servis_b_kapaliyken_ozet_kismen_doner_ve_yapay_zeka_cagrilmaz(client, tokens, product, monkeypatch):
    def cagrilmamali(ozet):
        raise AssertionError("Sipariş verisi yokken yorum üretilmemeli")

    monkeypatch.setattr(main, "fetch_orders", lambda authorization: None)
    monkeypatch.setattr(main, "summarize_trends", cagrilmamali)

    response = client.get("/reports/daily-summary", headers=tokens["admin"])

    assert response.status_code == 200
    govde = response.json()
    assert govde["orders_available"] is False
    assert govde["ai_summary"] is None
    assert govde["critical_stock"][0]["sku"] == "VDA-M8"


# --- POST /reports/ask ---


def test_soru_dogrulamasi_ve_yetki(client, tokens, monkeypatch):
    monkeypatch.setattr(main, "ai_is_configured", lambda: True)

    assert client.post("/reports/ask", json={"question": "   "}, headers=tokens["admin"]).status_code == 422
    assert client.post("/reports/ask", json={"question": "a" * 501}, headers=tokens["admin"]).status_code == 422
    assert client.post("/reports/ask", json={"question": "Ciro nasıl?"}).status_code == 401


def test_yapay_zeka_yapilandirilmamissa_503_ve_servis_b_cagrilmaz(client, tokens, monkeypatch):
    def cagrilmamali(authorization):
        raise AssertionError("Yapay zekâ kapalıyken Servis B'ye gidilmemeli")

    monkeypatch.setattr(main, "ai_is_configured", lambda: False)
    monkeypatch.setattr(main, "fetch_orders", cagrilmamali)

    response = client.post("/reports/ask", json={"question": "Ciro nasıl?"}, headers=tokens["sales"])
    assert response.status_code == 503


def test_servis_b_kapaliyken_soru_503(client, tokens, monkeypatch):
    monkeypatch.setattr(main, "ai_is_configured", lambda: True)
    monkeypatch.setattr(main, "fetch_orders", lambda authorization: None)

    response = client.post("/reports/ask", json={"question": "Ciro nasıl?"}, headers=tokens["sales"])
    assert response.status_code == 503


def test_soru_cevaplanir_ve_veri_baglami_iletilir(client, tokens, product, monkeypatch):
    gelen = {}

    def sahte_cevap(question, context):
        gelen["question"] = question
        gelen["context"] = context
        return "Bu hafta en çok Vida M8 reddedildi."

    monkeypatch.setattr(main, "ai_is_configured", lambda: True)
    monkeypatch.setattr(
        main, "fetch_orders",
        lambda authorization: [siparis("rejected", 50.0, simdi_iso(), [kalem("Vida M8", 10, 50.0)], reason="Yetersiz stok")],
    )
    monkeypatch.setattr(main, "answer_question", sahte_cevap)

    response = client.post(
        "/reports/ask", json={"question": "  Bu hafta en çok hangi ürün reddedildi?  "}, headers=tokens["sales"],
    )

    assert response.status_code == 200
    assert response.json()["answer"] == "Bu hafta en çok Vida M8 reddedildi."
    assert gelen["question"] == "Bu hafta en çok hangi ürün reddedildi?"
    assert gelen["context"]["products"][0]["sku"] == "VDA-M8"
    assert gelen["context"]["rejected_orders_last_7_days"][0]["reason"] == "Yetersiz stok"


def test_yapay_zeka_yanit_veremezse_503(client, tokens, monkeypatch):
    monkeypatch.setattr(main, "ai_is_configured", lambda: True)
    monkeypatch.setattr(main, "fetch_orders", lambda authorization: [])
    monkeypatch.setattr(main, "answer_question", lambda question, context: None)

    response = client.post("/reports/ask", json={"question": "Ciro nasıl?"}, headers=tokens["sales"])
    assert response.status_code == 503


# --- ai.py (Gemini) ---

GEMINI_ADRESI = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent"


class SahteGemini:
    """httpx.post yerine geçer; verilen sonuçları sırayla döndürür ya da fırlatır."""

    def __init__(self, *sonuclar):
        self.sonuclar = list(sonuclar)
        self.cagrilar = []

    def __call__(self, url, **kwargs):
        self.cagrilar.append({"url": url, **kwargs})
        sonuc = self.sonuclar.pop(0)
        if isinstance(sonuc, Exception):
            raise sonuc
        return sonuc


def gemini_hazirla(monkeypatch, sahte):
    monkeypatch.setenv("GEMINI_API_KEY", "test-anahtari")
    monkeypatch.delenv("GEMINI_MODEL", raising=False)
    monkeypatch.setattr(ai.httpx, "post", sahte)


def yanit(status=200, govde=None, metin=None):
    istek = httpx.Request("POST", GEMINI_ADRESI)
    if metin is not None:
        return httpx.Response(status, text=metin, request=istek)
    return httpx.Response(status, json=govde if govde is not None else {}, request=istek)


def basarili(text, finish_reason="STOP"):
    return yanit(govde={"candidates": [{"content": {"role": "model", "parts": [{"text": text}]}, "finishReason": finish_reason}]})


def test_gemini_istegi_dogru_kurulur_ve_anahtar_url_de_yer_almaz(monkeypatch):
    sahte = SahteGemini(basarili("  Vida M8 en çok reddedilen ürün.  "))
    gemini_hazirla(monkeypatch, sahte)

    assert ai.answer_question("Hangi ürün reddedildi?", {"products": []}) == "Vida M8 en çok reddedilen ürün."

    istek = sahte.cagrilar[0]
    assert istek["url"] == GEMINI_ADRESI
    # Anahtar URL'de olsaydı httpx'in istek logları üzerinden loglara düşerdi.
    assert "test-anahtari" not in istek["url"]
    assert istek["headers"]["x-goog-api-key"] == "test-anahtari"

    govde = istek["json"]
    assert "Türkçe" in govde["systemInstruction"]["parts"][0]["text"]
    assert govde["contents"][0]["role"] == "user"
    metin = govde["contents"][0]["parts"][0]["text"]
    assert "<veri>" in metin and "<soru>" in metin and "Hangi ürün reddedildi?" in metin


def test_model_ortam_degiskeniyle_degistirilebilir(monkeypatch):
    sahte = SahteGemini(basarili("tamam"))
    gemini_hazirla(monkeypatch, sahte)
    monkeypatch.setenv("GEMINI_MODEL", "gemini-3.5-flash-lite")

    ai.answer_question("soru", {})

    assert "/models/gemini-3.5-flash-lite:generateContent" in sahte.cagrilar[0]["url"]


def test_engellenen_istek_none_doner(monkeypatch):
    gemini_hazirla(monkeypatch, SahteGemini(
        yanit(govde={"promptFeedback": {"blockReason": "SAFETY"}}),
        yanit(govde={"candidates": [{"content": {"parts": []}, "finishReason": "SAFETY"}]}),
    ))

    assert ai.answer_question("soru", {}) is None
    assert ai.answer_question("soru", {}) is None


def test_kota_zaman_asimi_baglanti_ve_bozuk_yanit_yutulur(monkeypatch):
    gemini_hazirla(monkeypatch, SahteGemini(
        yanit(status=429, govde={"error": {"code": 429}}),
        yanit(status=400, govde={"error": {"message": "API key not valid"}}),
        httpx.ReadTimeout("zaman aşımı"),
        httpx.ConnectError("bağlantı yok"),
        yanit(metin="json değil"),
        yanit(govde={"candidates": []}),
    ))

    for _ in range(6):
        assert ai.answer_question("soru", {}) is None


def test_token_sinirinda_kesilen_yanit_yine_dondurulur(monkeypatch):
    gemini_hazirla(monkeypatch, SahteGemini(basarili("Kısmi cevap", finish_reason="MAX_TOKENS")))

    assert ai.answer_question("soru", {}) == "Kısmi cevap"


def test_anahtar_yoksa_istek_atilmaz(monkeypatch):
    def cagrilmamali(*args, **kwargs):
        raise AssertionError("Anahtar yokken istek atılmamalı")

    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.setattr(ai.httpx, "post", cagrilmamali)

    assert ai.is_configured() is False
    assert ai.answer_question("soru", {}) is None


def test_ayni_ozet_icin_yorum_onbellekten_gelir(monkeypatch):
    sahte = SahteGemini(basarili("Ciro arttı."))
    gemini_hazirla(monkeypatch, sahte)
    ozet = build_summary(ornek_siparisler(), [], NOW)

    assert ai.summarize_trends(ozet) == "Ciro arttı."
    # generated_at değişse de veri aynıysa yeni istek atılmaz.
    assert ai.summarize_trends(dict(ozet, generated_at="baska-bir-zaman")) == "Ciro arttı."
    assert len(sahte.cagrilar) == 1


def test_basarisiz_yorum_onbellege_alinmaz(monkeypatch):
    sahte = SahteGemini(httpx.ConnectError("bağlantı yok"), basarili("Ciro arttı."))
    gemini_hazirla(monkeypatch, sahte)
    ozet = build_summary(ornek_siparisler(), [], NOW)

    assert ai.summarize_trends(ozet) is None
    assert ai.summarize_trends(ozet) == "Ciro arttı."
    assert len(sahte.cagrilar) == 2
