import { requireOptionalNativeModule } from 'expo-modules-core';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

/**
 * O relógio (HW6 / Wearfit Pro via BLE) saiu do app em 2026-11: a pressão agora é só
 * manual. O módulo nativo (`modules/fittracker-alarm`) continua no APK; aqui só
 * garantimos que ele fique DESLIGADO — `watchConfigure(null)` para a sync horária,
 * as mensagens dos alarmes no relógio e o aviso de "relógio desconectado".
 */
type NativeWatch = {
  watchConfigure?(address: string | null, userId: number): void;
};

const Native =
  Platform.OS === 'android' ? requireOptionalNativeModule<NativeWatch>('FittrackerAlarm') : null;

const KEY_WATCH = 'watch.device';

/** Idempotente: chamar ao abrir o app. */
export async function disconnectWatch(userId: number): Promise<void> {
  try {
    const had = await AsyncStorage.getItem(KEY_WATCH);
    if (had) await AsyncStorage.removeItem(KEY_WATCH);
    Native?.watchConfigure?.(null, userId);
  } catch {
    // Sem módulo/APK antigo: nada a desligar.
  }
}
