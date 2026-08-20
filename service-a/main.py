from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI()

class Product(BaseModel):
    name: str
    price: float

list_products = {
    1: {"name": "Selamlar", "price": 10.0},
    2: {"name": "Merhabalar", "price": 20.0},
}

@app.get("/products")
def get_products():
    return list_products

@app.post("/products")
def create_product(product: Product):
    new_id = max(list_products.keys()) + 1 if list_products else 1
    list_products[new_id] = product.model_dump()
    return {"id": new_id, **list_products[new_id]}

@app.get("/products/{product_id}")
def get_product_id(product_id: int):
    for a in list_products.keys():
        if a == product_id:
            return list_products[a]
    raise HTTPException(status_code=404, detail="Ürün bulunamadı.")

@app.delete("/products/{product_id}")
def delete_product(product_id: int):
    if product_id in list_products:
        del list_products[product_id]
        return {"message": "Ürün silindi."}
    raise HTTPException(status_code=404, detail="Ürün bulunamadı.")