import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
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
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { ProfileAvatar } from '../components/ProfileSwitcher';
import { ProfileForm, ProfileFormData } from '../components/ProfileForm';
import { adicionarPerfil, getOwnerUserId, removerPerfil, switchProfile, useAuth } from '../lib/auth';
import { syncMedicationAlarms } from '../lib/alarms';
import { ageFromBirth } from '../lib/format';
import { useRequireAuth } from '../lib/guards';
import { listDeviceProfiles } from '../lib/profiles';
import { colors, radius, spacing } from '../lib/theme';
import { User } from '../lib/types';

/**
 * Multi-perfil: quem usa o app debaixo deste login. Cada perfil tem os próprios
 * dados (treinos, refeições, suplementos, peso); a conta e a assinatura são do principal.
 */
export default function ProfilesScreen() {
  const auth = useAuth();
  useRequireAuth();
  const router = useRouter();
  const [ownerId, setOwnerId] = useState<number | null>(null);
  const [profiles, setProfiles] = useState<User[]>([]);
  const [adding, setAdding] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const currentId = auth.status === 'authed' ? auth.user.id : null;

  const load = useCallback(async () => {
    const owner = await getOwnerUserId();
    setOwnerId(owner);
    setProfiles(owner ? await listDeviceProfiles(owner) : []);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load, currentId])
  );

  async function onAdd(dados: ProfileFormData) {
    setFormError(null);
    try {
      const novo = await adicionarPerfil(dados);
      setAdding(false);
      await load();
      Alert.alert('Perfil criado', `Agora você está no perfil de ${novo.name}. Toque no nome no topo pra trocar.`);
      router.back();
    } catch (e: any) {
      setFormError(e?.message ?? 'Não deu pra criar o perfil.');
    }
  }

  function onRemove(p: User) {
    Alert.alert(
      `Remover ${p.name}?`,
      'Apaga deste aparelho o perfil e TODOS os dados dele (treinos, refeições, suplementos, peso). Não dá pra desfazer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: async () => {
            try {
              await removerPerfil(p.id);
              await load();
              if (ownerId) await syncMedicationAlarms(ownerId).catch(() => {});
            } catch (e: any) {
              Alert.alert('Não deu pra remover', e?.message ?? 'Erro inesperado.');
            }
          },
        },
      ]
    );
  }

  if (auth.status !== 'authed') return null;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.hint}>
          Várias pessoas no mesmo login. Cada perfil tem os próprios treinos, refeições, suplementos e
          peso. Troque com 1 toque no nome, no topo das abas.
        </Text>

        <Card title="Perfis neste aparelho">
          {profiles.map((p) => {
            const ativo = p.id === currentId;
            const principal = p.id === ownerId;
            return (
              <View key={p.id} style={styles.row}>
                <Pressable
                  style={styles.rowMain}
                  onPress={() => !ativo && switchProfile(p.id).catch(() => {})}
                >
                  <ProfileAvatar user={p} size={40} active={ativo} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{p.name}</Text>
                    <Text style={styles.meta}>
                      {principal ? 'Principal (dono da conta)' : 'Perfil extra'} · {ageFromBirth(p.birth_date)} anos
                      {ativo ? ' · em uso' : ''}
                    </Text>
                  </View>
                </Pressable>
                {!principal && (
                  <Pressable hitSlop={10} onPress={() => onRemove(p)} accessibilityLabel={`Remover ${p.name}`}>
                    <Ionicons name="trash-outline" size={20} color={colors.danger} />
                  </Pressable>
                )}
              </View>
            );
          })}
        </Card>

        {adding ? (
          <>
            <Text style={styles.section}>Novo perfil</Text>
            <ProfileForm askEmail submitTitle="Criar perfil" formError={formError} onSubmit={onAdd} />
            <Button title="Cancelar" variant="ghost" onPress={() => setAdding(false)} />
          </>
        ) : (
          <Button title="Adicionar perfil" onPress={() => setAdding(true)} />
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, paddingBottom: spacing.xl, gap: spacing.sm },
  hint: { color: colors.textMuted, fontSize: 14, marginBottom: spacing.sm },
  section: { color: colors.text, fontSize: 18, fontWeight: '800', marginTop: spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  rowMain: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1 },
  name: { color: colors.text, fontSize: 16, fontWeight: '700' },
  meta: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
});
