import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, Text, View } from 'react-native';
import { Logo } from '../../components/Logo';
import { logout, useAuth } from '../../lib/auth';
import { PANEL_BASE_URL } from '../../lib/config';
import { getToken, motivoBloqueio } from '../../lib/entitlement';
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
/**
 * Só devolve a URL se ela apontar comprovadamente para o nosso painel.
 *
 * Defesa em profundidade: hoje a URL só chega do servidor, mas esta rota é
 * alcançável por deep link (`scheme: fittracker`), e abrir uma URL arbitrária numa
 * tela de "regularize seu pagamento" é phishing de cartão com a nossa marca em volta.
 *
 * Comparação por prefixo, e não `new URL().hostname`: no React Native o getter
 * `hostname` lança "not implemented" (Libraries/Blob/URL.js), então a checagem por
 * host cairia sempre no catch e descartaria em silêncio a URL legítima.
 *
 * A barra final é o que impede `https://fittracker.agathasweb.com.golpe.com/` e
 * `https://fittracker.agathasweb.com@golpe.com/` de passarem.
 */
function urlDoPainel(candidata: string | null | undefined): string | null {
  if (!candidata) return null;
  const base = PANEL_BASE_URL.replace(/\/+$/, '');
  return candidata === base || candidata.startsWith(`${base}/`) ? candidata : null;
}

export default function Blocked() {
  const router = useRouter();
  const auth = useAuth();
  // Motivo vem do estado interno (login recusado) ou do próprio useAuth (sessão
  // que perdeu o direito). Nunca de parâmetro de rota — ver urlDoPainel acima.
  const motivo = motivoBloqueio();

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
    (auth.status === 'blocked' ? auth.message : null) ??
    motivo?.message ??
    'Sua assinatura não está ativa.';

  const checkoutUrl =
    urlDoPainel(auth.status === 'blocked' ? auth.checkoutUrl : null) ??
    urlDoPainel(motivo?.checkoutUrl) ??
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
