import logging
import os
import time
import uuid
from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Annotated, Literal
from fastapi import BackgroundTasks, FastAPI, HTTPException, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from pydantic import BaseModel, EmailStr, Field, StringConstraints

from database import get_db
from models import Product as ProductModel, User as UserModel, StockMovement as StockMovementModel, StockReservation as StockReservationModel
from auth import verify_password, create_access_token, hash_password, require_admin, require_warehouse, require_sales, get_current_user, read_token_claims
from mailer import send_critical_stock_alert, CRITICAL_STOCK_THRESHOLD
from logging_setup import setup_logging
from reports import fetch_orders, build_summary, build_question_context
from ai import summarize_trends, answer_question, is_configured as ai_is_configured
from staff import email_local_part, generate_password, unique_staff_email

setup_logging()
logger = logging.getLogger("service-a")

app = FastAPI()


@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Her isteği tek satır JSON olarak loglar: kim, hangi endpoint, ne sonuç, ne kadar sürdü."""
    started_at = time.perf_counter()
    response = await call_next(request)
    duration_ms = round((time.perf_counter() - started_at) * 1000, 1)

    # Token geçersizse bile log düşsün diye claim'leri en iyi çabayla okuyoruz.
    claims = read_token_claims(request.headers.get("authorization"))

    logger.info(
        "istek",
        extra={
            "method": request.method,
            "path": request.url.path,
            "status": response.status_code,
            "user_id": claims.get("user_id"),
            "role": claims.get("role"),
            "duration_ms": duration_ms,
        },
    )
    return response


# Frontend ayrı bir origin'den geliyor (yerelde Next.js :3000, canlıda Vercel).
# Adresler .env'den okunuyor ki Vercel URL'i değiştiğinde kod değişmesin.
allowed_origins = [origin.strip() for origin in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class Product(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    sku: str = Field(min_length=1, max_length=50)
    margin_percent: Decimal = Field(gt=0, le=999)


class StockMovementCreate(BaseModel):
    product_id: uuid.UUID
    quantity: int = Field(gt=0)
    unit_cost: Decimal = Field(gt=0)


# Servis B ile sözleşme: iç rezervasyon endpoint'inin gövdesi camelCase.
class StockReserveItem(BaseModel):
    product_id: uuid.UUID = Field(alias="productId")
    quantity: int = Field(gt=0)


class StockReserveRequest(BaseModel):
    reservation_id: uuid.UUID = Field(alias="reservationId")
    items: list[StockReserveItem] = Field(min_length=1)


class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    # Serbest metin olsaydı "depo" ya da "Warehouse" gibi bir rolle hesap açılır,
    # frontend rolü tanımadığı için arayüz çökerdi.
    role: Literal["admin", "sales", "warehouse"]


PersonName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]


class StaffCreate(BaseModel):
    first_name: PersonName
    last_name: PersonName
    # Personel ekranından yalnızca satış ve depo eklenir; admin hesabı bu yoldan açılmaz.
    role: Literal["sales", "warehouse"]
    # Kritik stok gibi bildirimler bu adrese gider; boşsa kişiye mail gönderilmez.
    contact_email: EmailStr | None = None


class UserLogin(BaseModel):
    email: str
    password: str


class ReportQuestion(BaseModel):
    # Boşluklar kırpılıyor ki "   " geçerli bir soru sayılmasın; üst sınır maliyeti ve kötüye kullanımı sınırlıyor.
    question: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=500)]


def to_money(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/products")
def get_products(db: Session = Depends(get_db), current_user: dict=Depends(get_current_user)):
    return db.query(ProductModel).all()


@app.post("/products")
def create_product(product: Product, db: Session = Depends(get_db), current_user: dict = Depends(require_admin)):
    existing_product = db.query(ProductModel).filter(ProductModel.sku == product.sku).first()
    if existing_product is not None:
        raise HTTPException(status_code=400, detail="Bu SKU zaten kayıtlı.")

    new_product = ProductModel(name=product.name, sku=product.sku, margin_percent=product.margin_percent)
    db.add(new_product)
    db.commit()
    db.refresh(new_product)
    return new_product


@app.get("/products/{product_id}")
def get_product_id(product_id: uuid.UUID, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    product = db.query(ProductModel).filter(ProductModel.id == product_id).first()
    if product is None:
        raise HTTPException(status_code=404, detail="Ürün bulunamadı.")
    return product

@app.put("/products/{product_id}")
def update_product(product_id: uuid.UUID, product: Product, db: Session = Depends(get_db), current_user: dict = Depends(require_admin)):
    existing_product = db.query(ProductModel).filter(ProductModel.id == product_id).first()
    if existing_product is None:
        raise HTTPException(status_code=404, detail="Ürün bulunamadı.")

    # SKU başka bir ürüne aitse reddet; ürünün kendi SKU'sunu koruyarak güncellenmesine izin ver.
    sku_owner = db.query(ProductModel).filter(ProductModel.sku == product.sku, ProductModel.id != product_id).first()
    if sku_owner is not None:
        raise HTTPException(status_code=400, detail="Bu SKU zaten kayıtlı.")

    existing_product.name = product.name
    existing_product.sku = product.sku
    existing_product.margin_percent = product.margin_percent
    # Marj değişince satış fiyatı da değişmeli: fiyat elle girilmez, ortalama maliyetten hesaplanır.
    existing_product.sale_price = to_money(existing_product.avg_cost * (1 + product.margin_percent / 100))
    existing_product.updated_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(existing_product)
    return existing_product


@app.delete("/products/{product_id}")
def delete_product(product_id: uuid.UUID, db: Session = Depends(get_db), current_user: dict = Depends(require_admin)):
    product = db.query(ProductModel).filter(ProductModel.id == product_id).first()
    if product is None:
        raise HTTPException(status_code=404, detail="Ürün bulunamadı.")
    db.delete(product)
    db.commit()
    return {"message": "Ürün silindi."}


@app.post("/stock-movements")
def create_stock_movement(movement: StockMovementCreate, db: Session = Depends(get_db), current_user: dict = Depends(require_warehouse)):
    # Satır kilidi: aynı ürüne eşzamanlı iki giriş gelirse ortalama maliyet yanlış hesaplanmasın.
    product = db.query(ProductModel).filter(ProductModel.id == movement.product_id).with_for_update().first()
    if product is None:
        raise HTTPException(status_code=404, detail="Ürün bulunamadı.")

    old_quantity = product.stock_quantity
    old_avg_cost = product.avg_cost
    new_quantity = old_quantity + movement.quantity

    # Ağırlıklı ortalama maliyet:
    # (eski stok × eski ortalama maliyet + yeni miktar × yeni birim fiyat) / (eski stok + yeni miktar)
    total_cost = (old_quantity * old_avg_cost) + (movement.quantity * movement.unit_cost)
    new_avg_cost = to_money(total_cost / new_quantity)
    # Satış fiyatı elle girilmez, marj uygulanarak sistem hesaplar.
    new_sale_price = to_money(new_avg_cost * (1 + product.margin_percent / 100))

    product.stock_quantity = new_quantity
    product.avg_cost = new_avg_cost
    product.sale_price = new_sale_price
    product.updated_at = datetime.now(timezone.utc)

    new_movement = StockMovementModel(
        product_id=product.id,
        quantity=movement.quantity,
        unit_cost=movement.unit_cost,
        created_by=uuid.UUID(current_user.get("user_id")),
    )
    db.add(new_movement)
    # Ürün güncellemesi ile hareket kaydı tek transaction'da yazılır:
    # biri başarısız olursa ikisi de yazılmaz, stok ile geçmiş asla ayrışmaz.
    db.commit()
    db.refresh(new_movement)
    db.refresh(product)

    return {
        "id": new_movement.id,
        "product_id": new_movement.product_id,
        "quantity": new_movement.quantity,
        "unit_cost": new_movement.unit_cost,
        "created_by": new_movement.created_by,
        "created_at": new_movement.created_at,
        "product": {
            "stock_quantity": product.stock_quantity,
            "avg_cost": product.avg_cost,
            "sale_price": product.sale_price,
        },
    }


@app.get("/stock-movements")
def get_stock_movements(product_id: uuid.UUID | None = None, db: Session = Depends(get_db), current_user: dict = Depends(require_warehouse)):
    query = db.query(StockMovementModel)
    if product_id is not None:
        query = query.filter(StockMovementModel.product_id == product_id)
    return query.order_by(StockMovementModel.created_at.desc()).all()


@app.post("/internal/stock/reserve")
def reserve_stock(reservation: StockReserveRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db), current_user: dict = Depends(require_sales)):
    # Idempotency: aynı reservation_id ikinci kez gelirse stok tekrar düşmez.
    existing_reservation = db.query(StockReservationModel).filter(StockReservationModel.reservation_id == reservation.reservation_id).first()
    if existing_reservation is not None:
        return {"status": "already_reserved", "reservationId": existing_reservation.reservation_id}

    # Aynı üründen birden fazla kalem geldiyse tek satırda topluyoruz.
    requested = {}
    for item in reservation.items:
        requested[item.product_id] = requested.get(item.product_id, 0) + item.quantity

    # Satır kilidi: ürünler hep aynı sırada (id) kilitlenir ki eşzamanlı siparişler birbirini deadlock'a sokmasın.
    products = (
        db.query(ProductModel)
        .filter(ProductModel.id.in_(list(requested.keys())))
        .order_by(ProductModel.id)
        .with_for_update()
        .all()
    )
    products_by_id = {product.id: product for product in products}

    # Önce hepsini kontrol et: biri bile yetmiyorsa hiçbirini düşmüyoruz.
    for product_id, quantity in requested.items():
        product = products_by_id.get(product_id)
        if product is None:
            raise HTTPException(status_code=404, detail=f"Ürün bulunamadı: {product_id}")
        if product.stock_quantity < quantity:
            raise HTTPException(
                status_code=409,
                detail=f"Yetersiz stok: {product.name} (istenen {quantity}, mevcut {product.stock_quantity})",
            )

    for product_id, quantity in requested.items():
        product = products_by_id[product_id]
        product.stock_quantity = product.stock_quantity - quantity
        product.updated_at = datetime.now(timezone.utc)

    db.add(StockReservationModel(reservation_id=reservation.reservation_id))
    try:
        # Tüm stok düşümleri ve rezervasyon kaydı tek transaction'da yazılır.
        db.commit()
    except IntegrityError:
        # Aynı rezervasyon tam aynı anda iki kez geldiyse ikincisi unique kısıtta elenir, stok tek kez düşer.
        db.rollback()
        return {"status": "already_reserved", "reservationId": reservation.reservation_id}

    # Stok düştü: kritik eşiğin altına inen ürünler için Depo'ya uyarı maili tetiklenir.
    # Mail arka planda gidiyor, sipariş cevabını bekletmesin ve mail hatası siparişi düşürmesin.
    critical_products = [
        {"name": product.name, "sku": product.sku, "stock_quantity": product.stock_quantity}
        for product in products_by_id.values()
        if product.stock_quantity < CRITICAL_STOCK_THRESHOLD
    ]
    if critical_products:
        warehouse_users = db.query(UserModel).filter(UserModel.role == "warehouse").all()
        # Giriş e-postaları otomatik üretilen kullanıcı adları, gerçek posta kutusu değil; oraya giden mail
        # geri döner ve Resend hesabının itibarını düşürür. Bildirim yalnızca iletişim e-postasına gider.
        warehouse_emails = [user.contact_email for user in warehouse_users if user.contact_email]
        background_tasks.add_task(send_critical_stock_alert, warehouse_emails, critical_products)

    return {
        "status": "reserved",
        "reservationId": reservation.reservation_id,
        "items": [
            {
                "productId": product_id,
                "quantity": quantity,
                "remainingStock": products_by_id[product_id].stock_quantity,
            }
            for product_id, quantity in requested.items()
        ],
    }


@app.get("/reports/daily-summary")
def daily_summary(request: Request, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    # Sipariş verisi Servis B'de; stok verisi burada. İkisini birleştirip tek özet dönüyoruz.
    orders = fetch_orders(request.headers.get("authorization"))
    products = db.query(ProductModel).all()
    summary = build_summary(orders, products, datetime.now(timezone.utc))

    # Yapay zekâ yorumu ek bilgi: başarısız olursa ai_summary boş kalır, sayılar yine döner.
    # Sipariş verisi yokken yorum yaptırmıyoruz, eksik veriyle yanıltıcı olur.
    if summary["orders_available"]:
        summary["ai_summary"] = summarize_trends(summary)
    return summary


@app.post("/reports/ask")
def ask_report(payload: ReportQuestion, request: Request, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    if not ai_is_configured():
        raise HTTPException(status_code=503, detail="Yapay zekâ özelliği şu an yapılandırılmamış.")

    orders = fetch_orders(request.headers.get("authorization"))
    if orders is None:
        raise HTTPException(status_code=503, detail="Sipariş verilerine ulaşılamadı, soru şu an cevaplanamıyor.")

    products = db.query(ProductModel).all()
    context = build_question_context(orders, products, datetime.now(timezone.utc))
    answer = answer_question(payload.question, context)
    if answer is None:
        raise HTTPException(status_code=503, detail="Yapay zekâ şu an yanıt veremiyor, birazdan tekrar dene.")
    return {"question": payload.question, "answer": answer}


def staff_view(user: UserModel) -> dict:
    # Şifre hash'i hiçbir cevapta dönmez.
    return {
        "id": user.id,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "email": user.email,
        "role": user.role,
        "contact_email": user.contact_email,
        "created_at": user.created_at,
    }


@app.get("/staff")
def list_staff(db: Session = Depends(get_db), current_user: dict = Depends(require_admin)):
    users = db.query(UserModel).order_by(UserModel.role, UserModel.email).all()
    return [staff_view(user) for user in users]


@app.post("/staff", status_code=201)
def create_staff(payload: StaffCreate, db: Session = Depends(get_db), current_user: dict = Depends(require_admin)):
    local_part = email_local_part(payload.first_name, payload.last_name)
    if not local_part:
        raise HTTPException(status_code=400, detail="Ad ve soyad en az bir harf veya rakam içermeli.")

    email = unique_staff_email(
        local_part,
        lambda candidate: db.query(UserModel).filter(UserModel.email == candidate).first() is not None,
    )
    password = generate_password()

    new_user = UserModel(
        email=email,
        hashed_password=hash_password(password),
        role=payload.role,
        first_name=payload.first_name,
        last_name=payload.last_name,
        contact_email=payload.contact_email,
    )
    db.add(new_user)
    try:
        db.commit()
    except IntegrityError:
        # Aynı isimle tam aynı anda iki kayıt gelirse ikincisi unique kısıta takılır.
        db.rollback()
        raise HTTPException(status_code=409, detail="Bu e-posta az önce başka bir kayda verildi, tekrar dene.")
    db.refresh(new_user)

    # Şifre yalnızca bu cevapta düz metin olarak dönüyor; veritabanında sadece hash'i duruyor.
    return {**staff_view(new_user), "password": password}


@app.post("/staff/{user_id}/reset-password")
def reset_staff_password(user_id: uuid.UUID, db: Session = Depends(get_db), current_user: dict = Depends(require_admin)):
    user = db.query(UserModel).filter(UserModel.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=404, detail="Personel bulunamadı.")
    # Admin şifresi bu ekrandan sıfırlanmaz: admin yanlışlıkla kendini ya da diğer admini dışarıda bırakmasın.
    if user.role not in ("sales", "warehouse"):
        raise HTTPException(status_code=400, detail="Yalnızca satış ve depo personelinin şifresi sıfırlanabilir.")

    password = generate_password()
    user.hashed_password = hash_password(password)
    db.commit()
    return {"id": user.id, "email": user.email, "password": password}


# Kullanıcı oluşturmak Admin'in işi. İlk Admin seed.py ile yaratılıyor;
# bu endpoint açık kalsaydı internetten herkes kendine admin hesabı açabilirdi.
@app.post("/auth/register")
def register(user: UserRegister, db: Session = Depends(get_db), current_user: dict = Depends(require_admin)):
    existing_user = db.query(UserModel).filter(UserModel.email == user.email).first()
    if existing_user is not None:
        raise HTTPException(status_code=400, detail="Bu email zaten kayıtlı.")

    new_user = UserModel(
        email=user.email,
        hashed_password=hash_password(user.password),
        role=user.role,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return {"id": new_user.id, "email": new_user.email, "role": new_user.role}


@app.post("/auth/login")
def login(credentials: UserLogin, db: Session = Depends(get_db)):
    user = db.query(UserModel).filter(UserModel.email == credentials.email).first()
    if user is None or not verify_password(credentials.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Email veya şifre hatalı.")

    token = create_access_token(user_id=str(user.id), role=user.role)
    return {"access_token": token, "token_type": "bearer"}
