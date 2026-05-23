import { Stack } from 'expo-router';
import { colors } from '../../lib/theme';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="register" options={{ title: 'Criar conta' }} />
      <Stack.Screen name="login" options={{ title: 'Entrar' }} />
    </Stack>
  );
}
