import { getDb } from '../db';
import { User, ActivityLevel, Sex } from '../types';

export type NewUser = {
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
  daily_calorie_goal?: number | null;
};

export async function createUser(u: NewUser): Promise<User> {
  const db = await getDb();
  const r = await db.runAsync(
    `INSERT INTO users (
       email, password_hash, name, sex, birth_date,
       height_cm, current_weight_kg, goal_weight_kg,
       activity_level, daily_water_goal_ml, daily_calorie_goal
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    u.email.trim().toLowerCase(),
    u.password_hash,
    u.name.trim(),
    u.sex,
    u.birth_date,
    u.height_cm,
    u.current_weight_kg,
    u.goal_weight_kg,
    u.activity_level,
    u.daily_water_goal_ml,
    u.daily_calorie_goal ?? null
  );
  const created = await getUserById(r.lastInsertRowId);
  if (!created) throw new Error('Falha ao criar usuário');
  return created;
}

export async function getUserById(id: number): Promise<User | null> {
  const db = await getDb();
  return (await db.getFirstAsync<User>('SELECT * FROM users WHERE id = ?', id)) ?? null;
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const db = await getDb();
  return (
    (await db.getFirstAsync<User>(
      'SELECT * FROM users WHERE email = ?',
      email.trim().toLowerCase()
    )) ?? null
  );
}

export async function updateUser(
  id: number,
  patch: Partial<Omit<User, 'id' | 'created_at' | 'updated_at'>>
): Promise<void> {
  const keys = Object.keys(patch);
  if (keys.length === 0) return;
  const db = await getDb();
  const set = keys.map((k) => `${k} = ?`).join(', ');
  const values = keys.map((k) => (patch as any)[k]);
  await db.runAsync(
    `UPDATE users SET ${set}, updated_at = datetime('now') WHERE id = ?`,
    ...values,
    id
  );
}

export async function countUsers(): Promise<number> {
  const db = await getDb();
  const r = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) as n FROM users');
  return r?.n ?? 0;
}
