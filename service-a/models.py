import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, DateTime, ForeignKey, Integer, Numeric, String, Uuid
from database import Base


def utc_now():
    return datetime.now(timezone.utc)


class Product(Base):
    __tablename__ = "products"
    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    name = Column(String(255))
    sku = Column(String(50), unique=True)
    margin_percent = Column(Numeric(5, 2))
    avg_cost = Column(Numeric(12, 2), default=0, nullable=False)
    sale_price = Column(Numeric(12, 2), default=0, nullable=False)
    stock_quantity = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now)
    updated_at = Column(DateTime(timezone=True), default=utc_now)


class User(Base):
    __tablename__ = "users"
    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    email = Column(String, unique=True)
    hashed_password = Column(String)
    role = Column(String)


class StockMovement(Base):
    __tablename__ = "stock_movements"
    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    product_id = Column(Uuid, ForeignKey("products.id"), nullable=False)
    quantity = Column(Integer, nullable=False)
    unit_cost = Column(Numeric(12, 2), nullable=False)
    created_by = Column(Uuid, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now)


class StockReservation(Base):
    __tablename__ = "stock_reservations"
    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    reservation_id = Column(Uuid, unique=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now)
