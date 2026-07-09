import { Redirect } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Logo } from '../components/Logo';
import { useAuth } from '../lib/auth';
import { backupDiarioSeNecessario } from '../lib/backup';
import { colors, spacing } from '../lib/theme';
import { checkForOTAUpdate } from '../lib/updates';

export default function Index() {
  const auth = useAuth();

  useEffect(() => {
    checkForOTAUpdate();
  }, []);

  // Backup diário, silencioso. Só roda com sessão válida e nunca atrapalha o uso:
  // sem rede ou fora do piloto, apenas não acontece.
  useEffect(() => {
    if (auth.status !== 'authed') return;
    backupDiarioSeNecessario().catch((e) => console.warn('backup diário falhou:', e));
  }, [auth.status]);

  if (auth.status === 'loading') {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.bg,
          gap: spacing.lg,
        }}
      >
        <Logo size={112} />
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (auth.status === 'authed') return <Redirect href="/(tabs)" />;
  // Assinatura caiu: bloqueio total, vale inclusive offline.
  if (auth.status === 'blocked') return <Redirect href="/auth/blocked" />;
  // Só falta de rede há mais de 48h — não é inadimplência.
  if (auth.status === 'needs_reconnect') return <Redirect href="/auth/reconnect" />;
  // Autenticado no servidor, mas sem perfil local neste aparelho.
  if (auth.status === 'needs_profile') return <Redirect href="/auth/register" />;

  return <Redirect href="/auth/login" />;
}
