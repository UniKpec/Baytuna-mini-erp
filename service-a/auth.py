from datetime import datetime, timedelta
from passlib.context import CryptContext
from jose import jwt
import os

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    hashed_password = pwd_context.hash(password)
    return hashed_password

def verify_password(plain_password: str, hashed_password: str) -> bool:
    is_verify = pwd_context.verify(plain_password,hashed_password)
    return is_verify

JWT_SECRET = os.getenv("JWT_SECRET")
JWT_ISSUER = os.getenv("JWT_ISSUER")
JWT_AUDIENCE = os.getenv("JWT_AUDIENCE")
JWT_ALGORITHM = "HS256"

def create_access_token(user_id: str, role: str) -> str:
    expire = datetime.utcnow() + timedelta(minutes=60)
    payload={
        "user_id": user_id,
        "role": role,
        "exp": expire,
        "iss": JWT_ISSUER,
        "aud": JWT_AUDIENCE,
    }

    token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
    return token