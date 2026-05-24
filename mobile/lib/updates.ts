import * as Updates from 'expo-updates';
import { Platform } from 'react-native';

/**
 * Checa se há nova versão JS disponível no canal EAS Update.
 * Baixa em background mas NÃO recarrega o app — a nova versão entra em
 * vigor quando o usuário fechar e abrir de novo. Evita reload em loop e
 * tela cinza quando há update aplicado durante a primeira abertura.
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
      return true;
    }
  } catch {
    // Falha silenciosa — usuário usa a versão atual
  }
  return false;
}
