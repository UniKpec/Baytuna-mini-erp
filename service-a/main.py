from fastapi import FastAPI, HTTPException, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel

from database import get_db
from models import Product as ProductModel

app = FastAPI()


class Product(BaseModel):
    name: str
    price: float


@app.get("/products")
def get_products(db: Session = Depends(get_db)):
    return db.query(ProductModel).all()


@app.post("/products")
def create_product(product: Product, db: Session = Depends(get_db)):
    new_product = ProductModel(name=product.name, price=product.price)
    db.add(new_product)
    db.commit()
    db.refresh(new_product)
    return new_product


@app.get("/products/{product_id}")
def get_product_id(product_id: int, db: Session = Depends(get_db)):
    product = db.query(ProductModel).filter(ProductModel.id == product_id).first()
    if product is None:
        raise HTTPException(status_code=404, detail="Ürün bulunamadı.")
    return product


@app.delete("/products/{product_id}")
def delete_product(product_id: int, db: Session = Depends(get_db)):
    product = db.query(ProductModel).filter(ProductModel.id == product_id).first()
    if product is None:
        raise HTTPException(status_code=404, detail="Ürün bulunamadı.")
    db.delete(product)
    db.commit()
    return {"message": "Ürün silindi."}