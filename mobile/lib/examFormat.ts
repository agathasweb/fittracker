import { colors } from './theme';
import { ExamFlag } from './types';

export function flagColor(f: ExamFlag | null): string {
  if (f === 'alto' || f === 'baixo' || f === 'alterado') return colors.warning;
  if (f === 'normal') return colors.success;
  return colors.textMuted;
}

export function formatNumber(v: number): string {
  return Number.isInteger(v) ? String(v) : String(v).replace('.', ',');
}

export function formatResultValue(r: { value: number | null; value_text: string | null; unit: string | null }) {
  if (r.value != null) {
    const v = formatNumber(r.value);
    return r.unit ? `${v} ${r.unit}` : v;
  }
  return r.value_text ?? '—';
}
