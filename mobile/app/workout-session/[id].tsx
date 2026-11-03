import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Input } from '../../components/Input';
import { MuscleButton } from '../../components/MuscleMap';
import { useAuth } from '../../lib/auth';
import { DeepSeekError, estimateWorkoutCalories, hasApiKey } from '../../lib/ai/deepseek';
import {
  addExerciseToSession,
  addSetToExercise,
  deleteSession,
  deleteSessionExercise,
  deleteSet,
  getSessionFull,
  LastPerformance,
  lastPerformances,
  renameSessionExercise,
  setSessionKcal,
  updateSet,
} from '../../lib/repos/workoutSessions';
import { colors, radius, spacing } from '../../lib/theme';
import { useSheetBottomPadding } from '../../lib/safeArea';
import { WorkoutSessionFull, WorkoutSessionSet } from '../../lib/types';

const fmtKg = (n: number) => String(n).replace('.', ',');
const fmtDia = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/** Janela de exercício: incluir um novo ou renomear um existente. */
type ExForm = { mode: 'add' } | { mode: 'rename'; name: string; position: number };

export default function WorkoutSessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const sessionId = Number(id);
  const router = useRouter();
  const auth = useAuth();
  const [estimando, setEstimando] = useState(false);

  const [session, setSession] = useState<WorkoutSessionFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [exForm, setExForm] = useState<ExForm | null>(null);
  const [last, setLast] = useState<Record<string, LastPerformance>>({});
  const [exName, setExName] = useState('');
  const [exSets, setExSets] = useState('3');
  const sheetBottom = useSheetBottomPadding();

  const load = useCallback(async () => {
    const s = await getSessionFull(sessionId);
    setSession(s);
    setLast(await lastPerformances(sessionId));
    setLoading(false);
  }, [sessionId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  /** Carga/reps da última vez para a mesma série (ou a última série anotada). */
  function sugestao(exName: string, setNumber: number) {
    const lp = last[exName];
    if (!lp) return null;
    return lp.sets.find((x) => x.set_number === setNumber) ?? lp.sets[lp.sets.length - 1];
  }

  async function toggle(set: WorkoutSessionSet, exName: string) {
    const marcando = !set.done;
    const sug = marcando ? sugestao(exName, set.set_number) : null;
    // Marcou "feito" sem digitar: vale a carga/reps da última vez (sugerida no campo).
    await updateSet(set.id, {
      done: marcando,
      ...(sug && set.load_kg == null && sug.load_kg != null ? { load_kg: sug.load_kg } : {}),
      ...(sug && set.reps == null && sug.reps != null ? { reps: sug.reps } : {}),
    });
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

  async function concluir() {
    if (!session || auth.status !== 'authed') {
      router.back();
      return;
    }

    // Resumo dos exercícios com pelo menos uma série feita.
    const exercises = session.exercises
      .map((ex) => {
        const feitas = ex.sets.filter((s) => s.done);
        if (feitas.length === 0) return null;
        return {
          name: ex.name,
          sets: feitas.length,
          reps: Math.max(0, ...feitas.map((s) => s.reps ?? 0)) || null,
          load_kg: Math.max(0, ...feitas.map((s) => s.load_kg ?? 0)) || null,
        };
      })
      .filter((e): e is NonNullable<typeof e> => e !== null);

    if (exercises.length === 0) {
      router.back(); // nada concluído — não há o que estimar
      return;
    }

    if (!(await hasApiKey())) {
      Alert.alert(
        'Estimar calorias',
        'Para estimar o gasto calórico da musculação com IA, cadastre sua chave DeepSeek no Perfil. O treino foi salvo mesmo assim.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
      return;
    }

    setEstimando(true);
    try {
      const kcal = await estimateWorkoutCalories(auth.user, { name: session.name, exercises });
      await setSessionKcal(sessionId, kcal);
      Alert.alert('Treino concluído', `Gasto estimado: ${kcal} kcal.`, [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e) {
      const msg = e instanceof DeepSeekError ? e.message : 'Não foi possível estimar as calorias agora.';
      Alert.alert('Treino salvo', `${msg} O treino foi salvo mesmo assim.`, [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } finally {
      setEstimando(false);
    }
  }

  function abrirNovoExercicio() {
    setExName('');
    setExSets('3');
    setExForm({ mode: 'add' });
  }

  function menuExercicio(name: string, position: number) {
    Alert.alert(name, undefined, [
      {
        text: 'Renomear',
        onPress: () => {
          setExName(name);
          setExForm({ mode: 'rename', name, position });
        },
      },
      {
        text: 'Remover exercício',
        style: 'destructive',
        onPress: () =>
          Alert.alert('Remover exercício', `Tirar "${name}" deste treino (com as séries anotadas)?`, [
            { text: 'Cancelar', style: 'cancel' },
            {
              text: 'Remover',
              style: 'destructive',
              onPress: async () => {
                await deleteSessionExercise(sessionId, name, position);
                await load();
              },
            },
          ]),
      },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  }

  async function salvarExercicio() {
    if (!exForm || !exName.trim()) return;
    if (exForm.mode === 'add') {
      await addExerciseToSession(sessionId, exName, Math.min(10, parseInt(exSets, 10) || 3));
    } else {
      await renameSessionExercise(sessionId, exForm.name, exForm.position, exName);
    }
    setExForm(null);
    await load();
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
          {session.estimated_kcal != null && (
            <Text style={styles.kcalLine}>≈ {session.estimated_kcal} kcal gastas (estimativa IA)</Text>
          )}
        </Card>

        {session.exercises.map((ex) => (
          <Card key={`${ex.position}-${ex.name}`}>
            <View style={styles.exHeader}>
              <Text style={[styles.exName, { flex: 1, marginBottom: 0 }]}>{ex.name}</Text>
              <MuscleButton exerciseName={ex.name} />
              <Pressable onPress={() => menuExercicio(ex.name, ex.position)} hitSlop={10} style={styles.exMenu}>
                <Ionicons name="ellipsis-vertical" size={18} color={colors.textMuted} />
              </Pressable>
            </View>

            <View style={styles.headerRow}>
              <Text style={[styles.colHead, styles.colSet]}>Série</Text>
              <Text style={[styles.colHead, styles.colInput]}>Reps</Text>
              <Text style={[styles.colHead, styles.colInput]}>Carga (kg)</Text>
              <Text style={[styles.colHead, styles.colCheck]}>Feito</Text>
            </View>

            {last[ex.name] && (
              <Text style={styles.lastLine}>
                Última vez ({fmtDia(last[ex.name].performed_at)}):{' '}
                <Text style={styles.lastVals}>
                  {last[ex.name].sets
                    .map((x) => `${x.load_kg != null ? `${fmtKg(x.load_kg)} kg` : '—'}${x.reps != null ? ` × ${x.reps}` : ''}`)
                    .join('  ·  ')}
                </Text>
              </Text>
            )}

            {ex.sets.map((set) => {
              const sug = sugestao(ex.name, set.set_number);
              return (
              <View key={set.id} style={styles.setRow}>
                <Text style={[styles.setNum, styles.colSet]}>{set.set_number}</Text>
                <TextInput
                  style={[styles.cell, styles.colInput, set.done && styles.cellDone]}
                  keyboardType="number-pad"
                  key={`r-${set.id}-${set.reps}`}
                  placeholder={sug?.reps != null ? String(sug.reps) : '—'}
                  placeholderTextColor={colors.textMuted}
                  defaultValue={set.reps?.toString() ?? ''}
                  onEndEditing={(e) => alterarReps(set, e.nativeEvent.text)}
                />
                <TextInput
                  style={[styles.cell, styles.colInput, set.done && styles.cellDone]}
                  keyboardType="decimal-pad"
                  key={`c-${set.id}-${set.load_kg}`}
                  placeholder={sug?.load_kg != null ? fmtKg(sug.load_kg) : '—'}
                  placeholderTextColor={colors.textMuted}
                  defaultValue={set.load_kg?.toString() ?? ''}
                  onEndEditing={(e) => alterarCarga(set, e.nativeEvent.text)}
                />
                <Pressable
                  onPress={() => toggle(set, ex.name)}
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
              );
            })}

            <Pressable
              onPress={() => addSetToExercise(sessionId, ex.name, ex.position).then(load)}
              style={styles.addSet}
            >
              <Ionicons name="add" size={16} color={colors.primary} />
              <Text style={styles.addSetTxt}>Adicionar série</Text>
            </Pressable>
          </Card>
        ))}

        {session.exercises.length === 0 && (
          <Card>
            <Text style={{ color: colors.textMuted, textAlign: 'center' }}>
              Nenhum exercício ainda. Inclua abaixo o que você vai fazer.
            </Text>
          </Card>
        )}

        <Pressable style={styles.addEx} onPress={abrirNovoExercicio}>
          <Ionicons name="add" size={18} color={colors.primary} />
          <Text style={styles.addExTxt}>Incluir exercício</Text>
        </Pressable>

        <Pressable style={[styles.done, estimando && styles.doneOff]} onPress={concluir} disabled={estimando}>
          {estimando ? (
            <ActivityIndicator color={colors.bg} />
          ) : (
            <Text style={styles.doneTxt}>Concluir e estimar calorias</Text>
          )}
        </Pressable>
      </ScrollView>

      <Modal visible={exForm != null} animationType="slide" transparent onRequestClose={() => setExForm(null)}>
        <View style={styles.backdrop}>
          <View style={[styles.sheet, { paddingBottom: sheetBottom }]}>
            <Text style={styles.sheetTitle}>
              {exForm?.mode === 'rename' ? 'Renomear exercício' : 'Incluir exercício'}
            </Text>
            <Input label="Nome" value={exName} onChangeText={setExName} placeholder="Ex.: Remada baixa" />
            {exForm?.mode === 'add' && (
              <Input
                label="Séries"
                value={exSets}
                onChangeText={(v) => setExSets(v.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
                placeholder="3"
              />
            )}
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Button title="Cancelar" variant="secondary" onPress={() => setExForm(null)} style={{ flex: 1 }} />
              <Button title="Salvar" onPress={salvarExercicio} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  progress: { color: colors.primary, fontSize: 15, fontWeight: '700', textAlign: 'center' },
  kcalLine: { color: colors.textMuted, fontSize: 13, textAlign: 'center', marginTop: 4 },
  lastLine: { color: colors.textMuted, fontSize: 12, marginBottom: spacing.sm },
  lastVals: { color: colors.primary, fontWeight: '700' },
  exHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  exMenu: { paddingLeft: 2 },
  addEx: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed',
    borderRadius: radius.md, paddingVertical: 12, marginBottom: spacing.md,
  },
  addExTxt: { color: colors.primary, fontSize: 14, fontWeight: '600', marginLeft: 4 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
  },
  sheetTitle: { color: colors.text, fontSize: 18, fontWeight: '700', marginBottom: spacing.md },
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
  doneOff: { opacity: 0.7 },
  doneTxt: { color: colors.bg, fontWeight: '800', fontSize: 16 },
});
