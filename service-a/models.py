from sqlalchemy import Column, Integer, Float, String
from database import Base


class Product(Base):
    __tablename__ = "product"
    id = Column(Integer, primary_key=True)
    name = Column(String)
    price = Column(Float)