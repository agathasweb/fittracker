"""Perfil do usuário, metas, peso ao longo do tempo."""
from __future__ import annotations
from datetime import date
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()


class Profile(BaseModel):
    id: int = 1
    name: str = "Demo User"
    email: str = "demo@fittracker.app"
    sex: str = "M"            # M / F
    birthdate: date = date(1990, 1, 1)
    height_cm: float = 175
    weight_kg: float = 80
    activity_level: str = "moderate"  # sedentary/light/moderate/active/very_active
    goal: str = "lose"        # lose / maintain / gain
    target_weight_kg: float = 72
    target_date: date | None = None


@router.get("/me", response_model=Profile)
async def me() -> Profile:
    return Profile()


@router.put("/me", response_model=Profile)
async def update_me(profile: Profile) -> Profile:
    return profile
