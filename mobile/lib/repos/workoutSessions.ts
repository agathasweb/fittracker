import { getDb } from '../db';
import { nowISO } from '../format';
import {
  SessionExercise,
  WorkoutSession,
  WorkoutSessionFull,
  WorkoutSessionSet,
} from '../types';
import { getTemplateFull } from './workoutTemplates';

type SetRow = Omit<WorkoutSessionSet, 'done'> & { done: number };

function hidratarSet(r: SetRow): WorkoutSessionSet {
  return { ...r, done: r.done === 1 };
}

/**
 * Cria uma sessão a partir de um modelo, já gerando uma série (vazia) por
 * série-alvo de cada exercício. O usuário marca cada uma como feita e informa
 * reps/carga. Snapshot do nome do exercício — editar o modelo depois não mexe aqui.
 */
export async function startSessionFromTemplate(
  userId: number,
  templateId: number,
  performedAt?: string
): Promise<number> {
  const tpl = await getTemplateFull(templateId);
  if (!tpl) throw new Error('Modelo de treino não encontrado');

  const db = await getDb();
  let sessionId = 0;

  await db.withTransactionAsync(async () => {
    const r = await db.runAsync(
      `INSERT INTO workout_sessions (user_id, template_id, name, performed_at, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      userId,
      templateId,
      tpl.name,
      performedAt ?? nowISO(),
      nowISO()
    );
    sessionId = r.lastInsertRowId;

    for (const ex of tpl.exercises) {
      const total = Math.max(1, ex.target_sets);
      for (let s = 1; s <= total; s++) {
        await db.runAsync(
          `INSERT INTO workout_session_sets
             (session_id, exercise_name, exercise_position, set_number, done, reps, load_kg)
           VALUES (?, ?, ?, ?, 0, NULL, NULL)`,
          sessionId,
          ex.name,
          ex.position,
          s
        );
      }
    }
  });

  return sessionId;
}

/** Sessão vazia (treino livre, sem modelo). */
export async function startBlankSession(userId: number, name: string): Promise<number> {
  const db = await getDb();
  const r = await db.runAsync(
    `INSERT INTO workout_sessions (user_id, template_id, name, performed_at, created_at)
     VALUES (?, NULL, ?, ?, ?)`,
    userId,
    name.trim() || 'Treino',
    nowISO(),
    nowISO()
  );
  return r.lastInsertRowId;
}

export async function getSessionFull(id: number): Promise<WorkoutSessionFull | null> {
  const db = await getDb();
  const session = await db.getFirstAsync<WorkoutSession>(
    'SELECT * FROM workout_sessions WHERE id = ?',
    id
  );
  if (!session) return null;

  const rows = await db.getAllAsync<SetRow>(
    `SELECT * FROM workout_session_sets
      WHERE session_id = ?
      ORDER BY exercise_position, set_number`,
    id
  );

  // Agrupa as séries por exercício, preservando a ordem.
  const porExercicio = new Map<string, SessionExercise>();
  for (const r of rows) {
    const chave = `${r.exercise_position}::${r.exercise_name}`;
    if (!porExercicio.has(chave)) {
      porExercicio.set(chave, { name: r.exercise_name, position: r.exercise_position, sets: [] });
    }
    porExercicio.get(chave)!.sets.push(hidratarSet(r));
  }

  return { ...session, exercises: Array.from(porExercicio.values()) };
}

/** Marca/desmarca uma série e grava reps/carga. */
export async function updateSet(
  setId: number,
  patch: { done?: boolean; reps?: number | null; load_kg?: number | null }
): Promise<void> {
  const db = await getDb();
  const campos: string[] = [];
  const valores: (number | null)[] = [];

  if (patch.done !== undefined) {
    campos.push('done = ?');
    valores.push(patch.done ? 1 : 0);
  }
  if (patch.reps !== undefined) {
    campos.push('reps = ?');
    valores.push(patch.reps === null ? null : Math.max(0, Math.round(patch.reps)));
  }
  if (patch.load_kg !== undefined) {
    campos.push('load_kg = ?');
    valores.push(patch.load_kg === null ? null : Math.max(0, patch.load_kg));
  }
  if (!campos.length) return;

  await db.runAsync(
    `UPDATE workout_session_sets SET ${campos.join(', ')} WHERE id = ?`,
    ...valores,
    setId
  );
}

/** Adiciona uma série extra a um exercício da sessão. */
export async function addSetToExercise(
  sessionId: number,
  exerciseName: string,
  exercisePosition: number
): Promise<void> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ n: number }>(
    `SELECT COALESCE(MAX(set_number), 0) + 1 AS n FROM workout_session_sets
      WHERE session_id = ? AND exercise_name = ? AND exercise_position = ?`,
    sessionId,
    exerciseName,
    exercisePosition
  );
  await db.runAsync(
    `INSERT INTO workout_session_sets
       (session_id, exercise_name, exercise_position, set_number, done, reps, load_kg)
     VALUES (?, ?, ?, ?, 0, NULL, NULL)`,
    sessionId,
    exerciseName,
    exercisePosition,
    row?.n ?? 1
  );
}

export async function deleteSet(setId: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM workout_session_sets WHERE id = ?', setId);
}

export async function setSessionNotes(sessionId: number, notes: string | null): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'UPDATE workout_sessions SET notes = ? WHERE id = ?',
    notes?.trim() || null,
    sessionId
  );
}

export async function deleteSession(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM workout_sessions WHERE id = ?', id);
}

export type SessionSummary = WorkoutSession & {
  total_sets: number;
  done_sets: number;
  total_load: number;
};

/** Histórico: sessões com contagem de séries feitas e volume total (kg×reps). */
export async function listSessions(userId: number, limit = 60): Promise<SessionSummary[]> {
  const db = await getDb();
  return db.getAllAsync<SessionSummary>(
    `SELECT s.*,
            COUNT(ss.id) AS total_sets,
            COALESCE(SUM(ss.done), 0) AS done_sets,
            COALESCE(SUM(CASE WHEN ss.done = 1 THEN ss.reps * ss.load_kg ELSE 0 END), 0) AS total_load
       FROM workout_sessions s
       LEFT JOIN workout_session_sets ss ON ss.session_id = s.id
      WHERE s.user_id = ?
      GROUP BY s.id
      ORDER BY s.performed_at DESC
      LIMIT ?`,
    userId,
    limit
  );
}

export async function todaySession(userId: number, dayISO: string): Promise<WorkoutSession | null> {
  const db = await getDb();
  return db.getFirstAsync<WorkoutSession>(
    `SELECT * FROM workout_sessions
      WHERE user_id = ? AND date(performed_at) = date(?)
      ORDER BY id DESC LIMIT 1`,
    userId,
    dayISO
  );
}

export type ExerciseProgressPoint = {
  performed_at: string;
  max_load: number;
  top_reps: number;
};

/** Evolução de um exercício: maior carga feita por dia (para o gráfico). */
export async function exerciseProgress(
  userId: number,
  exerciseName: string,
  limit = 30
): Promise<ExerciseProgressPoint[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<ExerciseProgressPoint>(
    `SELECT date(s.performed_at) AS performed_at,
            MAX(ss.load_kg) AS max_load,
            MAX(ss.reps) AS top_reps
       FROM workout_session_sets ss
       JOIN workout_sessions s ON s.id = ss.session_id
      WHERE s.user_id = ? AND ss.exercise_name = ? AND ss.done = 1 AND ss.load_kg IS NOT NULL
      GROUP BY date(s.performed_at)
      ORDER BY date(s.performed_at) ASC
      LIMIT ?`,
    userId,
    exerciseName,
    limit
  );
  return rows;
}

/** Nomes distintos de exercícios que o usuário já registrou (para o seletor de evolução). */
export async function loggedExerciseNames(userId: number): Promise<string[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ exercise_name: string }>(
    `SELECT DISTINCT ss.exercise_name
       FROM workout_session_sets ss
       JOIN workout_sessions s ON s.id = ss.session_id
      WHERE s.user_id = ? AND ss.done = 1 AND ss.load_kg IS NOT NULL
      ORDER BY ss.exercise_name`,
    userId
  );
  return rows.map((r) => r.exercise_name);
}
