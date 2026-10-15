import * as FileSystem from 'expo-file-system';
import { getDb } from '../db';
import { nowISO } from '../format';
import { Exam, ExamCategory, ExamFile, ExamFlag, ExamResult } from '../types';

export const CATEGORY_LABEL: Record<ExamCategory, string> = {
  laboratorio: 'Laboratório',
  imagem: 'Imagem',
  bioimpedancia: 'Bioimpedância',
  pressao: 'Pressão (MAPA)',
  receita: 'Receita / protocolo',
  outro: 'Outro',
};

const FILES_DIR = `${FileSystem.documentDirectory}exams/`;

export type ExamSummary = Exam & { results_count: number; flagged_count: number; files_count: number };

export async function listExams(userId: number): Promise<ExamSummary[]> {
  const db = await getDb();
  return db.getAllAsync<ExamSummary>(
    `SELECT e.*,
            (SELECT COUNT(*) FROM exam_results r WHERE r.exam_id = e.id) AS results_count,
            (SELECT COUNT(*) FROM exam_results r
              WHERE r.exam_id = e.id AND r.flag IN ('alto','baixo','alterado')) AS flagged_count,
            (SELECT COUNT(*) FROM exam_files f WHERE f.exam_id = e.id) AS files_count
       FROM exams e
      WHERE e.user_id = ?
      ORDER BY e.exam_date DESC, e.id DESC`,
    userId
  );
}

export async function getExam(id: number): Promise<Exam | null> {
  const db = await getDb();
  return (await db.getFirstAsync<Exam>('SELECT * FROM exams WHERE id = ?', id)) ?? null;
}

export async function findExam(userId: number, date: string, title: string): Promise<Exam | null> {
  const db = await getDb();
  return (
    (await db.getFirstAsync<Exam>(
      'SELECT * FROM exams WHERE user_id = ? AND exam_date = ? AND title = ?',
      userId,
      date,
      title
    )) ?? null
  );
}

export type ExamInput = {
  exam_date: string;
  title: string;
  category: ExamCategory;
  place?: string | null;
  notes?: string | null;
};

export async function createExam(userId: number, e: ExamInput): Promise<number> {
  const db = await getDb();
  const r = await db.runAsync(
    `INSERT INTO exams (user_id, exam_date, title, category, place, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    userId,
    e.exam_date,
    e.title.trim(),
    e.category,
    e.place?.trim() || null,
    e.notes?.trim() || null,
    nowISO()
  );
  return r.lastInsertRowId;
}

export async function updateExam(id: number, e: ExamInput): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'UPDATE exams SET exam_date = ?, title = ?, category = ?, place = ?, notes = ? WHERE id = ?',
    e.exam_date,
    e.title.trim(),
    e.category,
    e.place?.trim() || null,
    e.notes?.trim() || null,
    id
  );
}

/** Apaga o exame, valores e anexos (inclusive os arquivos no aparelho). */
export async function deleteExam(id: number): Promise<void> {
  const files = await listFiles(id);
  for (const f of files) await FileSystem.deleteAsync(f.uri, { idempotent: true });
  const db = await getDb();
  await db.runAsync('DELETE FROM exams WHERE id = ?', id);
}

// ── Valores ──

export async function listResults(examId: number): Promise<ExamResult[]> {
  const db = await getDb();
  return db.getAllAsync<ExamResult>(
    'SELECT * FROM exam_results WHERE exam_id = ? ORDER BY position, id',
    examId
  );
}

export type ResultInput = {
  marker: string;
  value?: number | null;
  value_text?: string | null;
  unit?: string | null;
  reference?: string | null;
  flag?: ExamFlag | null;
};

export async function addResult(examId: number, r: ResultInput): Promise<void> {
  const db = await getDb();
  const pos = await db.getFirstAsync<{ m: number | null }>(
    'SELECT MAX(position) AS m FROM exam_results WHERE exam_id = ?',
    examId
  );
  await db.runAsync(
    `INSERT INTO exam_results (exam_id, marker, value, value_text, unit, reference, flag, position)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    examId,
    r.marker.trim(),
    r.value ?? null,
    r.value_text?.trim() || null,
    r.unit?.trim() || null,
    r.reference?.trim() || null,
    r.flag ?? null,
    (pos?.m ?? -1) + 1
  );
}

export async function deleteResult(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM exam_results WHERE id = ?', id);
}

// ── Evolução por marcador ──

export type MarkerPoint = {
  exam_id: number;
  exam_date: string;
  value: number | null;
  value_text: string | null;
  unit: string | null;
  flag: ExamFlag | null;
};

export type MarkerSummary = { marker: string; points: MarkerPoint[] };

/** Todos os marcadores do usuário, cada um com sua série (mais antigo → mais recente). */
export async function listMarkers(userId: number): Promise<MarkerSummary[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<MarkerPoint & { marker: string }>(
    `SELECT r.marker, r.exam_id, e.exam_date, r.value, r.value_text, r.unit, r.flag
       FROM exam_results r
       JOIN exams e ON e.id = r.exam_id
      WHERE e.user_id = ?
      ORDER BY e.exam_date, r.id`,
    userId
  );
  const by = new Map<string, MarkerSummary>();
  for (const r of rows) {
    const key = r.marker.trim().toLowerCase();
    const m = by.get(key) ?? { marker: r.marker.trim(), points: [] };
    m.points.push(r);
    by.set(key, m);
  }
  return [...by.values()].sort((a, b) => a.marker.localeCompare(b.marker, 'pt-BR'));
}

// ── Anexos ──

export async function listFiles(examId: number): Promise<ExamFile[]> {
  const db = await getDb();
  return db.getAllAsync<ExamFile>('SELECT * FROM exam_files WHERE exam_id = ? ORDER BY id', examId);
}

function safeName(name: string): string {
  return name.replace(/[^\w.\-]+/g, '_').slice(-80);
}

/** Copia o arquivo (cache do picker) pra pasta do app — o cache pode ser limpo pelo Android. */
export async function attachFile(
  examId: number,
  sourceUri: string,
  name: string,
  mime: string
): Promise<void> {
  await FileSystem.makeDirectoryAsync(FILES_DIR, { intermediates: true });
  const dest = `${FILES_DIR}${examId}-${Date.now()}-${safeName(name)}`;
  await FileSystem.copyAsync({ from: sourceUri, to: dest });
  await insertFile(examId, dest, name, mime);
}

/** Grava um anexo vindo em base64 (importação). */
export async function attachBase64(
  examId: number,
  base64: string,
  name: string,
  mime: string
): Promise<void> {
  await FileSystem.makeDirectoryAsync(FILES_DIR, { intermediates: true });
  const dest = `${FILES_DIR}${examId}-${Date.now()}-${safeName(name)}`;
  await FileSystem.writeAsStringAsync(dest, base64, { encoding: FileSystem.EncodingType.Base64 });
  await insertFile(examId, dest, name, mime);
}

async function insertFile(examId: number, uri: string, name: string, mime: string) {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO exam_files (exam_id, uri, name, mime, created_at) VALUES (?, ?, ?, ?, ?)',
    examId,
    uri,
    name,
    mime,
    nowISO()
  );
}

export async function deleteFile(f: ExamFile): Promise<void> {
  await FileSystem.deleteAsync(f.uri, { idempotent: true });
  const db = await getDb();
  await db.runAsync('DELETE FROM exam_files WHERE id = ?', f.id);
}
