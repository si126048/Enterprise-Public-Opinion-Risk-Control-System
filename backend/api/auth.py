"""Authentication API - Register and Login"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from backend.db.database import get_connection
import hashlib
import uuid
import datetime

router = APIRouter(prefix="/api/auth", tags=["auth"])


class RegisterRequest(BaseModel):
    username: str
    password: str
    email: str = ""


class LoginRequest(BaseModel):
    username: str
    password: str


def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


@router.post("/register")
def register(req: RegisterRequest):
    if not req.username or not req.password:
        raise HTTPException(status_code=400, detail="用户名和密码不能为空")

    if len(req.username) < 3:
        raise HTTPException(status_code=400, detail="用户名至少 3 个字符")

    if len(req.password) < 6:
        raise HTTPException(status_code=400, detail="密码至少 6 个字符")

    conn = get_connection()
    try:
        existing = conn.execute(
            "SELECT id FROM users WHERE username = ?", (req.username,)
        ).fetchone()
        if existing:
            raise HTTPException(status_code=409, detail="用户名已存在")

        user_id = str(uuid.uuid4())
        now = datetime.datetime.now().isoformat()
        conn.execute(
            """INSERT INTO users (id, username, password_hash, email, created_at)
               VALUES (?, ?, ?, ?, ?)""",
            (user_id, req.username, hash_password(req.password), req.email or None, now),
        )
        conn.commit()

        return {
            "success": True,
            "user": {"id": user_id, "username": req.username, "email": req.email},
        }
    finally:
        conn.close()


@router.post("/login")
def login(req: LoginRequest):
    if not req.username or not req.password:
        raise HTTPException(status_code=400, detail="用户名和密码不能为空")

    conn = get_connection()
    try:
        user = conn.execute(
            "SELECT id, username, password_hash, email FROM users WHERE username = ?",
            (req.username,),
        ).fetchone()

        if not user:
            raise HTTPException(status_code=401, detail="用户名或密码错误")

        if user["password_hash"] != hash_password(req.password):
            raise HTTPException(status_code=401, detail="用户名或密码错误")

        now = datetime.datetime.now().isoformat()
        conn.execute("UPDATE users SET last_login = ? WHERE id = ?", (now, user["id"]))
        conn.commit()

        token = str(uuid.uuid4())

        return {
            "success": True,
            "token": token,
            "user": {"id": user["id"], "username": user["username"], "email": user["email"]},
        }
    finally:
        conn.close()
