import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Logo } from '../../components/Logo';
import { NetworkError, NotEntitledError, UnauthorizedError } from '../../lib/api';
import { login } from '../../lib/auth';
import { PANEL_BASE_URL } from '../../lib/config';
import { colors, spacing } from '../../lib/theme';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit() {
    setError(null);
    if (!email.trim() || !password) {
      setError('Preencha e-mail e senha');
      return;
    }
    setSubmitting(true);
    try {
      const r = await login(email, password);
      // Sem perfil neste aparelho? A raiz roteia pro cadastro de perfil.
      router.replace(r.kind === 'needs_profile' ? '/auth/register' : '/');
    } catch (err) {
      // Cada falha pede uma resposta diferente: senha errada não é o mesmo que
      // assinatura vencida, que não é o mesmo que estar sem sinal.
      if (err instanceof NotEntitledError) {
        // Credencial certa, assinatura inativa. A tela de bloqueio explica e
        // oferece regularizar. Passamos a URL que o próprio servidor mandou.
        router.replace({
          pathname: '/auth/blocked',
          params: {
            message: err.message,
            ...(err.checkoutUrl ? { checkoutUrl: err.checkoutUrl } : {}),
          },
        });
        return;
      }
      if (err instanceof UnauthorizedError) {
        setError('E-mail ou senha incorretos.');
      } else if (err instanceof NetworkError) {
        setError('Sem conexão. Verifique sua internet e tente de novo.');
      } else {
        setError('Não foi possível entrar. Tente novamente.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={{ alignItems: 'center', marginBottom: spacing.lg }}>
        <Logo size={88} />
      </View>
      <Text style={styles.brand}>FitTracker</Text>
      <Text style={styles.subtitle}>Dieta · Treino · Resultado</Text>

      <View style={styles.form}>
        <Input
          label="E-mail"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          placeholder="voce@exemplo.com"
        />
        <Input
          label="Senha"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="••••••"
        />

        {error && <Text style={styles.error}>{error}</Text>}

        <Button title="Entrar" onPress={onSubmit} loading={submitting} />

        <View style={styles.linkRow}>
          <Text style={styles.linkHint}>Não tem assinatura?</Text>
          <Pressable onPress={() => Linking.openURL(`${PANEL_BASE_URL}/assinar`)}>
            <Text style={styles.link}>Assinar</Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    padding: spacing.lg,
    justifyContent: 'center',
  },
  brand: {
    color: colors.text,
    fontSize: 36,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  form: { gap: spacing.xs },
  error: {
    color: colors.danger,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  linkHint: {
    color: colors.textMuted,
    fontSize: 14,
  },
  link: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
});
