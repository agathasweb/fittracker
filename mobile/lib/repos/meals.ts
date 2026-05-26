import { getDb } from '../db';
import { nowISO } from '../format';
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
  is_manual: number;
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
            CASE WHEN t.manual_kcal IS NOT NULL THEN 1 ELSE 0 END AS is_manual,
            CASE WHEN t.manual_kcal IS NOT NULL THEN 0 ELSE COUNT(i.id) END AS item_count,
            CASE WHEN t.manual_kcal IS NOT NULL
                 THEN t.manual_kcal
                 ELSE COALESCE(SUM(i.quantity_g * f.kcal_per_100g / 100.0), 0)
            END AS total_kcal
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

export type MealTotals = {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
};

export async function totalsOfDay(userId: number, dayISO: string): Promise<MealTotals> {
  const db = await getDb();
  // Soma de refeições com itens (template composto ou avulso)
  const items = await db.getFirstAsync<MealTotals>(
    `SELECT
        COALESCE(SUM(i.quantity_g * f.kcal_per_100g / 100.0), 0) AS kcal,
        COALESCE(SUM(i.quantity_g * f.protein_g / 100.0), 0) AS protein,
        COALESCE(SUM(i.quantity_g * f.carbs_g / 100.0), 0) AS carbs,
        COALESCE(SUM(i.quantity_g * f.fat_g / 100.0), 0) AS fat,
        COALESCE(SUM(i.quantity_g * COALESCE(f.fiber_g, 0) / 100.0), 0) AS fiber
       FROM meals m
       JOIN meal_items i ON i.meal_id = m.id
       JOIN foods f ON f.id = i.food_id
       LEFT JOIN meal_templates t ON t.id = m.meal_template_id
      WHERE m.user_id = ? AND date(m.consumed_at) = date(?)
        AND (t.id IS NULL OR t.manual_kcal IS NULL)`,
    userId,
    dayISO
  );
  // Soma de refeições baseadas em preparos manuais
  const manual = await db.getFirstAsync<MealTotals>(
    `SELECT
        COALESCE(SUM(t.manual_kcal), 0) AS kcal,
        COALESCE(SUM(COALESCE(t.manual_protein_g, 0)), 0) AS protein,
        COALESCE(SUM(COALESCE(t.manual_carbs_g, 0)), 0) AS carbs,
        COALESCE(SUM(COALESCE(t.manual_fat_g, 0)), 0) AS fat,
        COALESCE(SUM(COALESCE(t.manual_fiber_g, 0)), 0) AS fiber
       FROM meals m
       JOIN meal_templates t ON t.id = m.meal_template_id
      WHERE m.user_id = ? AND date(m.consumed_at) = date(?)
        AND t.manual_kcal IS NOT NULL`,
    userId,
    dayISO
  );
  const a = items ?? { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
  const b = manual ?? { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
  return {
    kcal: a.kcal + b.kcal,
    protein: a.protein + b.protein,
    carbs: a.carbs + b.carbs,
    fat: a.fat + b.fat,
    fiber: a.fiber + b.fiber,
  };
}

export async function createMeal(
  userId: number,
  mealType: MealType,
  notes?: string
): Promise<Meal> {
  const db = await getDb();
  const r = await db.runAsync(
    `INSERT INTO meals (user_id, meal_type, notes, consumed_at) VALUES (?, ?, ?, ?)`,
    userId,
    mealType,
    notes ?? null,
    nowISO()
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
  const tpl = await db.getFirstAsync<{ meal_type: MealType; manual_kcal: number | null }>(
    'SELECT meal_type, manual_kcal FROM meal_templates WHERE id = ? AND user_id = ?',
    templateId,
    userId
  );
  if (!tpl) throw new Error('Template não encontrado');
  // Preparos manuais não têm itens — totals vêm do próprio template via JOIN
  const items = tpl.manual_kcal !== null ? [] : await getTemplateItems(templateId);

  let mealId: number | null = null;
  await db.withTransactionAsync(async () => {
    const r = await db.runAsync(
      `INSERT INTO meals (user_id, meal_template_id, meal_type, notes, consumed_at)
       VALUES (?, ?, ?, ?, ?)`,
      userId,
      templateId,
      tpl.meal_type,
      notes ?? null,
      nowISO()
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
