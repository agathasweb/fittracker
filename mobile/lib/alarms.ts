import { requireOptionalNativeModule } from 'expo-modules-core';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { ensurePermission } from './notifications';
import {
  HYDRATION_BODY,
  HYDRATION_HOURS,
  HYDRATION_TITLE,
  hydrationReminderEnabled,
  syncHydrationReminders,
} from './hydrationReminder';
import { listMedications, parseReminderDays, parseReminderTimes } from './repos/medications';

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
  /** Só no módulo novo (v0.5.3+), que também entende alarmes kind "notify". */
  watchMeasureNow?: unknown;
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
 * horário vira UM alarme listando os itens, com "Tomei todos" — seis alarmes simultâneos
 * às 07:00 seriam inviáveis. Se algum item do horário só vale em certos dias, o horário
 * vira um alarme semanal por dia, cada um com o que vale naquele dia. Idempotente:
 * chamar ao abrir o app e após qualquer edição.
 */
export async function syncMedicationAlarms(userId: number): Promise<void> {
  if (!Native) {
    await syncHydrationReminders(userId);
    return;
  }
  await ensurePermission();
  const meds = await listMedications(userId);

  type Item = { med: (typeof meds)[number]; days: number[] | null };
  const byTime = new Map<string, Item[]>();
  for (const m of meds) {
    const days = parseReminderDays(m.reminder_days);
    for (const t of parseReminderTimes(m.reminder_times)) {
      const [hh, mm] = t.split(':').map(Number);
      if (!Number.isInteger(hh) || !Number.isInteger(mm)) continue;
      byTime.set(t, [...(byTime.get(t) ?? []), { med: m, days }]);
    }
  }

  const alarms: Record<string, unknown>[] = [];
  for (const [time, items] of byTime) {
    const [hour, minute] = time.split(':').map(Number);
    const groups: { weekday: number | null; meds: Item['med'][] }[] = items.every((i) => i.days == null)
      ? [{ weekday: null, meds: items.map((i) => i.med) }]
      : [0, 1, 2, 3, 4, 5, 6]
          .map((d) => ({
            weekday: d as number | null,
            meds: items.filter((i) => i.days == null || i.days.includes(d)).map((i) => i.med),
          }))
          .filter((g) => g.meds.length > 0);
    for (const g of groups) {
      alarms.push({
        id: `slot-${g.weekday ?? 'd'}-${time}`,
        hour,
        minute,
        // Nativo usa Calendar (1=domingo..7=sábado); 0 = todo dia.
        weekday: g.weekday == null ? 0 : g.weekday + 1,
        title: g.meds.length > 1 ? `${time} · Hora dos lembretes` : `${time} · ${g.meds[0].name}`,
        body: g.meds
          .map((m) => {
            const linha = m.dosage ? `${m.name} — ${m.dosage}` : m.name;
            // Observação de como tomar (ex.: "com refeição que tenha gordura") vai junto no alarme.
            return m.notes ? `${linha}\n↳ ${m.notes}` : linha;
          })
          .join('\n'),
        medicationIds: g.meds.map((m) => m.id),
      });
    }
  }
  // Água pelo nativo (notificação comum + mensagem no relógio), se o módulo entende "notify".
  const nativeWater = typeof Native.watchMeasureNow === 'function';
  if (nativeWater && (await hydrationReminderEnabled(userId))) {
    for (const h of HYDRATION_HOURS) {
      alarms.push({
        id: `water-${h}`,
        hour: h,
        minute: 0,
        weekday: 0,
        title: HYDRATION_TITLE,
        body: HYDRATION_BODY,
        medicationIds: [],
        kind: 'notify',
      });
    }
  }
  Native.replaceAll(JSON.stringify(alarms));
  // Migração: os lembretes antigos do expo-notifications tocariam em dobro.
  // Só suplementos e água agendam notificação local; push remoto não é afetado.
  await Notifications.cancelAllScheduledNotificationsAsync();
  // Módulo antigo: a água continua pelo expo-notifications (o cancelAll acima a levou).
  if (!nativeWater) await syncHydrationReminders(userId);
}
