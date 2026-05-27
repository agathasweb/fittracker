import { getDb } from '../db';
import { nowISO, todayISO } from '../format';
import { Medication, MedicationIntake } from '../types';

export type MedicationWithToday = Medication & {
  today_count: number;
  last_taken_at: string | null;
};

export type NewMedication = {
  user_id: number;
  name: string;
  dosage?: string | null;
  notes?: string | null;
  color?: string | null;
  reminder_times?: string[] | null;
  notification_ids?: string[] | null;
};

export type MedicationPatch = Partial<
  Pick<NewMedication, 'name' | 'dosage' | 'notes' | 'color' | 'reminder_times' | 'notification_ids'>
> & {
  active?: 0 | 1;
};

function serializeStrArr(v: string[] | null | undefined): string | null {
  if (!v || v.length === 0) return null;
  return JSON.stringify(v);
}

export function parseReminderTimes(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((s) => typeof s === 'string') : [];
  } catch {
    return [];
  }
}

export function parseNotificationIds(raw: string | null): string[] {
  return parseReminderTimes(raw);
}

export async function listMedications(userId: number): Promise<MedicationWithToday[]> {
  const db = await getDb();
  const day = todayISO();
  return db.getAllAsync<MedicationWithToday>(
    `SELECT m.*,
            COUNT(CASE WHEN date(i.taken_at) = date(?) THEN 1 END) AS today_count,
            MAX(i.taken_at) AS last_taken_at
       FROM medications m
       LEFT JOIN medication_intakes i ON i.medication_id = m.id
      WHERE m.user_id = ? AND m.active = 1
      GROUP BY m.id
      ORDER BY m.name ASC`,
    day,
    userId
  );
}

export async function getMedication(id: number): Promise<Medication | null> {
  const db = await getDb();
  return (
    (await db.getFirstAsync<Medication>('SELECT * FROM medications WHERE id = ?', id)) ?? null
  );
}

export async function createMedication(data: NewMedication): Promise<Medication> {
  const db = await getDb();
  const r = await db.runAsync(
    `INSERT INTO medications
       (user_id, name, dosage, notes, color, reminder_times, notification_ids)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    data.user_id,
    data.name.trim(),
    data.dosage?.trim() || null,
    data.notes?.trim() || null,
    data.color ?? null,
    serializeStrArr(data.reminder_times),
    serializeStrArr(data.notification_ids)
  );
  const created = await getMedication(r.lastInsertRowId);
  if (!created) throw new Error('Falha ao criar suplemento');
  return created;
}

export async function updateMedication(id: number, patch: MedicationPatch): Promise<void> {
  const keys = Object.keys(patch);
  if (!keys.length) return;
  const db = await getDb();
  const set: string[] = [];
  const values: any[] = [];
  for (const k of keys) {
    set.push(`${k} = ?`);
    const v = (patch as any)[k];
    if (k === 'reminder_times' || k === 'notification_ids') {
      values.push(serializeStrArr(v));
    } else {
      values.push(v);
    }
  }
  await db.runAsync(`UPDATE medications SET ${set.join(', ')} WHERE id = ?`, ...values, id);
}

export async function deleteMedication(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM medications WHERE id = ?', id);
}

export async function setActive(id: number, active: boolean): Promise<void> {
  await updateMedication(id, { active: active ? 1 : 0 });
}

export async function recordIntake(medicationId: number, at?: string): Promise<MedicationIntake> {
  const db = await getDb();
  const r = await db.runAsync(
    'INSERT INTO medication_intakes (medication_id, taken_at) VALUES (?, ?)',
    medicationId,
    at ?? nowISO()
  );
  const created = await db.getFirstAsync<MedicationIntake>(
    'SELECT * FROM medication_intakes WHERE id = ?',
    r.lastInsertRowId
  );
  if (!created) throw new Error('Falha ao registrar tomada');
  return created;
}

export async function listIntakesOfDay(
  medicationId: number,
  dayISO: string
): Promise<MedicationIntake[]> {
  const db = await getDb();
  return db.getAllAsync<MedicationIntake>(
    `SELECT * FROM medication_intakes
      WHERE medication_id = ? AND date(taken_at) = date(?)
      ORDER BY taken_at DESC`,
    medicationId,
    dayISO
  );
}

export async function deleteIntake(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM medication_intakes WHERE id = ?', id);
}

export type ReminderStatus = {
  time: string;
  taken: boolean;
};

/**
 * Mapeia cada horário de lembrete pro status "tomado" hoje.
 *
 * Heurística simples: o N-ésimo horário (ordenado) é "tomado" se hoje já existem
 * pelo menos N tomadas registradas. Não tenta casar tomada específica com horário —
 * basta saber se o usuário cumpriu o cronograma na ordem.
 */
export function reminderStatuses(
  reminderTimesRaw: string | null,
  todayCount: number
): ReminderStatus[] {
  const times = parseReminderTimes(reminderTimesRaw).sort();
  return times.map((time, idx) => ({ time, taken: idx < todayCount }));
}
