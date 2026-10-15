import { getDb } from '../db';
import { nowISO } from '../format';
import { ProteinEntry, ProteinSource } from '../types';

/**
 * Fontes iniciais (prescrição do médico: ovos, carne, whey, YoPro, Hidro Protein).
 * Gramas são referência média — o usuário ajusta pelo rótulo na tela de Proteína.
 */
const DEFAULT_SOURCES: { name: string; portion: string; protein_g: number }[] = [
  { name: 'Ovo', portion: '1 unidade', protein_g: 6 },
  { name: 'Carne', portion: '100 g', protein_g: 26 },
  { name: 'Whey', portion: '1 scoop (30 g)', protein_g: 24 },
  { name: 'YoPro', portion: '1 unidade', protein_g: 15 },
  { name: 'Hidro Protein', portion: '1 unidade', protein_g: 15 },
];

/** Lista as fontes do usuário, semeando as padrão na primeira vez. */
export async function listSources(userId: number): Promise<ProteinSource[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<ProteinSource>(
    'SELECT * FROM protein_sources WHERE user_id = ? ORDER BY sort_order, id',
    userId
  );
  if (rows.length > 0) return rows;
  const seeded = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM protein_entries WHERE user_id = ?',
    userId
  );
  // Já usou e apagou todas as fontes → respeita, não ressemeia.
  if ((seeded?.n ?? 0) > 0) return rows;
  await db.withTransactionAsync(async () => {
    for (const [i, s] of DEFAULT_SOURCES.entries()) {
      await db.runAsync(
        `INSERT INTO protein_sources (user_id, name, portion, protein_g, sort_order)
         VALUES (?, ?, ?, ?, ?)`,
        userId,
        s.name,
        s.portion,
        s.protein_g,
        i
      );
    }
  });
  return db.getAllAsync<ProteinSource>(
    'SELECT * FROM protein_sources WHERE user_id = ? ORDER BY sort_order, id',
    userId
  );
}

export async function createSource(
  userId: number,
  name: string,
  portion: string,
  proteinG: number
): Promise<void> {
  const db = await getDb();
  const r = await db.getFirstAsync<{ m: number | null }>(
    'SELECT MAX(sort_order) AS m FROM protein_sources WHERE user_id = ?',
    userId
  );
  await db.runAsync(
    `INSERT INTO protein_sources (user_id, name, portion, protein_g, sort_order)
     VALUES (?, ?, ?, ?, ?)`,
    userId,
    name.trim(),
    portion.trim(),
    proteinG,
    (r?.m ?? -1) + 1
  );
}

export async function updateSource(
  id: number,
  name: string,
  portion: string,
  proteinG: number
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'UPDATE protein_sources SET name = ?, portion = ?, protein_g = ? WHERE id = ?',
    name.trim(),
    portion.trim(),
    proteinG,
    id
  );
}

export async function deleteSource(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM protein_sources WHERE id = ?', id);
}

/** Registra um consumo. `label` fica gravado pra o histórico sobreviver à edição da fonte. */
export async function addEntry(
  userId: number,
  label: string,
  proteinG: number,
  sourceId?: number | null
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO protein_entries (user_id, source_id, label, protein_g, consumed_at)
     VALUES (?, ?, ?, ?, ?)`,
    userId,
    sourceId ?? null,
    label,
    proteinG,
    nowISO()
  );
}

export async function logSource(userId: number, s: ProteinSource): Promise<void> {
  await addEntry(userId, s.name, s.protein_g, s.id);
}

export async function deleteEntry(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM protein_entries WHERE id = ?', id);
}

export async function listEntriesOfDay(userId: number, dayISO: string): Promise<ProteinEntry[]> {
  const db = await getDb();
  return db.getAllAsync<ProteinEntry>(
    `SELECT * FROM protein_entries
      WHERE user_id = ? AND date(consumed_at) = date(?)
      ORDER BY consumed_at DESC`,
    userId,
    dayISO
  );
}

export async function sumProteinOfDay(userId: number, dayISO: string): Promise<number> {
  const db = await getDb();
  const r = await db.getFirstAsync<{ total: number | null }>(
    `SELECT COALESCE(SUM(protein_g), 0) AS total
       FROM protein_entries
      WHERE user_id = ? AND date(consumed_at) = date(?)`,
    userId,
    dayISO
  );
  return r?.total ?? 0;
}
