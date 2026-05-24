import { differenceInYears, format, isValid, parse, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ACTIVITY_FACTOR, ActivityLevel, Sex } from './types';

export function todayISO(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

export function nowISO(): string {
  return format(new Date(), "yyyy-MM-dd HH:mm:ss");
}

export function formatTime(iso: string): string {
  try {
    return format(parseISO(iso.replace(' ', 'T')), 'HH:mm');
  } catch {
    return iso;
  }
}

export function formatDateBR(iso: string): string {
  try {
    return format(parseISO(iso), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  } catch {
    return iso;
  }
}

export function ageFromBirth(birth: string): number {
  return differenceInYears(new Date(), parseISO(birth));
}

/** Aplica máscara dd/mm/aaaa enquanto o usuário digita. */
export function maskBrDate(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

/** "24/05/1989" -> "1989-05-24". Retorna null se inválida. */
export function brDateToISO(br: string): string | null {
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(br)) return null;
  const d = parse(br, 'dd/MM/yyyy', new Date());
  if (!isValid(d)) return null;
  return format(d, 'yyyy-MM-dd');
}

/** "1989-05-24" -> "24/05/1989". */
export function isoDateToBR(iso: string): string {
  try {
    return format(parseISO(iso), 'dd/MM/yyyy');
  } catch {
    return iso;
  }
}

/** Mifflin-St Jeor */
export function tmb(sex: Sex, weightKg: number, heightCm: number, ageY: number): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * ageY;
  return Math.round(sex === 'M' ? base + 5 : base - 161);
}

export function get(tmbKcal: number, activity: ActivityLevel): number {
  return Math.round(tmbKcal * ACTIVITY_FACTOR[activity]);
}
