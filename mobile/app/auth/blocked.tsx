import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, Linking, Pressable, Text, View } from 'react-native';
import { Logo } from '../../components/Logo';
import { useAuth, logout } from '../../lib/auth';
import { PANEL_BASE_URL } from '../../lib/config';
import { colors, spacing } from '../../lib/theme';

/**
 * Assinatura inativa (pagamento falhou, venceu ou foi cancelada).
 * Bloqueio total: este estado fica gravado no device, então nem offline o app abre.
 * Só um 200 do servidor (`/api/auth/me`) destrava — ou seja, pagar e reconectar.
 */
export default function Blocked() {
  const router = useRouter();
  const auth = useAuth();
  const params = useLocalSearchParams<{ message?: string }>();

  // Pagou e revalidou: sem isto o usuário fica preso nesta tela mesmo liberado.
  useEffect(() => {
    if (auth.status === 'authed') router.replace('/(tabs)');
    if (auth.status === 'guest') router.replace('/auth/login');
    if (auth.status === 'needs_profile') router.replace('/auth/register');
  }, [auth.status, router]);

  const mensagem =
    params.message ??
    (auth.status === 'blocked' ? auth.message : 'Sua assinatura não está ativa.');

  const checkoutUrl =
    (auth.status === 'blocked' ? auth.checkoutUrl : null) ?? `${PANEL_BASE_URL}/assinar`;

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
        Assinatura inativa
      </Text>
      <Text style={{ color: colors.textMuted, textAlign: 'center', lineHeight: 22 }}>
        {mensagem}
      </Text>

      <Pressable
        onPress={() => Linking.openURL(checkoutUrl)}
        style={{
          backgroundColor: colors.primary,
          paddingVertical: 14,
          paddingHorizontal: 28,
          borderRadius: 999,
        }}
      >
        <Text style={{ color: colors.bg, fontWeight: '800' }}>Assinar agora</Text>
      </Pressable>

      <Pressable onPress={() => auth.reload()} disabled={auth.status === 'loading'}>
        {auth.status === 'loading' ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <Text style={{ color: colors.primary, fontWeight: '700' }}>
            Já paguei — verificar novamente
          </Text>
        )}
      </Pressable>

      <Pressable
        onPress={async () => {
          await logout();
          router.replace('/auth/login');
        }}
      >
        <Text style={{ color: colors.textMuted, fontSize: 13 }}>Entrar com outra conta</Text>
      </Pressable>
    </View>
  );
}
