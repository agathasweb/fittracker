import { getDb } from '../db';
import { nowISO } from '../format';
import { ProteinEntry, ProteinMode, ProteinSource } from '../types';

/**
 * Fontes iniciais. Carnes: gramas de proteína por 100 g da carne PRONTA (cozida, grelhada ou
 * assada), médias da tabela TACO (Unicamp) — bovina: patinho/contrafilé 36, alcatra 32, acém e
 * moída 27; suína: lombo 36, pernil 32, bisteca 29; frango: peito 32, sobrecoxa 29, coxa 27;
 * peixe: merluza 27, salmão 26, tilápia 26. Whey do Gutto (rótulo, 17/11/2026): 30 g
 * (2 dosadores) = 21 g de proteína, ou 10,5 g por dosador. Ovo/YoPro/Hidro Protein seguem a
 * tabela do médico. Tudo editável na tela de Proteína.
 */
const DEFAULT_SOURCES: { name: string; portion: string; protein_g: number; mode: ProteinMode }[] = [
  { name: 'Ovo', portion: '1 unidade', protein_g: 6, mode: 'porcao' },
  { name: 'Carne bovina', portion: '100 g (pronta)', protein_g: 32, mode: 'gramas' },
  { name: 'Carne suína', portion: '100 g (pronta)', protein_g: 30, mode: 'gramas' },
  { name: 'Frango', portion: '100 g (pronto)', protein_g: 31, mode: 'gramas' },
  { name: 'Peixe', portion: '100 g (pronto)', protein_g: 26, mode: 'gramas' },
  { name: 'Whey', portion: '1 dosador (15 g)', protein_g: 10.5, mode: 'unidades' },
  { name: 'YoPro', portion: '1 unidade', protein_g: 20, mode: 'porcao' },
  { name: 'Hidro Protein', portion: '1 unidade', protein_g: 20, mode: 'porcao' },
];

/**
 * A 1ª versão semeou valores abaixo da tabela do médico. Corrige só as fontes que
 * continuam exatamente como semeadas (nome + gramas antigas) — editadas pelo usuário ficam.
 */
const CORRECOES_V1: { name: string; de: number; para: number; portion: string }[] = [
  { name: 'YoPro', de: 15, para: 20, portion: '1 unidade' },
  { name: 'Hidro Protein', de: 15, para: 20, portion: '1 unidade' },
];

/** Lista as fontes do usuário, semeando as padrão na primeira vez. */
export async function listSources(userId: number): Promise<ProteinSource[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<ProteinSource>(
    'SELECT * FROM protein_sources WHERE user_id = ? ORDER BY sort_order, id',
    userId
  );
  if (rows.length > 0) {
    let mudou = false;
    for (const c of CORRECOES_V1) {
      const r = await db.runAsync(
        'UPDATE protein_sources SET protein_g = ?, portion = ? WHERE user_id = ? AND name = ? AND protein_g = ?',
        c.para,
        c.portion,
        userId,
        c.name,
        c.de
      );
      if (r.changes > 0) mudou = true;
    }
    if (!mudou) return rows;
    return db.getAllAsync<ProteinSource>(
      'SELECT * FROM protein_sources WHERE user_id = ? ORDER BY sort_order, id',
      userId
    );
  }
  const seeded = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM protein_entries WHERE user_id = ?',
    userId
  );
  // Já usou e apagou todas as fontes → respeita, não ressemeia.
  if ((seeded?.n ?? 0) > 0) return rows;
  await db.withTransactionAsync(async () => {
    for (const [i, s] of DEFAULT_SOURCES.entries()) {
      await db.runAsync(
        `INSERT INTO protein_sources (user_id, name, portion, protein_g, sort_order, mode)
         VALUES (?, ?, ?, ?, ?, ?)`,
        userId,
        s.name,
        s.portion,
        s.protein_g,
        i,
        s.mode
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
  proteinG: number,
  mode: ProteinMode = 'porcao'
): Promise<void> {
  const db = await getDb();
  const r = await db.getFirstAsync<{ m: number | null }>(
    'SELECT MAX(sort_order) AS m FROM protein_sources WHERE user_id = ?',
    userId
  );
  await db.runAsync(
    `INSERT INTO protein_sources (user_id, name, portion, protein_g, sort_order, mode)
     VALUES (?, ?, ?, ?, ?, ?)`,
    userId,
    name.trim(),
    portion.trim(),
    proteinG,
    (r?.m ?? -1) + 1,
    mode
  );
}

export async function updateSource(
  id: number,
  name: string,
  portion: string,
  proteinG: number,
  mode: ProteinMode = 'porcao'
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'UPDATE protein_sources SET name = ?, portion = ?, protein_g = ?, mode = ? WHERE id = ?',
    name.trim(),
    portion.trim(),
    proteinG,
    mode,
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

/** Proteína de `qty` (gramas de carne ou número de unidades) da fonte, com 1 casa decimal. */
export function proteinOf(s: ProteinSource, qty: number): number {
  const g = s.mode === 'gramas' ? (qty * s.protein_g) / 100 : qty * s.protein_g;
  return Math.round(g * 10) / 10;
}

/** Lança uma fonte por quantidade: gramas ("Frango 150 g") ou unidades ("Whey × 2"). */
export async function logSourceQty(userId: number, s: ProteinSource, qty: number): Promise<number> {
  const g = proteinOf(s, qty);
  const q = String(qty).replace('.', ',');
  const label = s.mode === 'gramas' ? `${s.name} ${q} g` : `${s.name} × ${q}`;
  await addEntry(userId, label, g, s.id);
  return g;
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
