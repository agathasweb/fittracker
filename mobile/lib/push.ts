import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { ensurePermission } from './notifications';

const TOKEN_KEY = '@fittracker/expo_push_token';

/**
 * O projectId do EAS, necessário pra `getExpoPushTokenAsync` em SDK 49+.
 * Vem de `extra.eas.projectId` no app.json (ou do easConfig em runtime).
 */
function getProjectId(): string | undefined {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants as any).easConfig?.projectId ??
    undefined
  );
}

/**
 * Canal Android padrão pra mensagens remotas (push). Diferente do canal
 * "medications" (lembretes locais) — este é o destino default do FCM.
 */
async function ensureDefaultChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('default', {
    name: 'Geral',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#A3E635',
  });
}

export async function getStoredPushToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY);
}

/**
 * Registra o device pra push remoto (Expo Push) e devolve o ExpoPushToken.
 *
 * Retorna null (sem lançar) quando:
 * - roda no web;
 * - roda no Expo Go Android (SDK 53 removeu push remoto do Go);
 * - a permissão foi negada;
 * - o FCM não está configurado no build (falta google-services.json / credencial FCM V1 no EAS).
 *
 * O token é persistido em AsyncStorage pra ser lido/enviado depois (ex.: futuro
 * proxy que coleta tokens pra campanhas). Enquanto não há backend, dá pra testar
 * colando o token na ferramenta de push do Expo (https://expo.dev/notifications).
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  try {
    const ok = await ensurePermission();
    if (!ok) return null;
    await ensureDefaultChannel();
    const projectId = getProjectId();
    if (!projectId) {
      console.warn('[push] projectId ausente — não é possível obter o ExpoPushToken');
      return null;
    }
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    if (data) await AsyncStorage.setItem(TOKEN_KEY, data);
    return data ?? null;
  } catch (e) {
    console.warn('[push] falha ao registrar push token:', e);
    return null;
  }
}

/**
 * Lê o token persistido e dispara o registro (idempotente) em background.
 * Útil pra telas que só querem exibir o token atual.
 */
export function usePushToken(): string | null {
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    getStoredPushToken().then((t) => {
      if (alive && t) setToken(t);
    });
    registerForPushNotificationsAsync().then((t) => {
      if (alive && t) setToken(t);
    });
    return () => {
      alive = false;
    };
  }, []);
  return token;
}
