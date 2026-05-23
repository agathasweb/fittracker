import { differenceInYears, format, parseISO } from 'date-fns';
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

/** Mifflin-St Jeor */
export function tmb(sex: Sex, weightKg: number, heightCm: number, ageY: number): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * ageY;
  return Math.round(sex === 'M' ? base + 5 : base - 161);
}

export function get(tmbKcal: number, activity: ActivityLevel): number {
  return Math.round(tmbKcal * ACTIVITY_FACTOR[activity]);
}
