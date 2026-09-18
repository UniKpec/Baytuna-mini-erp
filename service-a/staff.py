import os
import re
import secrets
import unicodedata

# Personelin giriş e-postası bu domain'de üretilir. Bu adresler kullanıcı adıdır, gerçek posta kutusu değil;
# bildirimler kişinin iletişim e-postasına gönderilir.
STAFF_EMAIL_DOMAIN = os.getenv("STAFF_EMAIL_DOMAIN") or "minierp.net.tr"

# Unicode ayrıştırması ı ve İ için doğru sonuç vermiyor ("İ".lower() noktalı i üretir),
# bu yüzden Türkçe harfler önce elle çevriliyor.
_TURKISH_TO_ASCII = str.maketrans({
    "ç": "c", "ğ": "g", "ı": "i", "ö": "o", "ş": "s", "ü": "u",
    "Ç": "c", "Ğ": "g", "İ": "i", "I": "i", "Ö": "o", "Ş": "s", "Ü": "u",
})

# 0/O, 1/l/I gibi birbirine benzeyen karakterler yok: şifre ekrandan okunup elle yazılacak.
_PASSWORD_ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789"
PASSWORD_LENGTH = 12


def _words(text: str) -> list[str]:
    text = text.translate(_TURKISH_TO_ASCII).lower()
    # Diğer aksanlı harfler (é, ñ) ascii karşılığına iner.
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")
    return [word for word in re.split(r"[^a-z0-9]+", text) if word]


def email_local_part(first_name: str, last_name: str) -> str:
    """"Mehmet Akif" + "Akça" -> "mehmet.akif.akca". Harf içermeyen isimde boş döner."""
    return ".".join(_words(first_name) + _words(last_name))


def unique_staff_email(local_part: str, is_taken) -> str:
    """Aynı isimde biri varsa sonuna sayı ekler: ayse.yilmaz, ayse.yilmaz2, ayse.yilmaz3..."""
    candidate = f"{local_part}@{STAFF_EMAIL_DOMAIN}"
    suffix = 2
    while is_taken(candidate):
        candidate = f"{local_part}{suffix}@{STAFF_EMAIL_DOMAIN}"
        suffix += 1
    return candidate


def generate_password() -> str:
    return "".join(secrets.choice(_PASSWORD_ALPHABET) for _ in range(PASSWORD_LENGTH))
