import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useEffect, useState } from 'react';
import { Alert, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { getLatestRelease, isNewerVersion, ReleaseInfo } from '../lib/githubReleases';
import { colors, radius, spacing } from '../lib/theme';

const DISMISS_TTL_MS = 1000 * 60 * 60 * 12; // 12h

let dismissedAt = 0;

export function UpdateBanner() {
  const [release, setRelease] = useState<ReleaseInfo | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    if (Date.now() - dismissedAt < DISMISS_TTL_MS) return;

    const currentVersion = Constants.expoConfig?.version ?? '0.0.0';
    (async () => {
      const latest = await getLatestRelease();
      if (!latest) return;
      if (isNewerVersion(latest.tag, currentVersion)) {
        setRelease(latest);
      }
    })();
  }, []);

  if (!release) return null;

  function dismiss() {
    dismissedAt = Date.now();
    setRelease(null);
  }

  async function install() {
    try {
      await Linking.openURL(release!.apkUrl);
    } catch {
      Alert.alert(
        'Não consegui abrir',
        `Abra manualmente:\n${release!.htmlUrl}`
      );
    }
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.left}>
        <Ionicons name="arrow-up-circle" size={22} color={colors.bg} />
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Nova versão {release.tag}</Text>
          <Text style={styles.sub}>Toque em "Atualizar" pra baixar o APK</Text>
        </View>
      </View>
      <View style={styles.actions}>
        <Pressable onPress={install} style={styles.btn}>
          <Text style={styles.btnText}>Atualizar</Text>
        </Pressable>
        <Pressable onPress={dismiss} style={styles.close}>
          <Ionicons name="close" size={18} color={colors.bg} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  left: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    color: colors.bg,
    fontWeight: '800',
    fontSize: 13,
  },
  sub: {
    color: colors.bg,
    fontSize: 11,
    opacity: 0.8,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  btn: {
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  btnText: {
    color: colors.primary,
    fontWeight: '800',
    fontSize: 13,
  },
  close: {
    padding: spacing.xs,
  },
});
