import { format, parseISO, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { ageFromBirth, get, tmb, todayISO } from '../format';
import { getDb } from '../db';
import { sumMlOfDay } from '../repos/hydration';
import { totalsOfDay } from '../repos/meals';
import { User } from '../types';

type DayData = {
  iso: string;
  label: string; // "Seg 19"
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  water_ml: number;
  med_intakes: number;
};

async function countMedIntakesOfDay(userId: number, dayISO: string): Promise<number> {
  const db = await getDb();
  const r = await db.getFirstAsync<{ n: number }>(
    `SELECT COUNT(*) AS n
       FROM medication_intakes i
       JOIN medications m ON m.id = i.medication_id
      WHERE m.user_id = ? AND date(i.taken_at) = date(?)`,
    userId,
    dayISO
  );
  return r?.n ?? 0;
}

async function buildWeekData(userId: number): Promise<DayData[]> {
  const today = todayISO();
  const days: DayData[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = format(subDays(parseISO(today), i), 'yyyy-MM-dd');
    const [totals, water, meds] = await Promise.all([
      totalsOfDay(userId, d),
      sumMlOfDay(userId, d),
      countMedIntakesOfDay(userId, d),
    ]);
    days.push({
      iso: d,
      label: format(parseISO(d), 'EEE dd', { locale: ptBR }).replace('.', ''),
      kcal: Math.round(totals.kcal),
      protein: Math.round(totals.protein),
      carbs: Math.round(totals.carbs),
      fat: Math.round(totals.fat),
      fiber: Math.round(totals.fiber),
      water_ml: water,
      med_intakes: meds,
    });
  }
  return days;
}

function avg(arr: number[]): number {
  const valid = arr.filter((n) => n > 0);
  if (!valid.length) return 0;
  return Math.round(valid.reduce((a, b) => a + b, 0) / valid.length);
}

/** Barras simples em SVG, com label de valor e linha de meta. */
function barChartSVG(
  days: DayData[],
  pick: (d: DayData) => number,
  goal: number | null,
  color: string,
  unit = ''
): string {
  const width = 700;
  const height = 220;
  const padL = 40;
  const padR = 20;
  const padT = 20;
  const padB = 40;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;
  const max = Math.max(goal ?? 0, ...days.map(pick), 1) * 1.1;
  const barW = innerW / days.length - 12;

  const bars = days
    .map((d, i) => {
      const v = pick(d);
      const h = (v / max) * innerH;
      const x = padL + i * (innerW / days.length) + 6;
      const y = padT + innerH - h;
      return `
        <rect x="${x}" y="${y}" width="${barW}" height="${h}" rx="4" fill="${color}" opacity="0.85" />
        <text x="${x + barW / 2}" y="${y - 4}" text-anchor="middle" font-size="11" fill="#475569">${v}${unit}</text>
        <text x="${x + barW / 2}" y="${padT + innerH + 18}" text-anchor="middle" font-size="11" fill="#475569">${d.label}</text>
      `;
    })
    .join('');

  const goalLine =
    goal && goal > 0
      ? (() => {
          const y = padT + innerH - (goal / max) * innerH;
          return `
            <line x1="${padL}" y1="${y}" x2="${padL + innerW}" y2="${y}"
                  stroke="#94A3B8" stroke-width="1" stroke-dasharray="4 4" />
            <text x="${padL + innerW - 4}" y="${y - 4}" text-anchor="end" font-size="10" fill="#64748B">
              meta ${goal}${unit}
            </text>
          `;
        })()
      : '';

  return `
    <svg viewBox="0 0 ${width} ${height}" width="100%" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${width}" height="${height}" fill="#FFFFFF" rx="8" />
      ${goalLine}
      ${bars}
    </svg>
  `;
}

function macrosLegend(days: DayData[]): string {
  const protein = avg(days.map((d) => d.protein));
  const carbs = avg(days.map((d) => d.carbs));
  const fat = avg(days.map((d) => d.fat));
  const fiber = avg(days.map((d) => d.fiber));
  return `
    <div class="macros">
      <div class="macro"><span class="dot" style="background:#60A5FA"></span> Proteína: ${protein} g/dia</div>
      <div class="macro"><span class="dot" style="background:#F472B6"></span> Carbo: ${carbs} g/dia</div>
      <div class="macro"><span class="dot" style="background:#FBBF24"></span> Gordura: ${fat} g/dia</div>
      <div class="macro"><span class="dot" style="background:#34D399"></span> Fibra: ${fiber} g/dia</div>
    </div>
  `;
}

function htmlEscape(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return map[c];
  });
}

function buildHtml(user: User, days: DayData[]): string {
  const age = ageFromBirth(user.birth_date);
  const userTmb = tmb(user.sex, user.current_weight_kg, user.height_cm, age);
  const userGet = get(userTmb, user.activity_level);
  const goalKcal = user.daily_calorie_goal ?? Math.round(userGet - 500);
  const goalWater = user.daily_water_goal_ml;

  const avgKcal = avg(days.map((d) => d.kcal));
  const avgWater = avg(days.map((d) => d.water_ml));
  const totalMedIntakes = days.reduce((a, d) => a + d.med_intakes, 0);
  const balance = avgKcal - goalKcal;

  const periodLabel = `${format(parseISO(days[0].iso), "dd 'de' MMMM", { locale: ptBR })} – ${format(
    parseISO(days[days.length - 1].iso),
    "dd 'de' MMMM 'de' yyyy",
    { locale: ptBR }
  )}`;

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>Relatório semanal — ${htmlEscape(user.name)}</title>
<style>
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, "Segoe UI", Roboto, sans-serif;
    color: #0F172A;
    margin: 0;
    padding: 32px;
    background: #F8FAFC;
  }
  h1 { font-size: 24px; margin: 0 0 4px; }
  h2 { font-size: 16px; margin: 24px 0 8px; color: #1E293B; }
  .sub { color: #64748B; font-size: 13px; margin-bottom: 24px; }
  .grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
    margin-bottom: 24px;
  }
  .stat {
    background: #FFFFFF;
    border: 1px solid #E2E8F0;
    border-radius: 8px;
    padding: 12px;
  }
  .stat .label {
    color: #64748B;
    font-size: 11px;
    letter-spacing: 1px;
    text-transform: uppercase;
    font-weight: 600;
  }
  .stat .value {
    color: #0F172A;
    font-size: 22px;
    font-weight: 700;
    margin-top: 4px;
  }
  .stat .hint { color: #64748B; font-size: 11px; margin-top: 2px; }
  .balance-positive { color: #DC2626; }
  .balance-negative { color: #16A34A; }
  .chart {
    background: #FFFFFF;
    border: 1px solid #E2E8F0;
    border-radius: 8px;
    padding: 16px;
    margin-bottom: 16px;
  }
  .macros {
    background: #FFFFFF;
    border: 1px solid #E2E8F0;
    border-radius: 8px;
    padding: 12px 16px;
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    font-size: 13px;
    color: #1E293B;
  }
  .macro { display: flex; align-items: center; gap: 6px; }
  .dot { width: 10px; height: 10px; border-radius: 5px; display: inline-block; }
  .footer { color: #94A3B8; font-size: 11px; margin-top: 32px; text-align: center; }
</style>
</head>
<body>
  <h1>Relatório semanal · FitTracker</h1>
  <div class="sub">${htmlEscape(user.name)} · ${periodLabel}</div>

  <div class="grid">
    <div class="stat">
      <div class="label">Calorias/dia</div>
      <div class="value">${avgKcal}</div>
      <div class="hint">meta ${goalKcal} kcal</div>
    </div>
    <div class="stat">
      <div class="label">Balanço</div>
      <div class="value ${balance < 0 ? 'balance-negative' : 'balance-positive'}">
        ${balance > 0 ? '+' : ''}${balance}
      </div>
      <div class="hint">${balance < 0 ? 'déficit · emagrecendo' : 'superávit'}</div>
    </div>
    <div class="stat">
      <div class="label">Água/dia</div>
      <div class="value">${avgWater}</div>
      <div class="hint">meta ${goalWater} ml</div>
    </div>
    <div class="stat">
      <div class="label">Suplementos</div>
      <div class="value">${totalMedIntakes}</div>
      <div class="hint">tomadas na semana</div>
    </div>
  </div>

  <h2>Calorias por dia</h2>
  <div class="chart">${barChartSVG(days, (d) => d.kcal, goalKcal, '#A3E635', '')}</div>

  <h2>Macros médios</h2>
  ${macrosLegend(days)}

  <h2>Hidratação por dia</h2>
  <div class="chart">${barChartSVG(days, (d) => d.water_ml, goalWater, '#60A5FA', '')}</div>

  <h2>Fibras por dia</h2>
  <div class="chart">${barChartSVG(days, (d) => d.fiber, null, '#34D399', 'g')}</div>

  <h2>Suplementos por dia</h2>
  <div class="chart">${barChartSVG(days, (d) => d.med_intakes, null, '#A78BFA', '')}</div>

  <div class="footer">
    Gerado pelo FitTracker em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}
  </div>
</body>
</html>
  `;
}

export type GeneratedReport = {
  uri: string;
  filename: string;
};

export async function generateWeeklyReportPdf(user: User): Promise<GeneratedReport> {
  const days = await buildWeekData(user.id);
  const html = buildHtml(user, days);
  const result = await Print.printToFileAsync({ html, base64: false });
  const safeName = user.name.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'relatorio';
  const filename = `fittracker-${safeName}-${todayISO()}.pdf`;
  return { uri: result.uri, filename };
}

export async function shareReport(report: GeneratedReport): Promise<void> {
  const available = await Sharing.isAvailableAsync();
  if (!available) {
    throw new Error('Compartilhamento não está disponível neste dispositivo.');
  }
  await Sharing.shareAsync(report.uri, {
    mimeType: 'application/pdf',
    dialogTitle: 'Enviar relatório semanal',
    UTI: 'com.adobe.pdf',
  });
}
