import { getDb } from '../db';
import { BloodPressureReading } from '../types';

export async function listReadingsOfDay(
  userId: number,
  dayISO: string
): Promise<BloodPressureReading[]> {
  const db = await getDb();
  return db.getAllAsync<BloodPressureReading>(
    `SELECT * FROM blood_pressure_readings
      WHERE user_id = ? AND date(measured_at) = date(?)
      ORDER BY measured_at`,
    userId,
    dayISO
  );
}

export async function lastReading(userId: number): Promise<BloodPressureReading | null> {
  const db = await getDb();
  return (
    (await db.getFirstAsync<BloodPressureReading>(
      `SELECT * FROM blood_pressure_readings WHERE user_id = ? ORDER BY measured_at DESC LIMIT 1`,
      userId
    )) ?? null
  );
}

export async function addManualReading(
  userId: number,
  measuredAt: string,
  systolic: number,
  diastolic: number,
  heartRate: number | null
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT OR REPLACE INTO blood_pressure_readings
       (user_id, measured_at, systolic, diastolic, heart_rate, source)
     VALUES (?, ?, ?, ?, ?, 'manual')`,
    userId,
    measuredAt,
    systolic,
    diastolic,
    heartRate
  );
}

export async function deleteReading(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM blood_pressure_readings WHERE id = ?', id);
}

export type WatchHour = {
  hour_at: string;
  steps: number;
  kcal: number;
  heart_rate: number | null;
  spo2: number | null;
};

/** Registros horários do relógio (FC/SpO2 da hora) num dia. */
export async function listWatchHoursOfDay(userId: number, dayISO: string): Promise<WatchHour[]> {
  const db = await getDb();
  return db.getAllAsync<WatchHour>(
    `SELECT hour_at, steps, kcal, heart_rate, spo2 FROM watch_hourly
      WHERE user_id = ? AND date(hour_at) = date(?)
      ORDER BY hour_at`,
    userId,
    dayISO
  );
}

/**
 * Passos do dia pelo relógio. O registro das HH traz os passos da hora anterior
 * (HH-1 → HH), por isso o dia vai do registro de 01:00 ao de 00:00 do dia seguinte.
 */
export async function watchStepsOfDay(userId: number, dayISO: string): Promise<number> {
  const db = await getDb();
  const r = await db.getFirstAsync<{ s: number | null }>(
    `SELECT SUM(steps) s FROM watch_hourly
      WHERE user_id = ? AND date(datetime(hour_at, '-1 hour')) = date(?)`,
    userId,
    dayISO
  );
  return r?.s ?? 0;
}
