import { getDb } from './db';

/**
 * Agregação do histórico do usuário por dia, para o painel de Progresso.
 *
 * Uma query por domínio (GROUP BY data) cobrindo o intervalo inteiro — não é
 * viável varrer dia a dia quando o histórico tem meses. Depois montamos o
 * calendário completo do intervalo, **incluindo os dias sem registro** (furos),
 * porque enxergar o furo é parte do objetivo (mostra a importância de lançar).
 */

export type DayRecord = {
  date: string; // yyyy-MM-dd
  hydration_ml: number;
  meals_kcal: number;
  workout_sets: number;
  supplement_intakes: number;
  hasData: boolean;
};

export type WeekBlock = {
  /** segunda-feira da semana (yyyy-MM-dd) */
  weekStart: string;
  days: DayRecord[]; // sempre 7, seg→dom
  hasData: boolean;
};

type Row = { d: string; v: number };

async function porDia(
  sql: string,
  userId: number,
  startISO: string,
  endISO: string
): Promise<Map<string, number>> {
  const db = await getDb();
  const rows = await db.getAllAsync<Row>(sql, userId, startISO, endISO);
  const m = new Map<string, number>();
  for (const r of rows) m.set(r.d, r.v);
  return m;
}

/** Data do primeiro registro do usuário em qualquer domínio (ou null se vazio). */
export async function firstActivityDate(userId: number): Promise<string | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ d: string | null }>(
    `SELECT MIN(d) AS d FROM (
        SELECT MIN(date(consumed_at)) d FROM hydration_entries WHERE user_id = ?1
        UNION ALL SELECT MIN(date(consumed_at)) FROM meals WHERE user_id = ?1
        UNION ALL SELECT MIN(date(performed_at)) FROM workout_sessions WHERE user_id = ?1
        UNION ALL SELECT MIN(date(i.taken_at)) FROM medication_intakes i
                  JOIN medications m ON m.id = i.medication_id WHERE m.user_id = ?1
     )`,
    userId
  );
  return row?.d ?? null;
}

/** Registros diários no intervalo [startISO, endISO], já com os furos preenchidos. */
export async function dailyRecords(
  userId: number,
  startISO: string,
  endISO: string
): Promise<DayRecord[]> {
  const hidratacao = await porDia(
    `SELECT date(consumed_at) d, SUM(ml) v FROM hydration_entries
      WHERE user_id = ? AND date(consumed_at) BETWEEN ? AND ? GROUP BY d`,
    userId, startISO, endISO
  );

  // Refeições: kcal de itens + kcal de preparos manuais (duas fontes, somadas).
  const kcalItens = await porDia(
    `SELECT date(m.consumed_at) d,
            SUM(i.quantity_g * f.kcal_per_100g / 100.0) v
       FROM meals m
       JOIN meal_items i ON i.meal_id = m.id
       JOIN foods f ON f.id = i.food_id
       LEFT JOIN meal_templates t ON t.id = m.meal_template_id
      WHERE m.user_id = ? AND date(m.consumed_at) BETWEEN ? AND ?
        AND (t.id IS NULL OR t.manual_kcal IS NULL)
      GROUP BY d`,
    userId, startISO, endISO
  );
  const kcalManual = await porDia(
    `SELECT date(m.consumed_at) d, SUM(t.manual_kcal) v
       FROM meals m
       JOIN meal_templates t ON t.id = m.meal_template_id
      WHERE m.user_id = ? AND date(m.consumed_at) BETWEEN ? AND ?
        AND t.manual_kcal IS NOT NULL
      GROUP BY d`,
    userId, startISO, endISO
  );

  const treinos = await porDia(
    `SELECT date(s.performed_at) d, COALESCE(SUM(ss.done), 0) v
       FROM workout_sessions s
       LEFT JOIN workout_session_sets ss ON ss.session_id = s.id
      WHERE s.user_id = ? AND date(s.performed_at) BETWEEN ? AND ?
      GROUP BY d`,
    userId, startISO, endISO
  );

  const suplementos = await porDia(
    `SELECT date(i.taken_at) d, COUNT(*) v
       FROM medication_intakes i
       JOIN medications m ON m.id = i.medication_id
      WHERE m.user_id = ? AND date(i.taken_at) BETWEEN ? AND ?
      GROUP BY d`,
    userId, startISO, endISO
  );

  const out: DayRecord[] = [];
  for (const date of eachDayISO(startISO, endISO)) {
    const hydration_ml = Math.round(hidratacao.get(date) ?? 0);
    const meals_kcal = Math.round((kcalItens.get(date) ?? 0) + (kcalManual.get(date) ?? 0));
    const workout_sets = Math.round(treinos.get(date) ?? 0);
    const supplement_intakes = Math.round(suplementos.get(date) ?? 0);
    out.push({
      date,
      hydration_ml,
      meals_kcal,
      workout_sets,
      supplement_intakes,
      hasData: hydration_ml > 0 || meals_kcal > 0 || workout_sets > 0 || supplement_intakes > 0,
    });
  }
  return out;
}

/** Agrupa os registros diários em semanas (segunda→domingo). */
export function groupByWeek(records: DayRecord[]): WeekBlock[] {
  const porData = new Map(records.map((r) => [r.date, r]));
  const semanas = new Map<string, DayRecord[]>();

  for (const r of records) {
    const ws = mondayOf(r.date);
    if (!semanas.has(ws)) semanas.set(ws, []);
  }

  const blocks: WeekBlock[] = [];
  for (const ws of semanas.keys()) {
    const days: DayRecord[] = [];
    for (let i = 0; i < 7; i++) {
      const date = addDaysISO(ws, i);
      days.push(
        porData.get(date) ?? {
          date,
          hydration_ml: 0,
          meals_kcal: 0,
          workout_sets: 0,
          supplement_intakes: 0,
          hasData: false,
        }
      );
    }
    blocks.push({ weekStart: ws, days, hasData: days.some((d) => d.hasData) });
  }

  // Mais recente primeiro.
  blocks.sort((a, b) => (a.weekStart < b.weekStart ? 1 : -1));
  return blocks;
}

// ── helpers de data (sem depender de fuso; trabalham em yyyy-MM-dd) ──
function toDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
function fromDate(dt: Date): string {
  return dt.toISOString().slice(0, 10);
}
export function addDaysISO(iso: string, n: number): string {
  const dt = toDate(iso);
  dt.setUTCDate(dt.getUTCDate() + n);
  return fromDate(dt);
}
function mondayOf(iso: string): string {
  const dt = toDate(iso);
  const dow = (dt.getUTCDay() + 6) % 7; // 0 = segunda
  dt.setUTCDate(dt.getUTCDate() - dow);
  return fromDate(dt);
}
function* eachDayISO(startISO: string, endISO: string): Generator<string> {
  let cur = startISO;
  let guard = 0;
  while (cur <= endISO && guard < 4000) {
    yield cur;
    cur = addDaysISO(cur, 1);
    guard++;
  }
}
