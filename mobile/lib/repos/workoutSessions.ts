import { getDb } from '../db';
import { nowISO } from '../format';
import {
  SessionExercise,
  WorkoutSession,
  WorkoutSessionFull,
  WorkoutSessionSet,
} from '../types';
import { createTemplate, getTemplateFull, NewTemplateExercise, updateTemplate } from './workoutTemplates';

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

/** Inclui um exercício novo no fim da sessão, já com N séries em branco. */
export async function addExerciseToSession(
  sessionId: number,
  name: string,
  sets = 3
): Promise<void> {
  const nome = name.trim();
  if (!nome) return;
  const db = await getDb();
  const row = await db.getFirstAsync<{ p: number }>(
    `SELECT COALESCE(MAX(exercise_position), -1) + 1 AS p FROM workout_session_sets WHERE session_id = ?`,
    sessionId
  );
  const pos = row?.p ?? 0;
  await db.withTransactionAsync(async () => {
    for (let s = 1; s <= Math.max(1, sets); s++) {
      await db.runAsync(
        `INSERT INTO workout_session_sets
           (session_id, exercise_name, exercise_position, set_number, done, reps, load_kg)
         VALUES (?, ?, ?, ?, 0, NULL, NULL)`,
        sessionId,
        nome,
        pos,
        s
      );
    }
  });
}

/** Renomeia um exercício da sessão (todas as séries dele). */
export async function renameSessionExercise(
  sessionId: number,
  oldName: string,
  position: number,
  newName: string
): Promise<void> {
  const nome = newName.trim();
  if (!nome || nome === oldName) return;
  const db = await getDb();
  await db.runAsync(
    `UPDATE workout_session_sets SET exercise_name = ?
      WHERE session_id = ? AND exercise_name = ? AND exercise_position = ?`,
    nome,
    sessionId,
    oldName,
    position
  );
}

/** Remove um exercício inteiro (todas as séries) da sessão. */
export async function deleteSessionExercise(
  sessionId: number,
  name: string,
  position: number
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `DELETE FROM workout_session_sets
      WHERE session_id = ? AND exercise_name = ? AND exercise_position = ?`,
    sessionId,
    name,
    position
  );
}

export type LastPerformance = {
  performed_at: string;
  /** Séries daquela vez (com carga e/ou reps anotadas), na ordem. */
  sets: { set_number: number; reps: number | null; load_kg: number | null }[];
};

/**
 * Para cada exercício da sessão, a última vez ANTERIOR em que ele foi feito com carga
 * ou reps anotadas (mesmo nome, sem diferenciar maiúsculas). Chave = nome do exercício.
 */
export async function lastPerformances(sessionId: number): Promise<Record<string, LastPerformance>> {
  const db = await getDb();
  const cur = await db.getFirstAsync<{ user_id: number; performed_at: string }>(
    'SELECT user_id, performed_at FROM workout_sessions WHERE id = ?',
    sessionId
  );
  if (!cur) return {};
  const nomes = await db.getAllAsync<{ exercise_name: string }>(
    'SELECT DISTINCT exercise_name FROM workout_session_sets WHERE session_id = ?',
    sessionId
  );
  const out: Record<string, LastPerformance> = {};
  for (const { exercise_name } of nomes) {
    const prev = await db.getFirstAsync<{ id: number; performed_at: string }>(
      `SELECT s.id, s.performed_at FROM workout_sessions s
         JOIN workout_session_sets x ON x.session_id = s.id
        WHERE s.user_id = ? AND s.id <> ? AND s.completed_at IS NOT NULL
          AND (s.performed_at < ? OR (s.performed_at = ? AND s.id < ?))
          AND lower(trim(x.exercise_name)) = lower(trim(?))
          AND (x.load_kg IS NOT NULL OR x.reps IS NOT NULL)
        ORDER BY s.performed_at DESC, s.id DESC
        LIMIT 1`,
      cur.user_id,
      sessionId,
      cur.performed_at,
      cur.performed_at,
      sessionId,
      exercise_name
    );
    if (!prev) continue;
    const sets = await db.getAllAsync<LastPerformance['sets'][number]>(
      `SELECT set_number, reps, load_kg FROM workout_session_sets
        WHERE session_id = ? AND lower(trim(exercise_name)) = lower(trim(?))
          AND (load_kg IS NOT NULL OR reps IS NOT NULL)
        ORDER BY set_number`,
      prev.id,
      exercise_name
    );
    if (sets.length) out[exercise_name] = { performed_at: prev.performed_at, sets };
  }
  return out;
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

/** Gasto calórico estimado (IA) da sessão de musculação. */
export async function setSessionKcal(id: number, kcal: number | null): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'UPDATE workout_sessions SET estimated_kcal = ? WHERE id = ?',
    kcal === null ? null : Math.max(0, Math.round(kcal)),
    id
  );
}

export type SessionSummary = WorkoutSession & {
  total_sets: number;
  done_sets: number;
  total_load: number;
};

/** Fecha a sessão: a partir daqui ela aparece no histórico. */
export async function completeSession(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'UPDATE workout_sessions SET completed_at = COALESCE(completed_at, ?) WHERE id = ?',
    nowISO(),
    id
  );
}

/** Corrige o dia de uma sessão lançada na data errada (mantém o horário). */
export async function setSessionDate(id: number, dayISO: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE workout_sessions SET performed_at = ? || substr(performed_at, 11) WHERE id = ?`,
    dayISO,
    id
  );
}

/** Histórico (só concluídas): sessões com contagem de séries feitas e volume total (kg×reps). */
export async function listSessions(userId: number, limit = 60): Promise<SessionSummary[]> {
  const db = await getDb();
  return db.getAllAsync<SessionSummary>(
    `SELECT s.*,
            COUNT(ss.id) AS total_sets,
            COALESCE(SUM(ss.done), 0) AS done_sets,
            COALESCE(SUM(CASE WHEN ss.done = 1 THEN ss.reps * ss.load_kg ELSE 0 END), 0) AS total_load
       FROM workout_sessions s
       LEFT JOIN workout_session_sets ss ON ss.session_id = s.id
      WHERE s.user_id = ? AND s.completed_at IS NOT NULL
      GROUP BY s.id
      ORDER BY s.performed_at DESC
      LIMIT ?`,
    userId,
    limit
  );
}

/** Sessão em andamento (ainda não concluída), a mais recente. */
export async function openSession(userId: number): Promise<WorkoutSession | null> {
  const db = await getDb();
  return db.getFirstAsync<WorkoutSession>(
    `SELECT * FROM workout_sessions
      WHERE user_id = ? AND completed_at IS NULL
      ORDER BY performed_at DESC, id DESC LIMIT 1`,
    userId
  );
}

export type TemplateSyncInfo =
  /** A sessão bate com o modelo: nada a salvar. */
  | { status: 'igual' }
  /** Exercícios/séries mudaram em relação ao modelo de origem. */
  | { status: 'diferente'; templateId: number; templateName: string }
  /** Sessão sem modelo (livre, ou o modelo foi excluído). */
  | { status: 'sem-modelo' };

const norm = (n: string) => n.trim().toLowerCase();

/** Compara exercícios (nome, ordem) e nº de séries da sessão com o modelo de origem. */
export async function templateSyncInfo(sessionId: number): Promise<TemplateSyncInfo> {
  const s = await getSessionFull(sessionId);
  if (!s || s.exercises.length === 0) return { status: 'igual' };
  const tpl = s.template_id ? await getTemplateFull(s.template_id) : null;
  if (!tpl) return { status: 'sem-modelo' };
  const igual =
    tpl.exercises.length === s.exercises.length &&
    tpl.exercises.every(
      (e, i) => norm(e.name) === norm(s.exercises[i].name) && e.target_sets === s.exercises[i].sets.length
    );
  return igual ? { status: 'igual' } : { status: 'diferente', templateId: tpl.id, templateName: tpl.name };
}

/**
 * Grava no modelo de origem a lista de exercícios desta sessão (nomes, ordem e nº de séries),
 * pra valer nos próximos treinos. Reps-alvo e observações são mantidas para os exercícios que
 * continuam (casados pelo nome; se renomeado, pela posição original). Sem modelo, cria um novo.
 */
export async function saveSessionAsTemplate(sessionId: number): Promise<number | null> {
  const s = await getSessionFull(sessionId);
  if (!s || s.exercises.length === 0) return null;
  const tpl = s.template_id ? await getTemplateFull(s.template_id) : null;

  const usados = new Set<number>();
  const lista: NewTemplateExercise[] = s.exercises.map((ex) => {
    const sobra = tpl?.exercises.filter((e) => !usados.has(e.id)) ?? [];
    const par =
      sobra.find((e) => norm(e.name) === norm(ex.name)) ??
      sobra.find((e) => e.position === ex.position && !s.exercises.some((o) => norm(o.name) === norm(e.name)));
    if (par) usados.add(par.id);
    return {
      name: ex.name,
      target_sets: Math.max(1, ex.sets.length),
      target_reps: par?.target_reps ?? null,
      notes: par?.notes ?? null,
    };
  });

  if (tpl) {
    await updateTemplate(tpl.id, tpl.name, lista, tpl.notes);
    return tpl.id;
  }
  const novoId = await createTemplate(s.user_id, s.name, lista, s.notes);
  const db = await getDb();
  await db.runAsync('UPDATE workout_sessions SET template_id = ? WHERE id = ?', novoId, sessionId);
  return novoId;
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
      WHERE s.user_id = ? AND s.completed_at IS NOT NULL
        AND ss.exercise_name = ? AND ss.done = 1 AND ss.load_kg IS NOT NULL
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
      WHERE s.user_id = ? AND s.completed_at IS NOT NULL AND ss.done = 1 AND ss.load_kg IS NOT NULL
      ORDER BY ss.exercise_name`,
    userId
  );
  return rows.map((r) => r.exercise_name);
}
