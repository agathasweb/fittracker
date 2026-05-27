import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

let configured = false;

function configure() {
  if (configured) return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  configured = true;
}

export async function ensurePermission(): Promise<boolean> {
  configure();
  const { status } = await Notifications.getPermissionsAsync();
  if (status === 'granted') return true;
  const req = await Notifications.requestPermissionsAsync();
  return req.status === 'granted';
}

async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('medications', {
    name: 'Lembretes de suplementos',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#A3E635',
  });
}

/**
 * Agenda um lembrete diário no horário "HH:mm" e devolve o ID da notificação.
 * Retorna null se a permissão foi negada.
 */
export async function scheduleDailyReminder(
  title: string,
  body: string,
  time: string
): Promise<string | null> {
  const ok = await ensurePermission();
  if (!ok) return null;
  await ensureAndroidChannel();
  const [hh, mm] = time.split(':').map((n) => Number(n));
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  return Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: 'default',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: hh,
      minute: mm,
      channelId: Platform.OS === 'android' ? 'medications' : undefined,
    },
  });
}

export async function cancelNotifications(ids: string[]): Promise<void> {
  await Promise.all(
    ids.map((id) => Notifications.cancelScheduledNotificationAsync(id).catch(() => {}))
  );
}

/**
 * Re-agenda lembretes pra um medicamento: cancela os antigos e cria novos
 * pra cada horário. Devolve os IDs novos pra persistir.
 */
export async function rescheduleMedicationReminders(
  oldIds: string[],
  name: string,
  dosage: string | null,
  times: string[]
): Promise<string[]> {
  if (oldIds.length) await cancelNotifications(oldIds);
  if (!times.length) return [];
  const title = 'Hora do suplemento';
  const body = dosage ? `${name} — ${dosage}` : name;
  const ids: string[] = [];
  for (const t of times) {
    const id = await scheduleDailyReminder(title, body, t);
    if (id) ids.push(id);
  }
  return ids;
}
