import { getDb } from '../db';
import { Bottle } from '../types';

export async function listBottles(userId: number): Promise<Bottle[]> {
  const db = await getDb();
  return db.getAllAsync<Bottle>(
    `SELECT * FROM bottles WHERE user_id = ?
     ORDER BY is_favorite DESC, created_at ASC`,
    userId
  );
}

export async function listFavoriteBottles(userId: number): Promise<Bottle[]> {
  const db = await getDb();
  return db.getAllAsync<Bottle>(
    `SELECT * FROM bottles WHERE user_id = ? AND is_favorite = 1
     ORDER BY created_at ASC`,
    userId
  );
}

export async function createBottle(
  userId: number,
  name: string,
  capacityMl: number,
  isFavorite = false
): Promise<Bottle> {
  const db = await getDb();
  const r = await db.runAsync(
    `INSERT INTO bottles (user_id, name, capacity_ml, is_favorite)
     VALUES (?, ?, ?, ?)`,
    userId,
    name.trim(),
    Math.round(capacityMl),
    isFavorite ? 1 : 0
  );
  const created = await db.getFirstAsync<Bottle>(
    'SELECT * FROM bottles WHERE id = ?',
    r.lastInsertRowId
  );
  if (!created) throw new Error('Falha ao criar garrafa');
  return created;
}

export async function updateBottle(
  id: number,
  patch: Partial<Pick<Bottle, 'name' | 'capacity_ml' | 'is_favorite'>>
): Promise<void> {
  const keys = Object.keys(patch);
  if (!keys.length) return;
  const db = await getDb();
  const set = keys.map((k) => `${k} = ?`).join(', ');
  const values = keys.map((k) => (patch as any)[k]);
  await db.runAsync(`UPDATE bottles SET ${set} WHERE id = ?`, ...values, id);
}

export async function toggleBottleFavorite(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'UPDATE bottles SET is_favorite = 1 - is_favorite WHERE id = ?',
    id
  );
}

export async function deleteBottle(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM bottles WHERE id = ?', id);
}
