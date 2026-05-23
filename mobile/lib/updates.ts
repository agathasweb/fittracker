import * as Updates from 'expo-updates';
import { Platform } from 'react-native';

/**
 * Checa se há nova versão JS disponível no canal EAS Update.
 * Web e modo dev são ignorados (expo-updates não roda neles).
 */
export async function checkForOTAUpdate(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  if (__DEV__) return false;
  if (!Updates.isEnabled) return false;
  try {
    const result = await Updates.checkForUpdateAsync();
    if (result.isAvailable) {
      await Updates.fetchUpdateAsync();
      await Updates.reloadAsync();
      return true;
    }
  } catch {
    // Falha silenciosa — usuário usa a versão atual
  }
  return false;
}
