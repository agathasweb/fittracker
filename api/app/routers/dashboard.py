"""Dashboard: cálculos de TMB, GET, déficit/superávit, previsão."""
from __future__ import annotations
from datetime import date, timedelta
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()


ACTIVITY_FACTOR = {
    "sedentary": 1.2,
    "light": 1.375,
    "moderate": 1.55,
    "active": 1.725,
    "very_active": 1.9,
}


def mifflin_st_jeor(sex: str, weight: float, height: float, age: int) -> float:
    """TMB pela fórmula Mifflin-St Jeor (kcal/dia)."""
    base = 10 * weight + 6.25 * height - 5 * age
    return base + (5 if sex == "M" else -161)


class DailySummary(BaseModel):
    date: date
    tmb: float                # taxa metabólica basal
    get: float                # gasto energético total (TMB × fator)
    kcal_eaten: float
    kcal_burned: float
    balance: float            # negativo = déficit (emagrecimento)
    macros: dict              # {protein, carbs, fat} em gramas


class WeightPrediction(BaseModel):
    target_weight: float
    target_date_estimate: date
    weeks: int
    avg_deficit: float


@router.get("/today", response_model=DailySummary)
async def today() -> DailySummary:
    # MOCK — substituir por cálculo real do dia
    tmb = mifflin_st_jeor("M", 80, 175, 35)
    get = tmb * ACTIVITY_FACTOR["moderate"]
    return DailySummary(
        date=date.today(),
        tmb=tmb,
        get=get,
        kcal_eaten=1850,
        kcal_burned=320,
        balance=1850 - get - 320,
        macros={"protein": 145, "carbs": 180, "fat": 55},
    )


@router.get("/prediction", response_model=WeightPrediction)
async def prediction() -> WeightPrediction:
    """Previsão simples: 7700 kcal ≈ 1 kg de gordura.

    Com déficit médio diário de X kcal, perde X*7/7700 kg/semana.
    """
    avg_deficit = 500
    delta_kg = 8.0   # 80 → 72
    weeks = round((delta_kg * 7700) / (avg_deficit * 7))
    return WeightPrediction(
        target_weight=72,
        target_date_estimate=date.today() + timedelta(weeks=weeks),
        weeks=weeks,
        avg_deficit=avg_deficit,
    )
