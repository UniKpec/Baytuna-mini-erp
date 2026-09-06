"""Testler bellekte SQLite üzerinde koşar; ayakta Postgres gerekmez."""
import os
import sys
import uuid

# main.py import edilmeden once zorunlu env'ler dolu olmali.
os.environ.setdefault("DATABASE_URL", "sqlite://")
os.environ.setdefault("JWT_SECRET", "test-secret")
os.environ.setdefault("JWT_ISSUER", "MiniErp.ServiceA")
os.environ.setdefault("JWT_AUDIENCE", "MiniErp.ServiceB")

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
from decimal import Decimal
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import main
import mailer
from database import Base, get_db
from models import Product, User
from auth import create_access_token, hash_password


@pytest.fixture
def db_session():
    # StaticPool: tum baglantilar ayni bellek veritabanini paylassin.
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()
    yield session
    session.close()


@pytest.fixture
def client(db_session, monkeypatch):
    # Testler gercek mail atmasin.
    monkeypatch.setattr(main, "send_critical_stock_alert", lambda to, products: None)
    main.app.dependency_overrides[get_db] = lambda: db_session
    yield TestClient(main.app)
    main.app.dependency_overrides.clear()


@pytest.fixture
def users(db_session):
    kayitlar = {}
    for email, role in [("admin@test", "admin"), ("satis@test", "sales"), ("depo@test", "warehouse")]:
        user = User(email=email, hashed_password=hash_password("sifre123"), role=role)
        db_session.add(user)
        kayitlar[role] = user
    db_session.commit()
    return kayitlar


@pytest.fixture
def tokens(users):
    return {
        role: {"Authorization": "Bearer " + create_access_token(str(user.id), role)}
        for role, user in users.items()
    }


@pytest.fixture
def product(db_session):
    urun = Product(
        name="Vida M8", sku="VDA-M8", margin_percent=Decimal("20"),
        avg_cost=Decimal("100.00"), sale_price=Decimal("120.00"), stock_quantity=5,
    )
    db_session.add(urun)
    db_session.commit()
    return urun
