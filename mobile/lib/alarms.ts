import { requireOptionalNativeModule } from 'expo-modules-core';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { ensurePermission } from './notifications';
import { listMedications, parseReminderTimes } from './repos/medications';

/**
 * Alarme de suplemento estilo despertador (Android): módulo nativo local
 * `modules/fittracker-alarm`. Em binários antigos (sem o módulo), iOS e web,
 * `available()` é false e o app segue com as notificações do expo-notifications.
 */
type NativeAlarm = {
  replaceAll(json: string): void;
  canScheduleExact(): boolean;
  canUseFullScreen(): boolean;
  openExactAlarmSettings(): void;
  openFullScreenSettings(): void;
  test(seconds: number): void;
};

const Native =
  Platform.OS === 'android' ? requireOptionalNativeModule<NativeAlarm>('FittrackerAlarm') : null;

export function alarmsAvailable(): boolean {
  return Native != null;
}

export type AlarmPermissions = { exact: boolean; fullScreen: boolean };

export function alarmPermissions(): AlarmPermissions | null {
  if (!Native) return null;
  return { exact: Native.canScheduleExact(), fullScreen: Native.canUseFullScreen() };
}

export function openExactAlarmSettings() {
  Native?.openExactAlarmSettings();
}

export function openFullScreenSettings() {
  Native?.openFullScreenSettings();
}

export async function testAlarm(seconds = 5): Promise<void> {
  if (!Native) return;
  await ensurePermission();
  Native.test(seconds);
}

/**
 * Reagenda os alarmes a partir do banco (fonte da verdade). Tudo que vence no mesmo
 * horário (e mesmo dia da semana) vira UM alarme listando os itens, com "Tomei todos" —
 * seis alarmes simultâneos às 07:00 seriam inviáveis. Idempotente: chamar ao abrir o
 * app e após qualquer edição.
 */
export async function syncMedicationAlarms(userId: number): Promise<void> {
  if (!Native) return;
  await ensurePermission();
  const meds = await listMedications(userId);

  type Slot = { hour: number; minute: number; weekday: number | null; time: string; items: typeof meds };
  const slots = new Map<string, Slot>();
  for (const m of meds) {
    for (const t of parseReminderTimes(m.reminder_times)) {
      const [hh, mm] = t.split(':').map(Number);
      if (!Number.isInteger(hh) || !Number.isInteger(mm)) continue;
      const key = `${m.reminder_weekday ?? 'd'}-${t}`;
      const slot = slots.get(key) ?? { hour: hh, minute: mm, weekday: m.reminder_weekday, time: t, items: [] };
      slot.items.push(m);
      slots.set(key, slot);
    }
  }

  const alarms = [...slots.entries()].map(([key, s]) => ({
    id: `slot-${key}`,
    hour: s.hour,
    minute: s.minute,
    // Nativo usa Calendar (1=domingo..7=sábado); 0 = todo dia.
    weekday: s.weekday == null ? 0 : s.weekday + 1,
    title: s.items.length > 1 ? `${s.time} · Hora dos remédios` : `${s.time} · Hora do remédio`,
    body: s.items.map((m) => (m.dosage ? `${m.name} — ${m.dosage}` : m.name)).join('\n'),
    medicationIds: s.items.map((m) => m.id),
  }));
  Native.replaceAll(JSON.stringify(alarms));
  // Migração: os lembretes antigos do expo-notifications tocariam em dobro.
  // Só suplementos agendam notificação local; push remoto não é afetado.
  await Notifications.cancelAllScheduledNotificationsAsync();
}
