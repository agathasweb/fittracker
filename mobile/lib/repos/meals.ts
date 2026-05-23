import { getDb } from '../db';
import { Meal, MealItem, MealType } from '../types';
import { getTemplateItems } from './mealTemplates';

export type MealItemWithFood = MealItem & {
  food_name: string;
  kcal_per_100g: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};

export type MealWithSummary = Meal & {
  template_name: string | null;
  item_count: number;
  total_kcal: number;
};

export async function listMealsOfDay(
  userId: number,
  dayISO: string
): Promise<MealWithSummary[]> {
  const db = await getDb();
  return db.getAllAsync<MealWithSummary>(
    `SELECT m.*,
            t.name AS template_name,
            COUNT(i.id) AS item_count,
            COALESCE(SUM(i.quantity_g * f.kcal_per_100g / 100.0), 0) AS total_kcal
       FROM meals m
       LEFT JOIN meal_templates t ON t.id = m.meal_template_id
       LEFT JOIN meal_items i ON i.meal_id = m.id
       LEFT JOIN foods f ON f.id = i.food_id
      WHERE m.user_id = ? AND date(m.consumed_at) = date(?)
      GROUP BY m.id
      ORDER BY m.consumed_at ASC`,
    userId,
    dayISO
  );
}

export async function getMealItems(mealId: number): Promise<MealItemWithFood[]> {
  const db = await getDb();
  return db.getAllAsync<MealItemWithFood>(
    `SELECT i.*, f.name AS food_name, f.kcal_per_100g, f.protein_g, f.carbs_g, f.fat_g
       FROM meal_items i
       JOIN foods f ON f.id = i.food_id
      WHERE i.meal_id = ?
      ORDER BY i.id`,
    mealId
  );
}

export type MealTotals = { kcal: number; protein: number; carbs: number; fat: number };

export async function totalsOfDay(userId: number, dayISO: string): Promise<MealTotals> {
  const db = await getDb();
  const r = await db.getFirstAsync<MealTotals>(
    `SELECT
        COALESCE(SUM(i.quantity_g * f.kcal_per_100g / 100.0), 0) AS kcal,
        COALESCE(SUM(i.quantity_g * f.protein_g / 100.0), 0) AS protein,
        COALESCE(SUM(i.quantity_g * f.carbs_g / 100.0), 0) AS carbs,
        COALESCE(SUM(i.quantity_g * f.fat_g / 100.0), 0) AS fat
       FROM meals m
       JOIN meal_items i ON i.meal_id = m.id
       JOIN foods f ON f.id = i.food_id
      WHERE m.user_id = ? AND date(m.consumed_at) = date(?)`,
    userId,
    dayISO
  );
  return r ?? { kcal: 0, protein: 0, carbs: 0, fat: 0 };
}

export async function createMeal(
  userId: number,
  mealType: MealType,
  notes?: string
): Promise<Meal> {
  const db = await getDb();
  const r = await db.runAsync(
    `INSERT INTO meals (user_id, meal_type, notes) VALUES (?, ?, ?)`,
    userId,
    mealType,
    notes ?? null
  );
  const m = await db.getFirstAsync<Meal>('SELECT * FROM meals WHERE id = ?', r.lastInsertRowId);
  if (!m) throw new Error('Falha ao criar refeição');
  return m;
}

export async function createMealFromTemplate(
  userId: number,
  templateId: number,
  notes?: string
): Promise<Meal> {
  const db = await getDb();
  const tpl = await db.getFirstAsync<{ meal_type: MealType }>(
    'SELECT meal_type FROM meal_templates WHERE id = ? AND user_id = ?',
    templateId,
    userId
  );
  if (!tpl) throw new Error('Template não encontrado');
  const items = await getTemplateItems(templateId);

  let mealId: number | null = null;
  await db.withTransactionAsync(async () => {
    const r = await db.runAsync(
      `INSERT INTO meals (user_id, meal_template_id, meal_type, notes)
       VALUES (?, ?, ?, ?)`,
      userId,
      templateId,
      tpl.meal_type,
      notes ?? null
    );
    mealId = r.lastInsertRowId;
    for (const it of items) {
      await db.runAsync(
        'INSERT INTO meal_items (meal_id, food_id, quantity_g) VALUES (?, ?, ?)',
        mealId,
        it.food_id,
        it.quantity_g
      );
    }
  });
  const created = await db.getFirstAsync<Meal>('SELECT * FROM meals WHERE id = ?', mealId);
  if (!created) throw new Error('Falha ao criar refeição');
  return created;
}

export async function addMealItem(
  mealId: number,
  foodId: number,
  quantityG: number
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO meal_items (meal_id, food_id, quantity_g) VALUES (?, ?, ?)',
    mealId,
    foodId,
    quantityG
  );
}

export async function deleteMeal(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM meals WHERE id = ?', id);
}
