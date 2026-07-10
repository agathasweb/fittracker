import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { apiChangePassword, NetworkError, UnauthorizedError, ValidationError } from '../lib/api';
import { getToken } from '../lib/entitlement';
import { colors, spacing } from '../lib/theme';

/**
 * Troca de senha da conta do app. A senha é validada pelo painel, então isto
 * bate em POST /api/auth/password. Trocar desloga os OUTROS aparelhos (decisão do
 * servidor), preservando este.
 */
export default function ChangePassword() {
  const router = useRouter();
  const [atual, setAtual] = useState('');
  const [nova, setNova] = useState('');
  const [confirma, setConfirma] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function onSubmit() {
    setErro(null);
    if (nova.length < 8) {
      setErro('A nova senha precisa ter ao menos 8 caracteres.');
      return;
    }
    if (nova !== confirma) {
      setErro('A confirmação não bate com a nova senha.');
      return;
    }

    const token = await getToken();
    if (!token) {
      setErro('Sessão expirada. Entre novamente.');
      return;
    }

    setEnviando(true);
    try {
      await apiChangePassword(token, atual, nova);
      Alert.alert('Senha alterada', 'Use a nova senha nos próximos acessos.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e) {
      if (e instanceof ValidationError) {
        setErro(e.message); // "A senha atual está incorreta." etc.
      } else if (e instanceof UnauthorizedError) {
        setErro('Sessão expirada. Entre novamente.');
      } else if (e instanceof NetworkError) {
        setErro('Sem conexão. Verifique sua internet e tente de novo.');
      } else {
        setErro('Não foi possível trocar a senha. Tente novamente.');
      }
    } finally {
      setEnviando(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.form}>
        <Input
          label="Senha atual"
          value={atual}
          onChangeText={setAtual}
          secureTextEntry
          autoComplete="current-password"
          placeholder="••••••••"
        />
        <Input
          label="Nova senha"
          value={nova}
          onChangeText={setNova}
          secureTextEntry
          autoComplete="new-password"
          placeholder="Mínimo 8 caracteres"
        />
        <Input
          label="Confirme a nova senha"
          value={confirma}
          onChangeText={setConfirma}
          secureTextEntry
          autoComplete="new-password"
          placeholder="Digite novamente"
        />

        {erro && <Text style={styles.erro}>{erro}</Text>}

        <Button
          title="Salvar nova senha"
          onPress={onSubmit}
          loading={enviando}
          style={{ marginTop: spacing.md }}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg, justifyContent: 'center' },
  form: { gap: spacing.xs },
  erro: { color: colors.danger, fontSize: 14, textAlign: 'center', marginTop: spacing.sm },
});
