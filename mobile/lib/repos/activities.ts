import { getDb } from '../db';
import { nowISO } from '../format';
import { Activity } from '../types';

export type NewActivity = {
  user_id: number;
  name: string;
  duration_min: number;
  distance_km?: number | null;
  kcal: number;
  notes?: string | null;
  performed_at?: string;
};

export async function createActivity(a: NewActivity): Promise<Activity> {
  const db = await getDb();
  const r = await db.runAsync(
    `INSERT INTO activities (user_id, name, duration_min, distance_km, kcal, notes, performed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    a.user_id,
    a.name.trim(),
    Math.round(a.duration_min),
    a.distance_km ?? null,
    Math.round(a.kcal),
    a.notes?.trim() || null,
    a.performed_at ?? nowISO()
  );
  const created = await db.getFirstAsync<Activity>(
    'SELECT * FROM activities WHERE id = ?',
    r.lastInsertRowId
  );
  if (!created) throw new Error('Falha ao salvar atividade');
  return created;
}

export async function deleteActivity(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM activities WHERE id = ?', id);
}

export async function listActivitiesOfDay(
  userId: number,
  dayISO: string
): Promise<Activity[]> {
  const db = await getDb();
  return db.getAllAsync<Activity>(
    `SELECT * FROM activities
      WHERE user_id = ? AND date(performed_at) = date(?)
      ORDER BY performed_at DESC`,
    userId,
    dayISO
  );
}

export async function sumKcalOfDay(userId: number, dayISO: string): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(kcal), 0) AS total FROM activities
      WHERE user_id = ? AND date(performed_at) = date(?)`,
    userId,
    dayISO
  );
  return row?.total ?? 0;
}
