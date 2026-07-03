import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Crypto from 'expo-crypto';
import * as Notifications from 'expo-notifications';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { ensurePermission } from './notifications';

const TOKEN_KEY = '@fittracker/expo_push_token';
const INSTALL_ID_KEY = '@fittracker/install_id';

/**
 * Painel que coleta as instalações (endpoint POST /api/push/register).
 * TODO: trocar pra https://fittracker.agathasweb.com antes do release na Play.
 */
const PANEL_BASE_URL = 'https://fittracker-dev.agathasweb.com';

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

/** UUID estável por instalação — chave de upsert no painel (sobrevive a troca de token). */
async function getInstallId(): Promise<string> {
  let id = await AsyncStorage.getItem(INSTALL_ID_KEY);
  if (!id) {
    id = Crypto.randomUUID();
    await AsyncStorage.setItem(INSTALL_ID_KEY, id);
  }
  return id;
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

/** Obtém o ExpoPushToken (ou null em web/Expo Go/sem permissão/FCM ausente). */
async function fetchPushToken(): Promise<string | null> {
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
    return data ?? null;
  } catch (e) {
    console.warn('[push] falha ao obter push token:', e);
    return null;
  }
}

export type InstallUser = { userName?: string | null; userEmail?: string | null };

/** Reporta a instalação pro painel (upsert por install_id). Silencioso em falha de rede. */
async function reportInstall(
  installId: string,
  token: string | null,
  user: InstallUser
): Promise<void> {
  try {
    await fetch(`${PANEL_BASE_URL}/api/push/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        install_id: installId,
        expo_push_token: token,
        platform: Platform.OS,
        device_name: (Platform.constants as any)?.Model ?? null,
        os_version: String(Platform.Version),
        app_version: Constants.expoConfig?.version ?? null,
        user_name: user.userName ?? null,
        user_email: user.userEmail ?? null,
        push_enabled: !!token,
      }),
    });
  } catch (e) {
    console.warn('[push] falha ao reportar instalação:', e);
  }
}

/**
 * Registra o device pra push remoto (Expo Push), persiste o token e reporta a
 * instalação pro painel. Retorna o ExpoPushToken (ou null em web/Expo Go/sem
 * permissão). Nunca lança.
 *
 * `user` traz nome/e-mail da conta local pra o painel listar quem instalou.
 */
export async function registerForPushNotificationsAsync(
  user: InstallUser = {}
): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  const installId = await getInstallId();
  const token = await fetchPushToken();
  if (token) await AsyncStorage.setItem(TOKEN_KEY, token);
  await reportInstall(installId, token, user);
  return token;
}

/** Lê o token persistido (pra telas que só exibem, ex.: Perfil). Não reporta instalação. */
export function usePushToken(): string | null {
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    getStoredPushToken().then((t) => {
      if (alive && t) setToken(t);
    });
    return () => {
      alive = false;
    };
  }, []);
  return token;
}
