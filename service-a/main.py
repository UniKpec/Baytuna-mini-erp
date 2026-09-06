import uuid
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP
from fastapi import FastAPI, HTTPException, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

from database import get_db
from models import Product as ProductModel, User as UserModel, StockMovement as StockMovementModel
from auth import verify_password, create_access_token, hash_password, require_admin, require_warehouse, get_current_user

app = FastAPI()


class Product(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    sku: str = Field(min_length=1, max_length=50)
    margin_percent: Decimal = Field(gt=0, le=999)


class StockMovementCreate(BaseModel):
    product_id: uuid.UUID
    quantity: int = Field(gt=0)
    unit_cost: Decimal = Field(gt=0)


class UserRegister(BaseModel):
    email: str
    password: str
    role: str


class UserLogin(BaseModel):
    email: str
    password: str


def to_money(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


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
    product.updated_at = datetime.utcnow()

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


@app.post("/auth/register")
def register(user: UserRegister, db: Session = Depends(get_db)):
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
