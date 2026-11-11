import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Logo } from '../../components/Logo';
import { ProfileForm, ProfileFormData } from '../../components/ProfileForm';
import { BackupMeta } from '../../lib/api';
import { adotarPerfilLocal, completarPerfil, getPendingProfile, logout } from '../../lib/auth';
import { backupDisponivel, restaurarBackup } from '../../lib/backup';
import { colors, spacing } from '../../lib/theme';

type Errors = Partial<Record<string, string>>;

export default function Register() {
  const router = useRouter();
  const [errors, setErrors] = useState<Errors>({});

  // E-mail e nome vêm do painel (o servidor já autenticou). A senha não é mais
  // definida aqui — ela foi criada no checkout e vive só no servidor.
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [backup, setBackup] = useState<BackupMeta | null>(null);
  const [restaurando, setRestaurando] = useState(false);

  // Sem perfil pendente ninguém deveria estar aqui — a raiz manda pro login.
  useEffect(() => {
    (async () => {
      const pending = await getPendingProfile();
      if (!pending) {
        router.replace('/');
        return;
      }
      setEmail(pending.email);
      setName((atual) => atual || pending.name);

      // Instalação nova de quem já usava o app: em vez de recomeçar do zero,
      // oferecer o histórico que está no painel.
      setBackup(await backupDisponivel());
    })();
  }, [router]);

  function onRestaurar() {
    Alert.alert(
      'Restaurar seus dados?',
      'Vamos trazer o histórico do seu último backup para este aparelho.',
      [
        { text: 'Agora não', style: 'cancel' },
        {
          text: 'Restaurar',
          onPress: async () => {
            setRestaurando(true);
            try {
              await restaurarBackup();
              // O backup traz o perfil junto. Sem apontar a sessão pra ele, a raiz
              // devolveria o usuário pra esta tela num laço.
              const adotado = await adotarPerfilLocal(email);
              if (adotado) {
                router.replace('/');
              } else {
                setErrors({
                  form: 'O backup restaurado não tem o perfil deste e-mail. Complete os dados abaixo.',
                });
              }
            } catch (e: any) {
              setErrors({ form: e?.message ?? 'Não foi possível restaurar o backup.' });
            } finally {
              setRestaurando(false);
            }
          },
        },
      ]
    );
  }

  async function onSubmit(dados: ProfileFormData) {
    setErrors({});
    try {
      await completarPerfil({ ...dados, email });
      router.replace('/');
    } catch (err: any) {
      setErrors({ form: err?.message ?? 'Erro ao salvar o perfil' });
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={{ alignItems: 'center', marginBottom: spacing.sm }}>
          <Logo size={72} />
        </View>
        <Text style={styles.title}>Vamos te conhecer</Text>
        <Text style={styles.subtitle}>
          Assinatura confirmada para {email}. Esses dados ficam só no seu aparelho e são
          usados pros cálculos de meta e progresso.
        </Text>

        {backup && (
          <Card title="Encontramos um backup seu">
            <Text style={styles.subtitle}>
              Último backup em {new Date(backup.created_at).toLocaleString('pt-BR')}.
              Restaure para trazer todo o seu histórico de volta, em vez de começar do zero.
            </Text>
            <Button
              title="Restaurar meus dados"
              onPress={onRestaurar}
              loading={restaurando}
            />
          </Card>
        )}

        <ProfileForm
          initialName={name}
          submitTitle="Salvar perfil"
          formError={errors.form}
          onSubmit={onSubmit}
        />

        <View style={styles.loginRow}>
          <Text style={styles.loginHint}>Não é você?</Text>
          <Pressable
            onPress={async () => {
              await logout();
              router.replace('/auth/login');
            }}
          >
            <Text style={styles.loginLink}>Entrar com outra conta</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800',
    marginTop: spacing.sm,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 14,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  loginRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  loginHint: {
    color: colors.textMuted,
    fontSize: 14,
  },
  loginLink: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
});
