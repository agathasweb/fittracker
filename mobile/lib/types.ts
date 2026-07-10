export type Sex = 'M' | 'F' | 'O';

export type ActivityLevel =
  | 'sedentary'
  | 'light'
  | 'moderate'
  | 'active'
  | 'very_active';

export type MealType = 'breakfast' | 'lunch' | 'snack' | 'dinner';

/** Unidade do preparo armazenado em `foods`. Sólido em gramas, líquido em mililitros. */
export type FoodUnit = 'g' | 'ml';

export type User = {
  id: number;
  email: string;
  password_hash: string;
  name: string;
  sex: Sex;
  birth_date: string;
  height_cm: number;
  current_weight_kg: number;
  goal_weight_kg: number;
  activity_level: ActivityLevel;
  daily_water_goal_ml: number;
  daily_calorie_goal: number | null;
  avatar_uri: string | null;
  created_at: string;
  updated_at: string;
};

export type Food = {
  id: number;
  name: string;
  /**
   * kcal por 100 unidades (100g pra sólidos, 100ml pra líquidos).
   * O nome mantém `_per_100g` por compatibilidade com o schema antigo —
   * pra líquidos lê-se como kcal/100ml. Densidade ≈ 1 g/ml é assumida pros cálculos.
   */
  kcal_per_100g: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number | null;
  unit: FoodUnit;
  source: 'custom' | 'taco';
  created_at: string;
};

export type Bottle = {
  id: number;
  user_id: number;
  name: string;
  capacity_ml: number;
  is_favorite: number;
  created_at: string;
};

export type HydrationEntry = {
  id: number;
  user_id: number;
  bottle_id: number | null;
  ml: number;
  consumed_at: string;
};

export type MealTemplate = {
  id: number;
  user_id: number;
  name: string;
  meal_type: MealType;
  description: string | null;
  manual_kcal: number | null;
  manual_protein_g: number | null;
  manual_carbs_g: number | null;
  manual_fat_g: number | null;
  manual_fiber_g: number | null;
  created_at: string;
};

/** Macros de um preparo, normalizados. */
export type Macros = {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number | null;
};

export type MealTemplateItem = {
  id: number;
  meal_template_id: number;
  food_id: number;
  quantity_g: number;
};

export type Meal = {
  id: number;
  user_id: number;
  meal_template_id: number | null;
  meal_type: MealType;
  consumed_at: string;
  notes: string | null;
};

export type MealItem = {
  id: number;
  meal_id: number;
  food_id: number;
  quantity_g: number;
};

export type WeightLog = {
  id: number;
  user_id: number;
  weight_kg: number;
  logged_at: string;
};

export type Medication = {
  id: number;
  user_id: number;
  name: string;
  dosage: string | null;
  notes: string | null;
  color: string | null;
  /** JSON array de horários "HH:mm" pra lembrete diário. */
  reminder_times: string | null;
  /** JSON array de IDs de notificações agendadas no expo-notifications. */
  notification_ids: string | null;
  active: number;
  created_at: string;
};

export type MedicationIntake = {
  id: number;
  medication_id: number;
  taken_at: string;
};

export type Activity = {
  id: number;
  user_id: number;
  name: string;
  duration_min: number;
  distance_km: number | null;
  kcal: number;
  notes: string | null;
  performed_at: string;
};

// ─── Treino de força ───────────────────────────────────────────────
export type WorkoutTemplate = {
  id: number;
  user_id: number;
  name: string;
  notes: string | null;
  position: number;
  created_at: string;
  updated_at: string;
};

export type WorkoutTemplateExercise = {
  id: number;
  template_id: number;
  name: string;
  target_sets: number;
  target_reps: string | null;
  notes: string | null;
  position: number;
};

export type WorkoutTemplateFull = WorkoutTemplate & {
  exercises: WorkoutTemplateExercise[];
};

export type WorkoutSession = {
  id: number;
  user_id: number;
  template_id: number | null;
  name: string;
  notes: string | null;
  performed_at: string;
  created_at: string;
  estimated_kcal: number | null;
};

export type WorkoutSessionSet = {
  id: number;
  session_id: number;
  exercise_name: string;
  exercise_position: number;
  set_number: number;
  done: boolean;
  reps: number | null;
  load_kg: number | null;
  created_at: string;
};

/** Exercício agrupado numa sessão, com suas séries. */
export type SessionExercise = {
  name: string;
  position: number;
  sets: WorkoutSessionSet[];
};

export type WorkoutSessionFull = WorkoutSession & {
  exercises: SessionExercise[];
};

export const ACTIVITY_FACTOR: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

export const ACTIVITY_LABEL: Record<ActivityLevel, string> = {
  sedentary: 'Sedentário (pouco ou nenhum exercício)',
  light: 'Leve (1-3 dias/semana)',
  moderate: 'Moderado (3-5 dias/semana)',
  active: 'Ativo (6-7 dias/semana)',
  very_active: 'Muito ativo (2x/dia ou trabalho físico)',
};

export const MEAL_TYPE_LABEL: Record<MealType, string> = {
  breakfast: 'Café da manhã',
  lunch: 'Almoço',
  snack: 'Lanche',
  dinner: 'Jantar',
};

export const SEX_LABEL: Record<Sex, string> = {
  M: 'Masculino',
  F: 'Feminino',
  O: 'Outro',
};
