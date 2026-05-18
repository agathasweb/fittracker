"""Registro de refeições diárias."""
from __future__ import annotations
from datetime import date, datetime
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()


class MealItem(BaseModel):
    food_id: int
    grams: float


class Meal(BaseModel):
    id: int | None = None
    date: date
    kind: str          # cafe / almoco / lanche / jantar / ceia
    time: str          # "08:30"
    items: list[MealItem]
    notes: str | None = None


@router.get("", response_model=list[Meal])
async def list_meals(d: date | None = None) -> list[Meal]:
    today = d or date.today()
    return [
        Meal(id=1, date=today, kind="cafe", time="08:00",
             items=[MealItem(food_id=8, grams=40), MealItem(food_id=4, grams=100)]),
        Meal(id=2, date=today, kind="almoco", time="12:30",
             items=[MealItem(food_id=1, grams=150), MealItem(food_id=2, grams=100),
                    MealItem(food_id=3, grams=180)]),
    ]


@router.post("", response_model=Meal)
async def create_meal(meal: Meal) -> Meal:
    meal.id = int(datetime.utcnow().timestamp())
    return meal


@router.delete("/{meal_id}")
async def delete_meal(meal_id: int) -> dict[str, bool]:
    return {"ok": True}
