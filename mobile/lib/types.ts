export type Sex = 'M' | 'F' | 'O';

export type ActivityLevel =
  | 'sedentary'
  | 'light'
  | 'moderate'
  | 'active'
  | 'very_active';

export type MealType = 'breakfast' | 'lunch' | 'snack' | 'dinner';

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
  kcal_per_100g: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number | null;
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

/** Macros de um alimento ou preparo, normalizados. */
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
