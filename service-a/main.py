import uuid
from fastapi import FastAPI, HTTPException, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel

from database import get_db
from models import Product as ProductModel, User as UserModel
from auth import verify_password, create_access_token, hash_password

app = FastAPI()


class Product(BaseModel):
    name: str
    price: float


class UserRegister(BaseModel):
    email: str
    password: str
    role: str


class UserLogin(BaseModel):
    email: str
    password: str


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
def get_product_id(product_id: uuid.UUID, db: Session = Depends(get_db)):
    product = db.query(ProductModel).filter(ProductModel.id == product_id).first()
    if product is None:
        raise HTTPException(status_code=404, detail="Ürün bulunamadı.")
    return product


@app.delete("/products/{product_id}")
def delete_product(product_id: uuid.UUID, db: Session = Depends(get_db)):
    product = db.query(ProductModel).filter(ProductModel.id == product_id).first()
    if product is None:
        raise HTTPException(status_code=404, detail="Ürün bulunamadı.")
    db.delete(product)
    db.commit()
    return {"message": "Ürün silindi."}


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