"""Catálogo de alimentos (busca + cadastro custom).

Padrão futuro: importar a base TACO (Tabela Brasileira de Composição
de Alimentos) da UNICAMP — já existem dumps SQLite prontos no GitHub.
"""
from __future__ import annotations
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()


class Food(BaseModel):
    id: int
    name: str
    kcal_per_100g: float
    protein_g: float
    carbs_g: float
    fat_g: float
    fiber_g: float = 0
    source: str = "TACO"


# Mock — substituir por query no Postgres + import TACO
_DEMO_FOODS = [
    Food(id=1, name="Arroz branco cozido", kcal_per_100g=128, protein_g=2.5, carbs_g=28.1, fat_g=0.2),
    Food(id=2, name="Feijão preto cozido", kcal_per_100g=77, protein_g=4.5, carbs_g=14, fat_g=0.5, fiber_g=8.4),
    Food(id=3, name="Peito de frango grelhado", kcal_per_100g=159, protein_g=32, carbs_g=0, fat_g=2.5),
    Food(id=4, name="Banana prata", kcal_per_100g=98, protein_g=1.3, carbs_g=26, fat_g=0.1, fiber_g=2),
    Food(id=5, name="Ovo cozido", kcal_per_100g=146, protein_g=13.3, carbs_g=0.6, fat_g=9.5),
    Food(id=6, name="Batata doce cozida", kcal_per_100g=77, protein_g=0.6, carbs_g=18.4, fat_g=0.1, fiber_g=2.2),
    Food(id=7, name="Whey protein", kcal_per_100g=380, protein_g=80, carbs_g=8, fat_g=4),
    Food(id=8, name="Aveia em flocos", kcal_per_100g=394, protein_g=13.9, carbs_g=66.6, fat_g=8.5, fiber_g=9.1),
]


@router.get("", response_model=list[Food])
async def list_foods(q: str | None = None) -> list[Food]:
    if not q:
        return _DEMO_FOODS
    qlo = q.lower()
    return [f for f in _DEMO_FOODS if qlo in f.name.lower()]


@router.post("", response_model=Food)
async def create_food(food: Food) -> Food:
    return food
