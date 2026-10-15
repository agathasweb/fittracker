import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { ensurePermission } from './notifications';

/**
 * Lembrete de água: notificação comum (não o alarme de tela cheia) a cada 2 h,
 * das 08:00 às 22:00. Liga/desliga por usuário na tela Hidratação. Com o módulo nativo
 * novo, quem agenda é o syncMedicationAlarms (e a mensagem também vai pro relógio);
 * senão, gatilhos diários do expo-notifications com identificador próprio.
 */
export const HYDRATION_HOURS = [8, 10, 12, 14, 16, 18, 20, 22];
export const HYDRATION_TITLE = '💧 Hora de beber água';
export const HYDRATION_BODY = 'Beba um copo agora e registre no FitTracker.';
const CHANNEL = 'hydration';
const key = (userId: number) => `hydration_reminder:${userId}`;
const ident = (h: number) => `hydration-${String(h).padStart(2, '0')}`;

export async function hydrationReminderEnabled(userId: number): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(key(userId))) === '1';
  } catch {
    return false;
  }
}

/** Só grava a preferência; quem agenda é o syncMedicationAlarms (chamar em seguida). */
export async function setHydrationReminder(userId: number, on: boolean): Promise<void> {
  await AsyncStorage.setItem(key(userId), on ? '1' : '0');
}

/**
 * Agenda pelo expo-notifications (sem módulo nativo novo). Idempotente: cancela os
 * gatilhos de água e recria se `enabled`.
 */
export async function syncHydrationReminders(userId: number, enabled = true): Promise<void> {
  if (Platform.OS === 'web') return;
  await Promise.all(
    HYDRATION_HOURS.map((h) => Notifications.cancelScheduledNotificationAsync(ident(h)).catch(() => {}))
  );
  if (!enabled || !(await hydrationReminderEnabled(userId))) return;
  if (!(await ensurePermission())) return;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL, {
      name: 'Lembrete de água',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#38BDF8',
    });
  }
  for (const h of HYDRATION_HOURS) {
    await Notifications.scheduleNotificationAsync({
      identifier: ident(h),
      content: {
        title: HYDRATION_TITLE,
        body: HYDRATION_BODY,
        sound: 'default',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: h,
        minute: 0,
        channelId: Platform.OS === 'android' ? CHANNEL : undefined,
      },
    });
  }
}
