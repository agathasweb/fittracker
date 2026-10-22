import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing } from './theme';

// Android 15+ desenha o app por baixo da barra de navegação (edge-to-edge obrigatório)
// e o iPhone tem o home indicator. Bottom sheets precisam desse recuo pra que os botões
// do fim não fiquem atrás dos controles do sistema.
export function useSheetBottomPadding(): number {
  const { bottom } = useSafeAreaInsets();
  return Math.max(spacing.xl, bottom + spacing.md);
}
