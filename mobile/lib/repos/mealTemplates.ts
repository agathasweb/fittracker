import { getDb } from '../db';
import { Food, MealTemplate, MealTemplateItem, MealType } from '../types';

export type TemplateItemWithFood = MealTemplateItem & {
  food_name: string;
  kcal_per_100g: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};

export type TemplateSummary = MealTemplate & {
  item_count: number;
  total_kcal: number;
};

export async function listTemplates(userId: number): Promise<TemplateSummary[]> {
  const db = await getDb();
  return db.getAllAsync<TemplateSummary>(
    `SELECT t.*,
            COUNT(i.id) AS item_count,
            COALESCE(SUM(i.quantity_g * f.kcal_per_100g / 100.0), 0) AS total_kcal
       FROM meal_templates t
       LEFT JOIN meal_template_items i ON i.meal_template_id = t.id
       LEFT JOIN foods f ON f.id = i.food_id
      WHERE t.user_id = ?
      GROUP BY t.id
      ORDER BY t.created_at DESC`,
    userId
  );
}

export async function getTemplate(id: number): Promise<MealTemplate | null> {
  const db = await getDb();
  return (
    (await db.getFirstAsync<MealTemplate>('SELECT * FROM meal_templates WHERE id = ?', id)) ?? null
  );
}

export async function getTemplateItems(templateId: number): Promise<TemplateItemWithFood[]> {
  const db = await getDb();
  return db.getAllAsync<TemplateItemWithFood>(
    `SELECT i.*, f.name AS food_name, f.kcal_per_100g, f.protein_g, f.carbs_g, f.fat_g
       FROM meal_template_items i
       JOIN foods f ON f.id = i.food_id
      WHERE i.meal_template_id = ?
      ORDER BY i.id`,
    templateId
  );
}

export async function createTemplate(
  userId: number,
  name: string,
  mealType: MealType
): Promise<MealTemplate> {
  const db = await getDb();
  const r = await db.runAsync(
    'INSERT INTO meal_templates (user_id, name, meal_type) VALUES (?, ?, ?)',
    userId,
    name.trim(),
    mealType
  );
  const created = await getTemplate(r.lastInsertRowId);
  if (!created) throw new Error('Falha ao criar template');
  return created;
}

export async function updateTemplate(
  id: number,
  patch: Partial<Pick<MealTemplate, 'name' | 'meal_type'>>
): Promise<void> {
  const keys = Object.keys(patch);
  if (!keys.length) return;
  const db = await getDb();
  const set = keys.map((k) => `${k} = ?`).join(', ');
  const values = keys.map((k) => (patch as any)[k]);
  await db.runAsync(`UPDATE meal_templates SET ${set} WHERE id = ?`, ...values, id);
}

export async function deleteTemplate(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM meal_templates WHERE id = ?', id);
}

export async function addTemplateItem(
  templateId: number,
  foodId: number,
  quantityG: number
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO meal_template_items (meal_template_id, food_id, quantity_g) VALUES (?, ?, ?)',
    templateId,
    foodId,
    quantityG
  );
}

export async function removeTemplateItem(itemId: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM meal_template_items WHERE id = ?', itemId);
}
