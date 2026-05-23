import { getDb } from '../db';
import { HydrationEntry } from '../types';

export async function addEntry(
  userId: number,
  ml: number,
  bottleId?: number | null
): Promise<HydrationEntry> {
  const db = await getDb();
  const r = await db.runAsync(
    `INSERT INTO hydration_entries (user_id, ml, bottle_id)
     VALUES (?, ?, ?)`,
    userId,
    Math.round(ml),
    bottleId ?? null
  );
  const created = await db.getFirstAsync<HydrationEntry>(
    'SELECT * FROM hydration_entries WHERE id = ?',
    r.lastInsertRowId
  );
  if (!created) throw new Error('Falha ao registrar hidratação');
  return created;
}

export async function deleteEntry(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM hydration_entries WHERE id = ?', id);
}

export type HydrationEntryWithBottle = HydrationEntry & {
  bottle_name: string | null;
};

export async function listEntriesOfDay(
  userId: number,
  dayISO: string
): Promise<HydrationEntryWithBottle[]> {
  const db = await getDb();
  return db.getAllAsync<HydrationEntryWithBottle>(
    `SELECT h.*, b.name AS bottle_name
       FROM hydration_entries h
       LEFT JOIN bottles b ON b.id = h.bottle_id
      WHERE h.user_id = ? AND date(h.consumed_at) = date(?)
      ORDER BY h.consumed_at DESC`,
    userId,
    dayISO
  );
}

export async function sumMlOfDay(userId: number, dayISO: string): Promise<number> {
  const db = await getDb();
  const r = await db.getFirstAsync<{ total: number | null }>(
    `SELECT COALESCE(SUM(ml), 0) AS total
       FROM hydration_entries
      WHERE user_id = ? AND date(consumed_at) = date(?)`,
    userId,
    dayISO
  );
  return r?.total ?? 0;
}
