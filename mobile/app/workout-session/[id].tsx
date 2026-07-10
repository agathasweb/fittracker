import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Card } from '../../components/Card';
import {
  addSetToExercise,
  deleteSession,
  deleteSet,
  getSessionFull,
  updateSet,
} from '../../lib/repos/workoutSessions';
import { colors, radius, spacing } from '../../lib/theme';
import { WorkoutSessionFull, WorkoutSessionSet } from '../../lib/types';

export default function WorkoutSessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const sessionId = Number(id);
  const router = useRouter();

  const [session, setSession] = useState<WorkoutSessionFull | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const s = await getSessionFull(sessionId);
    setSession(s);
    setLoading(false);
  }, [sessionId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function toggle(set: WorkoutSessionSet) {
    await updateSet(set.id, { done: !set.done });
    await load();
  }

  async function alterarReps(set: WorkoutSessionSet, texto: string) {
    const n = texto.trim() === '' ? null : parseInt(texto, 10);
    await updateSet(set.id, { reps: Number.isNaN(n as number) ? null : n });
  }

  async function alterarCarga(set: WorkoutSessionSet, texto: string) {
    const t = texto.replace(',', '.').trim();
    const n = t === '' ? null : parseFloat(t);
    await updateSet(set.id, { load_kg: Number.isNaN(n as number) ? null : n });
  }

  function removerSessao() {
    Alert.alert('Excluir treino', 'Remover esta sessão e todos os registros dela?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          await deleteSession(sessionId);
          router.back();
        },
      },
    ]);
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (!session) {
    return (
      <View style={styles.center}>
        <Text style={{ color: colors.textMuted }}>Sessão não encontrada.</Text>
      </View>
    );
  }

  const feitas = session.exercises.reduce(
    (acc, ex) => acc + ex.sets.filter((s) => s.done).length,
    0
  );
  const total = session.exercises.reduce((acc, ex) => acc + ex.sets.length, 0);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen
        options={{
          title: session.name,
          headerRight: () => (
            <Pressable onPress={removerSessao} hitSlop={8}>
              <Ionicons name="trash-outline" size={20} color={colors.danger} />
            </Pressable>
          ),
        }}
      />
      <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 60 }}>
        <Card>
          <Text style={styles.progress}>
            {feitas}/{total} séries concluídas
          </Text>
        </Card>

        {session.exercises.map((ex) => (
          <Card key={`${ex.position}-${ex.name}`}>
            <Text style={styles.exName}>{ex.name}</Text>

            <View style={styles.headerRow}>
              <Text style={[styles.colHead, styles.colSet]}>Série</Text>
              <Text style={[styles.colHead, styles.colInput]}>Reps</Text>
              <Text style={[styles.colHead, styles.colInput]}>Carga (kg)</Text>
              <Text style={[styles.colHead, styles.colCheck]}>Feito</Text>
            </View>

            {ex.sets.map((set) => (
              <View key={set.id} style={styles.setRow}>
                <Text style={[styles.setNum, styles.colSet]}>{set.set_number}</Text>
                <TextInput
                  style={[styles.cell, styles.colInput, set.done && styles.cellDone]}
                  keyboardType="number-pad"
                  placeholder="—"
                  placeholderTextColor={colors.textMuted}
                  defaultValue={set.reps?.toString() ?? ''}
                  onEndEditing={(e) => alterarReps(set, e.nativeEvent.text)}
                />
                <TextInput
                  style={[styles.cell, styles.colInput, set.done && styles.cellDone]}
                  keyboardType="decimal-pad"
                  placeholder="—"
                  placeholderTextColor={colors.textMuted}
                  defaultValue={set.load_kg?.toString() ?? ''}
                  onEndEditing={(e) => alterarCarga(set, e.nativeEvent.text)}
                />
                <Pressable
                  onPress={() => toggle(set)}
                  style={[styles.colCheck, styles.checkWrap]}
                  hitSlop={6}
                >
                  <Ionicons
                    name={set.done ? 'checkmark-circle' : 'ellipse-outline'}
                    size={26}
                    color={set.done ? colors.primary : colors.textMuted}
                  />
                </Pressable>
                <Pressable onPress={() => deleteSet(set.id).then(load)} hitSlop={6} style={styles.rmSet}>
                  <Ionicons name="close" size={16} color={colors.textMuted} />
                </Pressable>
              </View>
            ))}

            <Pressable
              onPress={() => addSetToExercise(sessionId, ex.name, ex.position).then(load)}
              style={styles.addSet}
            >
              <Ionicons name="add" size={16} color={colors.primary} />
              <Text style={styles.addSetTxt}>Adicionar série</Text>
            </Pressable>
          </Card>
        ))}

        <Pressable style={styles.done} onPress={() => router.back()}>
          <Text style={styles.doneTxt}>Concluir treino</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  progress: { color: colors.primary, fontSize: 15, fontWeight: '700', textAlign: 'center' },
  exName: { color: colors.text, fontSize: 16, fontWeight: '700', marginBottom: spacing.sm },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  colHead: { color: colors.textMuted, fontSize: 11, fontWeight: '600' },
  colSet: { width: 44 },
  colInput: { flex: 1, textAlign: 'center' },
  colCheck: { width: 40, alignItems: 'center' },
  setRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  setNum: { color: colors.text, fontSize: 14, fontWeight: '700' },
  cell: {
    backgroundColor: colors.surface, color: colors.text, borderRadius: radius.sm ?? 8,
    borderWidth: 1, borderColor: colors.border, paddingVertical: 8, marginHorizontal: 4, fontSize: 15,
  },
  cellDone: { borderColor: colors.primary },
  checkWrap: { alignItems: 'center' },
  rmSet: { paddingLeft: 4 },
  addSet: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', marginTop: 4, padding: 4 },
  addSetTxt: { color: colors.primary, fontSize: 13, fontWeight: '600', marginLeft: 2 },
  done: {
    backgroundColor: colors.primary, borderRadius: 999, paddingVertical: 15,
    alignItems: 'center', marginTop: spacing.lg,
  },
  doneTxt: { color: colors.bg, fontWeight: '800', fontSize: 16 },
});
