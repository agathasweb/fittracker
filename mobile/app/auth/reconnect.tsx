import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Logo } from '../../components/Logo';
import { useAuth } from '../../lib/auth';
import { colors, spacing } from '../../lib/theme';

/**
 * Passou de 24h sem o servidor confirmar a assinatura.
 * Diferente de `blocked`: aqui não há indício de inadimplência, só falta de rede.
 * Basta reconectar — a mensagem não acusa o usuário de nada.
 */
export default function Reconnect() {
  const auth = useAuth();
  const router = useRouter();

  // Reconectou: sai desta tela. Se a assinatura caiu, vai pro bloqueio.
  useEffect(() => {
    if (auth.status === 'authed') router.replace('/(tabs)');
    if (auth.status === 'blocked') router.replace('/auth/blocked');
    if (auth.status === 'guest') router.replace('/auth/login');
  }, [auth.status, router]);

  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.bg,
        padding: spacing.xl,
        gap: spacing.lg,
      }}
    >
      <Logo size={96} />
      <Text style={{ color: colors.text, fontSize: 22, fontWeight: '800' }}>
        Conecte-se à internet
      </Text>
      <Text style={{ color: colors.textMuted, textAlign: 'center', lineHeight: 22 }}>
        Faz mais de 24 horas que não conseguimos confirmar sua assinatura.
        Conecte-se uma vez para continuar usando o app offline.
      </Text>

      <Pressable
        onPress={() => auth.reload()}
        disabled={auth.status === 'loading'}
        style={{
          backgroundColor: colors.primary,
          paddingVertical: 14,
          paddingHorizontal: 28,
          borderRadius: 999,
          minWidth: 180,
          alignItems: 'center',
        }}
      >
        {auth.status === 'loading' ? (
          <ActivityIndicator color={colors.bg} />
        ) : (
          <Text style={{ color: colors.bg, fontWeight: '800' }}>Tentar novamente</Text>
        )}
      </Pressable>
    </View>
  );
}
