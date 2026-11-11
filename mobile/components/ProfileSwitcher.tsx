import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getOwnerUserId, switchProfile } from '../lib/auth';
import { listDeviceProfiles } from '../lib/profiles';
import { colors, radius, spacing } from '../lib/theme';
import { User } from '../lib/types';

export function ProfileAvatar({ user, size = 30, active = false }: { user: User; size?: number; active?: boolean }) {
  const style = {
    width: size,
    height: size,
    borderRadius: size / 2,
    borderWidth: active ? 2 : 0,
    borderColor: colors.primary,
  };
  if (user.avatar_uri) return <Image source={{ uri: user.avatar_uri }} style={style} />;
  return (
    <View style={[style, styles.initialBox]}>
      <Text style={[styles.initial, { fontSize: size * 0.45 }]}>{user.name.trim().charAt(0).toUpperCase()}</Text>
    </View>
  );
}

/**
 * Chip no topo das abas. Com 2 perfis, 1 toque alterna direto; com mais, abre a lista.
 * Segurar sempre abre a lista (com "Gerenciar perfis"). Some quando só existe 1 perfil.
 */
export function ProfileSwitcher({ current }: { current: User }) {
  const router = useRouter();
  const [profiles, setProfiles] = useState<User[]>([]);
  const [menu, setMenu] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let vivo = true;
      (async () => {
        const owner = await getOwnerUserId();
        if (!owner) return;
        const lista = await listDeviceProfiles(owner);
        if (vivo) setProfiles(lista);
      })();
      return () => {
        vivo = false;
      };
    }, [current.id, current.avatar_uri, current.name])
  );

  if (profiles.length < 2) return null;

  async function trocar(id: number) {
    setMenu(false);
    if (id === current.id) return;
    try {
      await switchProfile(id);
    } catch (e: any) {
      Alert.alert('Não deu pra trocar', e?.message ?? 'Erro inesperado.');
    }
  }

  function onPress() {
    if (profiles.length === 2) {
      const outro = profiles.find((p) => p.id !== current.id);
      if (outro) trocar(outro.id);
      return;
    }
    setMenu(true);
  }

  const outro = profiles.length === 2 ? profiles.find((p) => p.id !== current.id) : null;

  return (
    <>
      <Pressable
        onPress={onPress}
        onLongPress={() => setMenu(true)}
        hitSlop={8}
        style={({ pressed }) => [styles.chip, pressed && { opacity: 0.7 }]}
        accessibilityLabel={outro ? `Trocar para o perfil de ${outro.name}` : 'Trocar de perfil'}
      >
        <ProfileAvatar user={current} size={26} active />
        <Text style={styles.chipName} numberOfLines={1}>
          {current.name.trim().split(/\s+/)[0]}
        </Text>
        <Ionicons name="swap-horizontal" size={16} color={colors.textMuted} />
      </Pressable>

      <Modal visible={menu} transparent animationType="fade" onRequestClose={() => setMenu(false)}>
        <Pressable style={styles.backdrop} onPress={() => setMenu(false)}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Quem está usando?</Text>
            {profiles.map((p) => (
              <Pressable key={p.id} style={styles.row} onPress={() => trocar(p.id)}>
                <ProfileAvatar user={p} size={36} active={p.id === current.id} />
                <Text style={styles.rowName}>{p.name}</Text>
                {p.id === current.id && <Ionicons name="checkmark" size={20} color={colors.primary} />}
              </Pressable>
            ))}
            <Pressable
              style={styles.row}
              onPress={() => {
                setMenu(false);
                router.push('/profiles');
              }}
            >
              <Ionicons name="people-outline" size={22} color={colors.textMuted} style={{ width: 36, textAlign: 'center' }} />
              <Text style={[styles.rowName, { color: colors.textMuted }]}>Gerenciar perfis</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  initialBox: { backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  initial: { color: colors.bg, fontWeight: '800' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingLeft: 4,
    paddingRight: 10,
    marginRight: spacing.md,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    maxWidth: 160,
  },
  chipName: { color: colors.text, fontWeight: '700', fontSize: 14, flexShrink: 1 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: spacing.lg },
  sheet: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, gap: 4 },
  sheetTitle: { color: colors.text, fontSize: 17, fontWeight: '800', marginBottom: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 10 },
  rowName: { color: colors.text, fontSize: 16, fontWeight: '600', flex: 1 },
});
