import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

load_dotenv()

Base = declarative_base()
database_url = os.getenv("DATABASE_URL")
if not database_url:
    # Servisi yarim yamalak ayaga kaldirmaktansa acik bir hatayla durdurmak daha iyi.
    raise RuntimeError("DATABASE_URL tanımlı değil. service-a/.env dosyasını kontrol et.")

engine = create_engine(database_url)
sessionLocal = sessionmaker(bind=engine)

def get_db():
    db = sessionLocal()
    try:
        yield db
    finally:
        db.close()