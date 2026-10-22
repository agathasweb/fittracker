import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../lib/theme';

export default function AuthLayout() {
  const { bottom } = useSafeAreaInsets();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        contentStyle: { backgroundColor: colors.bg, paddingBottom: bottom },
      }}
    >
      <Stack.Screen name="register" options={{ title: 'Completar perfil' }} />
      <Stack.Screen name="login" options={{ title: 'Entrar' }} />
      {/* Sem header e sem voltar: bloqueio não pode ser contornado com gesto/botão. */}
      <Stack.Screen
        name="blocked"
        options={{ headerShown: false, gestureEnabled: false }}
      />
      <Stack.Screen
        name="reconnect"
        options={{ headerShown: false, gestureEnabled: false }}
      />
    </Stack>
  );
}
