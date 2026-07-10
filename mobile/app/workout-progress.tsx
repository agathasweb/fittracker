import { Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card } from '../components/Card';
import { useAuth } from '../lib/auth';
import {
  exerciseProgress,
  ExerciseProgressPoint,
  loggedExerciseNames,
} from '../lib/repos/workoutSessions';
import { colors, radius, spacing } from '../lib/theme';

export default function WorkoutProgressScreen() {
  const auth = useAuth();
  const userId = auth.status === 'authed' ? auth.user.id : null;

  const [nomes, setNomes] = useState<string[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [pontos, setPontos] = useState<ExerciseProgressPoint[]>([]);

  const loadNomes = useCallback(async () => {
    if (!userId) return;
    const ns = await loggedExerciseNames(userId);
    setNomes(ns);
    setSel((atual) => atual ?? ns[0] ?? null);
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      loadNomes();
    }, [loadNomes])
  );

  const loadPontos = useCallback(async () => {
    if (!userId || !sel) {
      setPontos([]);
      return;
    }
    setPontos(await exerciseProgress(userId, sel, 30));
  }, [userId, sel]);

  useFocusEffect(
    useCallback(() => {
      loadPontos();
    }, [loadPontos])
  );

  const maxLoad = pontos.reduce((m, p) => Math.max(m, p.max_load), 0) || 1;
  const primeiro = pontos[0]?.max_load ?? null;
  const ultimo = pontos[pontos.length - 1]?.max_load ?? null;
  const delta = primeiro !== null && ultimo !== null ? ultimo - primeiro : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ title: 'Evolução de carga' }} />
      <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 60 }}>
        {nomes.length === 0 ? (
          <Card>
            <Text style={styles.empty}>
              Registre séries com carga nos seus treinos e a evolução de cada exercício
              aparece aqui.
            </Text>
          </Card>
        ) : (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
              {nomes.map((n) => (
                <Pressable key={n} onPress={() => setSel(n)} style={[styles.chip, sel === n && styles.chipOn]}>
                  <Text style={[styles.chipTxt, sel === n && styles.chipTxtOn]} numberOfLines={1}>
                    {n}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            {delta !== null && (
              <Card>
                <Text style={styles.deltaLabel}>{sel}</Text>
                <Text style={styles.deltaValue}>
                  {primeiro} kg → {ultimo} kg{' '}
                  <Text style={{ color: delta >= 0 ? colors.primary : colors.danger }}>
                    ({delta >= 0 ? '+' : ''}{delta} kg)
                  </Text>
                </Text>
              </Card>
            )}

            <Card>
              {pontos.length === 0 ? (
                <Text style={styles.empty}>Sem registros com carga para este exercício.</Text>
              ) : (
                pontos.map((p) => (
                  <View key={p.performed_at} style={styles.barRow}>
                    <Text style={styles.barDate}>{p.performed_at.slice(5)}</Text>
                    <View style={styles.barTrack}>
                      <View style={[styles.barFill, { width: `${(p.max_load / maxLoad) * 100}%` }]} />
                    </View>
                    <Text style={styles.barVal}>{p.max_load} kg</Text>
                  </View>
                ))
              )}
            </Card>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { color: colors.textMuted, fontSize: 13, lineHeight: 19 },
  chip: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 999,
    paddingHorizontal: 14, paddingVertical: 7, marginRight: spacing.sm, maxWidth: 200,
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipTxt: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  chipTxtOn: { color: colors.bg },
  deltaLabel: { color: colors.textMuted, fontSize: 12, marginBottom: 4 },
  deltaValue: { color: colors.text, fontSize: 18, fontWeight: '800' },
  barRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  barDate: { color: colors.textMuted, fontSize: 11, width: 44 },
  barTrack: { flex: 1, height: 14, backgroundColor: colors.surfaceAlt, borderRadius: 7, marginHorizontal: 8, overflow: 'hidden' },
  barFill: { height: 14, backgroundColor: colors.primary, borderRadius: 7 },
  barVal: { color: colors.text, fontSize: 12, fontWeight: '700', width: 52, textAlign: 'right' },
});
