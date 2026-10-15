import { requireOptionalNativeModule } from 'expo-modules-core';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PermissionsAndroid, Platform } from 'react-native';

/**
 * Pressão arterial direto do relógio (HW6 / Wearfit Pro) via BLE — módulo nativo
 * `modules/fittracker-alarm` (mesmo módulo do alarme). Sem o módulo (APK antigo,
 * iOS, web) `watchAvailable()` é false e a tela só aceita lançamento manual.
 */
type NativeWatch = {
  watchConnectedDevices(): { name: string; address: string }[];
  watchConfigure(address: string | null, userId: number): void;
  watchSyncNow(): Promise<number>;
  watchLastSync(): number;
  watchMeasureNow?(): Promise<{ systolic: number; diastolic: number } | null>;
  watchTestMessage?(appId?: number | null, type?: number | null, body?: string | null): Promise<void>;
};

const Native =
  Platform.OS === 'android' ? requireOptionalNativeModule<NativeWatch>('FittrackerAlarm') : null;

const KEY_WATCH = 'watch.device';

export type WatchDevice = { name: string; address: string };

export function watchAvailable(): boolean {
  return Native != null && typeof Native.watchSyncNow === 'function';
}

async function ensureBluetoothPermission(): Promise<boolean> {
  if (Platform.OS !== 'android' || Number(Platform.Version) < 31) return true;
  const r = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT);
  return r === PermissionsAndroid.RESULTS.GRANTED;
}

/** Dispositivos BLE conectados agora (o relógio aparece se o Wearfit Pro estiver ligado a ele). */
export async function listWatchCandidates(): Promise<WatchDevice[]> {
  if (!Native) return [];
  if (!(await ensureBluetoothPermission())) throw new Error('Permissão de Bluetooth negada');
  return Native.watchConnectedDevices();
}

export async function getWatch(): Promise<WatchDevice | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY_WATCH);
    return raw ? (JSON.parse(raw) as WatchDevice) : null;
  } catch {
    return null;
  }
}

/** Salva o relógio escolhido e liga a sync de hora em hora (null desliga). */
export async function setWatch(device: WatchDevice | null, userId: number): Promise<void> {
  if (!Native) return;
  if (device) await AsyncStorage.setItem(KEY_WATCH, JSON.stringify(device));
  else await AsyncStorage.removeItem(KEY_WATCH);
  Native.watchConfigure(device?.address ?? null, userId);
}

/** Sincroniza agora; devolve quantas leituras novas entraram no banco. */
export async function syncWatchNow(): Promise<number> {
  if (!Native) return 0;
  if (!(await ensureBluetoothPermission())) throw new Error('Permissão de Bluetooth negada');
  return Native.watchSyncNow();
}

export function lastWatchSync(): Date | null {
  if (!Native) return null;
  const ms = Native.watchLastSync();
  return ms > 0 ? new Date(ms) : null;
}

/** O APK tem os recursos novos do relógio (medir agora, mensagens)? Desde a v0.5.3. */
export function watchExtrasAvailable(): boolean {
  return Native != null && typeof Native.watchMeasureNow === 'function';
}

/** Pede ao relógio uma medição de pressão agora (~1 min) e grava. */
export async function measureWatchNow(): Promise<{ systolic: number; diastolic: number } | null> {
  if (!Native?.watchMeasureNow) return null;
  if (!(await ensureBluetoothPermission())) throw new Error('Permissão de Bluetooth negada');
  return Native.watchMeasureNow();
}

/** Manda uma mensagem de teste pro relógio (appId/type só pra diagnóstico). */
export async function sendWatchTestMessage(appId?: number, type?: number, body?: string): Promise<void> {
  if (!Native?.watchTestMessage) return;
  if (!(await ensureBluetoothPermission())) throw new Error('Permissão de Bluetooth negada');
  await Native.watchTestMessage(appId ?? null, type ?? null, body ?? null);
}
