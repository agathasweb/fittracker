import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, Text, View } from 'react-native';
import { Logo } from '../../components/Logo';
import { logout, useAuth } from '../../lib/auth';
import { PANEL_BASE_URL } from '../../lib/config';
import { getToken } from '../../lib/entitlement';
import { colors, spacing } from '../../lib/theme';

/**
 * Assinatura inativa (pagamento falhou, venceu ou foi cancelada).
 *
 * Alcançada de dois jeitos, e os dois precisam funcionar:
 *  1. Sessão ativa que perdeu o direito → `/api/auth/me` devolveu 403. O bloqueio
 *     fica gravado no disco, então nem offline o app abre.
 *  2. Tentativa de LOGIN que devolveu 403 → não há token nenhum. Antes esta tela
 *     redirecionava pro login ao ver `guest`, e o usuário só via um piscar: nunca
 *     descobria que o problema era a assinatura.
 */
export default function Blocked() {
  const router = useRouter();
  const auth = useAuth();
  const params = useLocalSearchParams<{ message?: string; checkoutUrl?: string }>();

  const [temSessao, setTemSessao] = useState<boolean | null>(null);

  useEffect(() => {
    getToken().then((t) => setTemSessao(!!t));
  }, []);

  // Só saímos daqui quando o servidor confirmar que o direito voltou.
  // Não redirecionar em 'guest': é o estado normal de quem chegou pelo login.
  useEffect(() => {
    if (auth.status === 'authed') router.replace('/(tabs)');
    if (auth.status === 'needs_profile') router.replace('/auth/register');
  }, [auth.status, router]);

  const mensagem =
    params.message ??
    (auth.status === 'blocked' ? auth.message : 'Sua assinatura não está ativa.');

  const checkoutUrl =
    params.checkoutUrl ??
    (auth.status === 'blocked' ? auth.checkoutUrl : null) ??
    `${PANEL_BASE_URL}/assinar`;

  const verificando = auth.status === 'loading';

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
      <Text style={{ color: colors.textMuted, textAlign: 'center', fontSize: 13 }}>
        Assine ou regularize o pagamento para voltar a usar o FitTracker. Seus dados
        continuam salvos.
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
        <Text style={{ color: colors.bg, fontWeight: '800' }}>
          Assinar / regularizar pagamento
        </Text>
      </Pressable>

      {/* Com sessão dá pra revalidar aqui mesmo. Sem sessão (veio de um login
          recusado) não há token pra consultar: o caminho é tentar entrar de novo. */}
      <Pressable
        onPress={() => {
          if (temSessao) auth.reload();
          else router.replace('/auth/login');
        }}
        disabled={verificando}
      >
        {verificando ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <Text style={{ color: colors.primary, fontWeight: '700' }}>
            {temSessao ? 'Já paguei — verificar novamente' : 'Já paguei — tentar entrar'}
          </Text>
        )}
      </Pressable>

      <Pressable
        onPress={async () => {
          await logout();
          router.replace('/auth/login');
        }}
      >
        <Text style={{ color: colors.textMuted, fontSize: 13 }}>
          {temSessao ? 'Entrar com outra conta' : 'Voltar ao login'}
        </Text>
      </Pressable>
    </View>
  );
}
