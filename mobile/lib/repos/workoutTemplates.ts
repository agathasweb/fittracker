import { getDb } from '../db';
import { nowISO } from '../format';
import { WorkoutTemplate, WorkoutTemplateExercise, WorkoutTemplateFull } from '../types';

export type NewTemplateExercise = {
  name: string;
  target_sets: number;
  target_reps?: string | null;
  notes?: string | null;
};

export async function listTemplates(userId: number): Promise<WorkoutTemplate[]> {
  const db = await getDb();
  return db.getAllAsync<WorkoutTemplate>(
    'SELECT * FROM workout_templates WHERE user_id = ? ORDER BY position, id',
    userId
  );
}

export async function getTemplateFull(id: number): Promise<WorkoutTemplateFull | null> {
  const db = await getDb();
  const tpl = await db.getFirstAsync<WorkoutTemplate>(
    'SELECT * FROM workout_templates WHERE id = ?',
    id
  );
  if (!tpl) return null;
  const exercises = await db.getAllAsync<WorkoutTemplateExercise>(
    'SELECT * FROM workout_template_exercises WHERE template_id = ? ORDER BY position, id',
    id
  );
  return { ...tpl, exercises };
}

export async function countTemplates(userId: number): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM workout_templates WHERE user_id = ?',
    userId
  );
  return row?.n ?? 0;
}

/** Cria um modelo com seus exercícios numa transação. */
export async function createTemplate(
  userId: number,
  name: string,
  exercises: NewTemplateExercise[],
  notes?: string | null
): Promise<number> {
  const db = await getDb();
  let templateId = 0;

  await db.withTransactionAsync(async () => {
    const posRow = await db.getFirstAsync<{ p: number }>(
      'SELECT COALESCE(MAX(position), -1) + 1 AS p FROM workout_templates WHERE user_id = ?',
      userId
    );
    const r = await db.runAsync(
      `INSERT INTO workout_templates (user_id, name, notes, position, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      userId,
      name.trim(),
      notes?.trim() || null,
      posRow?.p ?? 0,
      nowISO(),
      nowISO()
    );
    templateId = r.lastInsertRowId;
    await inserirExercicios(db, templateId, exercises);
  });

  return templateId;
}

/** Substitui nome/notas e a lista inteira de exercícios do modelo. */
export async function updateTemplate(
  templateId: number,
  name: string,
  exercises: NewTemplateExercise[],
  notes?: string | null
): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'UPDATE workout_templates SET name = ?, notes = ?, updated_at = ? WHERE id = ?',
      name.trim(),
      notes?.trim() || null,
      nowISO(),
      templateId
    );
    await db.runAsync('DELETE FROM workout_template_exercises WHERE template_id = ?', templateId);
    await inserirExercicios(db, templateId, exercises);
  });
}

export async function deleteTemplate(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM workout_templates WHERE id = ?', id);
}

async function inserirExercicios(
  db: Awaited<ReturnType<typeof getDb>>,
  templateId: number,
  exercises: NewTemplateExercise[]
): Promise<void> {
  for (let i = 0; i < exercises.length; i++) {
    const e = exercises[i];
    await db.runAsync(
      `INSERT INTO workout_template_exercises (template_id, name, target_sets, target_reps, notes, position)
       VALUES (?, ?, ?, ?, ?, ?)`,
      templateId,
      e.name.trim(),
      Math.max(1, Math.round(e.target_sets)),
      e.target_reps?.trim() || null,
      e.notes?.trim() || null,
      i
    );
  }
}
