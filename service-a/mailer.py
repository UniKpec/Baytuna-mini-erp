import logging
import os
import smtplib
from email.message import EmailMessage

import httpx

logger = logging.getLogger(__name__)

RESEND_API_KEY = os.getenv("RESEND_API_KEY")
# Domain doğrulanana kadar onboarding@resend.dev kullanılabilir,
# ama o adresle sadece Resend hesabının kendi e-postasına gönderim yapılabiliyor.
RESEND_FROM = os.getenv("RESEND_FROM") or "onboarding@resend.dev"
RESEND_URL = "https://api.resend.com/emails"

SMTP_HOST = os.getenv("SMTP_HOST")
# Boş string gelebilir (compose env aktarımı), o yüzden "or" ile varsayılana düşüyoruz.
SMTP_PORT = int(os.getenv("SMTP_PORT") or 587)
SMTP_USER = os.getenv("SMTP_USER")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")
SMTP_FROM = os.getenv("SMTP_FROM") or "mini-erp@localhost"

CRITICAL_STOCK_THRESHOLD = 10


def send_email(to_addresses: list[str], subject: str, body: str) -> None:
    if not to_addresses:
        logger.warning("Alıcı yok, mail gönderilmedi: %s", subject)
        return

    if RESEND_API_KEY:
        send_with_resend(to_addresses, subject, body)
        return

    if SMTP_HOST:
        send_with_smtp(to_addresses, subject, body)
        return

    # Hiçbir sağlayıcı ayarlanmadıysa (yerel geliştirme, CI) mail atlanır, akış bozulmaz.
    logger.info("Mail sağlayıcısı ayarlı değil, mail atlandı: %s -> %s", subject, to_addresses)


def send_with_resend(to_addresses: list[str], subject: str, body: str) -> None:
    try:
        response = httpx.post(
            RESEND_URL,
            headers={"Authorization": f"Bearer {RESEND_API_KEY}"},
            json={"from": RESEND_FROM, "to": to_addresses, "subject": subject, "text": body},
            timeout=10,
        )
        response.raise_for_status()
        logger.info("Mail gönderildi (Resend): %s -> %s", subject, to_addresses)
    except httpx.HTTPStatusError as error:
        # Resend hatanın sebebini gövdede döner, doğrulanmamış domain hatası da burada görünür.
        logger.error("Mail gönderilemedi (Resend): %s (%s %s)", subject, error.response.status_code, error.response.text)
    except Exception as error:
        # Mail gidemezse sipariş akışı bozulmaz, sadece loglanır.
        logger.error("Mail gönderilemedi (Resend): %s (%s)", subject, error)


def send_with_smtp(to_addresses: list[str], subject: str, body: str) -> None:
    message = EmailMessage()
    message["From"] = SMTP_FROM
    message["To"] = ", ".join(to_addresses)
    message["Subject"] = subject
    message.set_content(body)

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10) as server:
            server.starttls()
            if SMTP_USER:
                server.login(SMTP_USER, SMTP_PASSWORD)
            server.send_message(message)
        logger.info("Mail gönderildi (SMTP): %s -> %s", subject, to_addresses)
    except Exception as error:
        logger.error("Mail gönderilemedi (SMTP): %s (%s)", subject, error)


def send_critical_stock_alert(to_addresses: list[str], products: list[dict]) -> None:
    lines = [
        f"- {product['name']} ({product['sku']}): {product['stock_quantity']} adet"
        for product in products
    ]
    body = (
        f"Aşağıdaki ürünlerin stoğu kritik seviyenin ({CRITICAL_STOCK_THRESHOLD} adet) altına düştü:\n\n"
        + "\n".join(lines)
        + "\n\nMal girişi yapılması gerekiyor.\n\nMini ERP"
    )
    send_email(to_addresses, f"Kritik stok uyarısı: {len(products)} ürün", body)
