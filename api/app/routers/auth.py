"""Endpoints de autenticação (stub)."""
from __future__ import annotations
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr

router = APIRouter()


class RegisterReq(BaseModel):
    email: EmailStr
    password: str
    name: str


class LoginReq(BaseModel):
    email: EmailStr
    password: str


class TokenResp(BaseModel):
    access_token: str
    token_type: str = "bearer"


@router.post("/register", response_model=TokenResp)
async def register(req: RegisterReq) -> TokenResp:
    # TODO: hash bcrypt + insert no DB + emitir JWT
    return TokenResp(access_token="stub-token")


@router.post("/login", response_model=TokenResp)
async def login(req: LoginReq) -> TokenResp:
    # TODO: validar credenciais + emitir JWT
    if req.email == "demo@fittracker.app" and req.password == "demo":
        return TokenResp(access_token="demo-token")
    raise HTTPException(status_code=401, detail="Credenciais inválidas")
