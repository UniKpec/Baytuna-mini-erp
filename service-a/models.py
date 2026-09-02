import uuid
from sqlalchemy import Column, Float, String
from sqlalchemy.dialects.postgresql import UUID
from database import Base


class Product(Base):
    __tablename__ = "products"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String)
    price = Column(Float)


class User(Base):
    __tablename__ = "users"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String, unique=True)
    hashed_password = Column(String)
    role = Column(String)   