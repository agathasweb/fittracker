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
