import logging
import os
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from decimal import Decimal, ROUND_HALF_UP

import httpx

from mailer import CRITICAL_STOCK_THRESHOLD

logger = logging.getLogger(__name__)

SERVICE_B_URL = os.getenv("SERVICE_B_URL") or "http://service-b:8080"

# Türkiye 2016'dan beri kalıcı olarak UTC+3, yaz saati uygulaması yok.
# zoneinfo yerine sabit fark: Windows'ta ve slim Docker imajlarında tz veritabanı bulunmayabiliyor.
TURKEY_TZ = timezone(timedelta(hours=3))

TOP_LIST_SIZE = 5
RECENT_ORDER_COUNT = 5
MAX_REJECTED_IN_CONTEXT = 50


def fetch_orders(authorization_header: str | None) -> list[dict] | None:
    """Siparişleri Servis B'den çeker. Ulaşılamazsa None döner; özet stok verisiyle yine üretilir."""
    # Kullanıcının token'ını iletiyoruz ki Servis B aynı kimlik ve yetkiyle cevap versin.
    headers = {"Authorization": authorization_header} if authorization_header else {}
    try:
        response = httpx.get(f"{SERVICE_B_URL}/api/orders", headers=headers, timeout=10)
        response.raise_for_status()
        return response.json()
    except httpx.HTTPStatusError as error:
        logger.error("Servis B sipariş listesi hata döndü: %s", error.response.status_code)
    except Exception as error:
        logger.error("Servis B'ye ulaşılamadı: %s", error)
    return None


def parse_timestamp(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    # Servis B zamanları UTC yazıyor; saat dilimi bilgisi gelmezse UTC kabul ediyoruz.
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed


def to_money(value) -> Decimal:
    # Servis B tutarları float gönderiyor; str üzerinden çevirmek 2.1'in 2.1000000000000000888 olmasını engeller.
    return Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _empty_day(day) -> dict:
    return {
        "date": day.isoformat(),
        "order_count": 0,
        "confirmed_count": 0,
        "rejected_count": 0,
        "pending_count": 0,
        "revenue": Decimal("0.00"),
    }


def _week_window(now: datetime):
    today = now.astimezone(TURKEY_TZ).date()
    week_start = today - timedelta(days=6)
    previous_week_start = today - timedelta(days=13)
    return today, week_start, previous_week_start


def build_summary(orders: list[dict] | None, products: list, now: datetime) -> dict:
    today, week_start, previous_week_start = _week_window(now)

    critical_stock = [
        {"id": product.id, "name": product.name, "sku": product.sku, "stock_quantity": product.stock_quantity}
        for product in sorted(products, key=lambda product: product.stock_quantity)
        if product.stock_quantity < CRITICAL_STOCK_THRESHOLD
    ]

    summary = {
        "generated_at": now.isoformat(),
        "orders_available": orders is not None,
        "critical_stock_threshold": CRITICAL_STOCK_THRESHOLD,
        "critical_stock": critical_stock,
        "today": None,
        "last_7_days": [],
        "week": None,
        "recent_orders": [],
        "ai_summary": None,
    }
    if orders is None:
        return summary

    days = {week_start + timedelta(days=offset): _empty_day(week_start + timedelta(days=offset)) for offset in range(7)}
    week_revenue = Decimal("0.00")
    previous_week_revenue = Decimal("0.00")
    week_order_count = 0
    week_rejected_count = 0
    sold = defaultdict(lambda: {"quantity": 0, "revenue": Decimal("0.00")})
    rejected = defaultdict(lambda: {"quantity": 0, "order_ids": set()})
    dated_orders = []

    for order in orders:
        created_at = parse_timestamp(order.get("createdAt"))
        if created_at is None:
            continue
        dated_orders.append((created_at, order))

        local_day = created_at.astimezone(TURKEY_TZ).date()
        status = order.get("status")
        total = to_money(order.get("totalAmount") or 0)

        if previous_week_start <= local_day < week_start:
            if status == "confirmed":
                previous_week_revenue += total
            continue
        if not (week_start <= local_day <= today):
            continue

        day = days[local_day]
        day["order_count"] += 1
        week_order_count += 1

        # Ciroya yalnızca onaylanan siparişler girer: reddedilen ve bekleyen siparişte para el değiştirmedi.
        if status == "confirmed":
            day["confirmed_count"] += 1
            day["revenue"] += total
            week_revenue += total
            for item in order.get("items") or []:
                entry = sold[item.get("productName")]
                entry["quantity"] += item.get("quantity") or 0
                entry["revenue"] += to_money(item.get("lineTotal") or 0)
        elif status == "rejected":
            day["rejected_count"] += 1
            week_rejected_count += 1
            for item in order.get("items") or []:
                entry = rejected[item.get("productName")]
                entry["quantity"] += item.get("quantity") or 0
                entry["order_ids"].add(order.get("id"))
        else:
            day["pending_count"] += 1

    revenue_change_percent = None
    if previous_week_revenue > 0:
        change = (week_revenue - previous_week_revenue) / previous_week_revenue * 100
        revenue_change_percent = float(change.quantize(Decimal("0.1"), rounding=ROUND_HALF_UP))

    top_products = sorted(
        ({"name": name, "quantity": values["quantity"], "revenue": values["revenue"]} for name, values in sold.items()),
        key=lambda entry: entry["quantity"],
        reverse=True,
    )[:TOP_LIST_SIZE]
    top_rejected_products = sorted(
        ({"name": name, "quantity": values["quantity"], "order_count": len(values["order_ids"])} for name, values in rejected.items()),
        key=lambda entry: entry["quantity"],
        reverse=True,
    )[:TOP_LIST_SIZE]

    recent_orders = [
        {
            "id": order.get("id"),
            "customer_name": order.get("customerName"),
            "status": order.get("status"),
            "total_amount": to_money(order.get("totalAmount") or 0),
            "created_at": created_at.isoformat(),
        }
        for created_at, order in sorted(dated_orders, key=lambda pair: pair[0], reverse=True)[:RECENT_ORDER_COUNT]
    ]

    summary["today"] = days[today]
    summary["last_7_days"] = [days[day] for day in sorted(days)]
    summary["week"] = {
        "revenue": week_revenue,
        "previous_week_revenue": previous_week_revenue,
        "revenue_change_percent": revenue_change_percent,
        "order_count": week_order_count,
        "rejected_count": week_rejected_count,
        "top_products": top_products,
        "top_rejected_products": top_rejected_products,
    }
    summary["recent_orders"] = recent_orders
    return summary


def build_question_context(orders: list[dict], products: list, now: datetime) -> dict:
    """Soru-cevap için yapay zekâya gönderilecek veri: özet + haftanın reddedilen siparişleri + ürün kataloğu."""
    summary = build_summary(orders, products, now)
    summary.pop("ai_summary", None)
    today, week_start, _ = _week_window(now)

    week_rejected = []
    for order in orders:
        created_at = parse_timestamp(order.get("createdAt"))
        if created_at is None or order.get("status") != "rejected":
            continue
        if week_start <= created_at.astimezone(TURKEY_TZ).date() <= today:
            week_rejected.append((created_at, order))
    week_rejected.sort(key=lambda pair: pair[0], reverse=True)

    rejected_orders = [
        {
            "date": created_at.astimezone(TURKEY_TZ).isoformat(timespec="minutes"),
            "customer_name": order.get("customerName"),
            "total_amount": to_money(order.get("totalAmount") or 0),
            "reason": order.get("rejectionReason"),
            "items": [{"name": item.get("productName"), "quantity": item.get("quantity")} for item in order.get("items") or []],
        }
        for created_at, order in week_rejected[:MAX_REJECTED_IN_CONTEXT]
    ]

    return {
        "summary": summary,
        "rejected_orders_last_7_days": rejected_orders,
        # Liste kesildiyse modelin "tamamı bu" sanmaması için açıkça belirtiyoruz.
        "rejected_orders_truncated": len(week_rejected) > MAX_REJECTED_IN_CONTEXT,
        "products": [
            {"name": product.name, "sku": product.sku, "sale_price": product.sale_price, "stock_quantity": product.stock_quantity}
            for product in sorted(products, key=lambda product: product.name)
        ],
    }
