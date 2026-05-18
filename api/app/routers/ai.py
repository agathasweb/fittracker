"""Sugestões de dieta e treino via IA (stub)."""
from __future__ import annotations
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()


class DietSuggestion(BaseModel):
    title: str
    summary: str
    meals: list[dict]
    total_kcal: float


@router.post("/suggest-diet", response_model=DietSuggestion)
async def suggest_diet() -> DietSuggestion:
    """Recebe perfil + alimentos cadastrados + meta, e retorna cardápio sugerido."""
    return DietSuggestion(
        title="Cardápio de déficit moderado (-500 kcal)",
        summary="Baseado nos alimentos que você consome com frequência, sugestão de dia completo.",
        meals=[
            {"kind": "cafe", "items": ["40g aveia", "1 banana", "2 ovos cozidos"]},
            {"kind": "almoco", "items": ["150g arroz", "100g feijão", "180g peito de frango", "salada à vontade"]},
            {"kind": "lanche", "items": ["30g whey", "1 banana"]},
            {"kind": "jantar", "items": ["180g peito de frango", "200g batata doce", "brócolis"]},
        ],
        total_kcal=1850,
    )
