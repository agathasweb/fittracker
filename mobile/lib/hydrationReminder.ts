import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { ensurePermission } from './notifications';

/**
 * Lembrete de água: notificação comum (não o alarme de tela cheia) a cada 2 h,
 * das 08:00 às 22:00. Liga/desliga por usuário na tela Hidratação; agendado como
 * gatilhos diários com identificador próprio, pra não colidir com os suplementos.
 */
export const HYDRATION_HOURS = [8, 10, 12, 14, 16, 18, 20, 22];
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

export async function setHydrationReminder(userId: number, on: boolean): Promise<void> {
  await AsyncStorage.setItem(key(userId), on ? '1' : '0');
  await syncHydrationReminders(userId);
}

/** Idempotente: cancela os gatilhos de água e recria se estiver ligado. */
export async function syncHydrationReminders(userId: number): Promise<void> {
  if (Platform.OS === 'web') return;
  await Promise.all(
    HYDRATION_HOURS.map((h) => Notifications.cancelScheduledNotificationAsync(ident(h)).catch(() => {}))
  );
  if (!(await hydrationReminderEnabled(userId))) return;
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
        title: '💧 Hora de beber água',
        body: 'Beba um copo agora e registre no FitTracker.',
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
