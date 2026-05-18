"""Treinos: cadastro de sessões e exercícios."""
from __future__ import annotations
from datetime import date
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()


class ExerciseSet(BaseModel):
    reps: int
    weight_kg: float


class Exercise(BaseModel):
    name: str
    sets: list[ExerciseSet]
    rest_sec: int = 60


class Workout(BaseModel):
    id: int | None = None
    date: date
    name: str               # ex: "Push A", "Cardio HIIT"
    duration_min: int
    kcal_burned: float
    exercises: list[Exercise]


@router.get("", response_model=list[Workout])
async def list_workouts() -> list[Workout]:
    return [
        Workout(id=1, date=date.today(), name="Push A", duration_min=55, kcal_burned=320,
                exercises=[
                    Exercise(name="Supino reto", sets=[
                        ExerciseSet(reps=10, weight_kg=60),
                        ExerciseSet(reps=8, weight_kg=70),
                        ExerciseSet(reps=6, weight_kg=80),
                    ]),
                    Exercise(name="Desenvolvimento militar", sets=[
                        ExerciseSet(reps=10, weight_kg=30),
                        ExerciseSet(reps=10, weight_kg=30),
                    ]),
                ])
    ]


@router.post("", response_model=Workout)
async def create_workout(workout: Workout) -> Workout:
    return workout
