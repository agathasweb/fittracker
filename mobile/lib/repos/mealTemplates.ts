import { getDb } from '../db';
import { MealTemplate, MealTemplateItem, MealType } from '../types';

export type TemplateItemWithFood = MealTemplateItem & {
  food_name: string;
  kcal_per_100g: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number | null;
  unit: 'g' | 'ml';
};

/**
 * Template enriquecido com totais efetivos.
 *
 * Quando `manual_kcal` está preenchido, o preparo é "manual" — usa os macros próprios
 * (porção inteira) e ignora itens. Caso contrário, soma os itens vinculados.
 *
 * `total_*` já vem com a regra aplicada — UI só consome esses campos.
 */
export type TemplateSummary = MealTemplate & {
  item_count: number;
  is_manual: number;
  total_kcal: number;
  total_protein_g: number;
  total_carbs_g: number;
  total_fat_g: number;
  total_fiber_g: number;
};

const TEMPLATE_SELECT = `
  t.*,
  CASE WHEN t.manual_kcal IS NOT NULL THEN 1 ELSE 0 END AS is_manual,
  CASE WHEN t.manual_kcal IS NOT NULL THEN 0 ELSE COUNT(i.id) END AS item_count,
  CASE WHEN t.manual_kcal IS NOT NULL
       THEN t.manual_kcal
       ELSE COALESCE(SUM(i.quantity_g * f.kcal_per_100g / 100.0), 0)
  END AS total_kcal,
  CASE WHEN t.manual_kcal IS NOT NULL
       THEN COALESCE(t.manual_protein_g, 0)
       ELSE COALESCE(SUM(i.quantity_g * f.protein_g / 100.0), 0)
  END AS total_protein_g,
  CASE WHEN t.manual_kcal IS NOT NULL
       THEN COALESCE(t.manual_carbs_g, 0)
       ELSE COALESCE(SUM(i.quantity_g * f.carbs_g / 100.0), 0)
  END AS total_carbs_g,
  CASE WHEN t.manual_kcal IS NOT NULL
       THEN COALESCE(t.manual_fat_g, 0)
       ELSE COALESCE(SUM(i.quantity_g * f.fat_g / 100.0), 0)
  END AS total_fat_g,
  CASE WHEN t.manual_kcal IS NOT NULL
       THEN COALESCE(t.manual_fiber_g, 0)
       ELSE COALESCE(SUM(i.quantity_g * COALESCE(f.fiber_g, 0) / 100.0), 0)
  END AS total_fiber_g
`;

export async function listTemplates(userId: number): Promise<TemplateSummary[]> {
  const db = await getDb();
  return db.getAllAsync<TemplateSummary>(
    `SELECT ${TEMPLATE_SELECT}
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

export async function getTemplateSummary(id: number): Promise<TemplateSummary | null> {
  const db = await getDb();
  return (
    (await db.getFirstAsync<TemplateSummary>(
      `SELECT ${TEMPLATE_SELECT}
         FROM meal_templates t
         LEFT JOIN meal_template_items i ON i.meal_template_id = t.id
         LEFT JOIN foods f ON f.id = i.food_id
        WHERE t.id = ?
        GROUP BY t.id`,
      id
    )) ?? null
  );
}

export async function getTemplateItems(templateId: number): Promise<TemplateItemWithFood[]> {
  const db = await getDb();
  return db.getAllAsync<TemplateItemWithFood>(
    `SELECT i.*, f.name AS food_name, f.kcal_per_100g, f.protein_g, f.carbs_g, f.fat_g, f.fiber_g, f.unit
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

export type TemplatePatch = Partial<
  Pick<
    MealTemplate,
    | 'name'
    | 'meal_type'
    | 'description'
    | 'manual_kcal'
    | 'manual_protein_g'
    | 'manual_carbs_g'
    | 'manual_fat_g'
    | 'manual_fiber_g'
  >
>;

export async function updateTemplate(id: number, patch: TemplatePatch): Promise<void> {
  const keys = Object.keys(patch);
  if (!keys.length) return;
  const db = await getDb();
  const set = keys.map((k) => `${k} = ?`).join(', ');
  const values = keys.map((k) => (patch as any)[k]);
  await db.runAsync(`UPDATE meal_templates SET ${set} WHERE id = ?`, ...values, id);
}

/**
 * Limpa os macros manuais legados de um template (deixados pelo antigo modo "Preparo IA"
 * que estimava a porção total). Templates novos só usam preparos compostos, então isso
 * é chamado ao salvar pra normalizar templates antigos editados.
 */
export async function clearTemplateManualMacros(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE meal_templates
        SET manual_kcal = NULL,
            manual_protein_g = NULL,
            manual_carbs_g = NULL,
            manual_fat_g = NULL,
            manual_fiber_g = NULL
      WHERE id = ?`,
    id
  );
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
