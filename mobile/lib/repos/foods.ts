import { getDb } from '../db';
import { Food } from '../types';

export type NewFood = Omit<Food, 'id' | 'created_at'>;

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
  if (!created) throw new Error('Falha ao criar alimento');
  return created;
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

export async function listFoods(limit = 100): Promise<Food[]> {
  const db = await getDb();
  return db.getAllAsync<Food>('SELECT * FROM foods ORDER BY name LIMIT ?', limit);
}

export async function getFood(id: number): Promise<Food | null> {
  const db = await getDb();
  return (await db.getFirstAsync<Food>('SELECT * FROM foods WHERE id = ?', id)) ?? null;
}
