import { getDb } from '../db';
import { Food } from '../types';

export type NewFood = Omit<Food, 'id' | 'created_at'>;
export type FoodPatch = Partial<Omit<Food, 'id' | 'created_at' | 'source'>>;

export async function createFood(f: NewFood): Promise<Food> {
  const db = await getDb();
  const r = await db.runAsync(
    `INSERT INTO foods (name, kcal_per_100g, protein_g, carbs_g, fat_g, fiber_g, source)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    f.name.trim(),
    f.kcal_per_100g,
    f.protein_g,
    f.carbs_g,
    f.fat_g,
    f.fiber_g ?? null,
    f.source
  );
  const created = await db.getFirstAsync<Food>('SELECT * FROM foods WHERE id = ?', r.lastInsertRowId);
  if (!created) throw new Error('Falha ao criar preparo');
  return created;
}

export async function updateFood(id: number, patch: FoodPatch): Promise<void> {
  const keys = Object.keys(patch);
  if (!keys.length) return;
  const db = await getDb();
  const set = keys.map((k) => `${k} = ?`).join(', ');
  const values = keys.map((k) => {
    const v = (patch as any)[k];
    return k === 'name' && typeof v === 'string' ? v.trim() : v;
  });
  await db.runAsync(`UPDATE foods SET ${set} WHERE id = ?`, ...values, id);
}

export async function deleteFood(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM foods WHERE id = ?', id);
}

/** Verifica se um preparo está em uso (template ou refeição registrada). */
export async function isFoodInUse(id: number): Promise<boolean> {
  const db = await getDb();
  const a = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM meal_template_items WHERE food_id = ?',
    id
  );
  if ((a?.n ?? 0) > 0) return true;
  const b = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM meal_items WHERE food_id = ?',
    id
  );
  return (b?.n ?? 0) > 0;
}

export async function searchFoods(query: string, limit = 30): Promise<Food[]> {
  const db = await getDb();
  const q = `%${query.trim().toLowerCase()}%`;
  return db.getAllAsync<Food>(
    `SELECT * FROM foods
      WHERE LOWER(name) LIKE ?
      ORDER BY name
      LIMIT ?`,
    q,
    limit
  );
}

export async function listFoods(limit = 500): Promise<Food[]> {
  const db = await getDb();
  return db.getAllAsync<Food>('SELECT * FROM foods ORDER BY name LIMIT ?', limit);
}

export async function getFood(id: number): Promise<Food | null> {
  const db = await getDb();
  return (await db.getFirstAsync<Food>('SELECT * FROM foods WHERE id = ?', id)) ?? null;
}
