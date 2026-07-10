import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
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
import { useAuth } from '../../lib/auth';
import {
  createTemplate,
  deleteTemplate,
  getTemplateFull,
  NewTemplateExercise,
  updateTemplate,
} from '../../lib/repos/workoutTemplates';
import { colors, radius, spacing } from '../../lib/theme';

type LinhaExercicio = { name: string; target_sets: string; target_reps: string; notes: string };

const VAZIA: LinhaExercicio = { name: '', target_sets: '3', target_reps: '12', notes: '' };

export default function TemplateEditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const novo = id === 'new';
  const templateId = novo ? null : Number(id);
  const router = useRouter();
  const auth = useAuth();
  const userId = auth.status === 'authed' ? auth.user.id : null;

  const [nome, setNome] = useState('');
  const [notas, setNotas] = useState('');
  const [exs, setExs] = useState<LinhaExercicio[]>([{ ...VAZIA }]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (novo || templateId === null) return;
    (async () => {
      const t = await getTemplateFull(templateId);
      if (!t) return;
      setNome(t.name);
      setNotas(t.notes ?? '');
      setExs(
        t.exercises.length
          ? t.exercises.map((e) => ({
              name: e.name,
              target_sets: String(e.target_sets),
              target_reps: e.target_reps ?? '',
              notes: e.notes ?? '',
            }))
          : [{ ...VAZIA }]
      );
    })();
  }, [novo, templateId]);

  const setLinha = useCallback((i: number, patch: Partial<LinhaExercicio>) => {
    setExs((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }, []);

  function addExercicio() {
    setExs((prev) => [...prev, { ...VAZIA }]);
  }
  function removerExercicio(i: number) {
    setExs((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function salvar() {
    setErro(null);
    if (!userId) return;
    if (!nome.trim()) {
      setErro('Dê um nome ao treino.');
      return;
    }
    const limpos: NewTemplateExercise[] = exs
      .filter((e) => e.name.trim())
      .map((e) => ({
        name: e.name,
        target_sets: parseInt(e.target_sets, 10) || 1,
        target_reps: e.target_reps,
        notes: e.notes,
      }));
    if (limpos.length === 0) {
      setErro('Adicione ao menos um exercício.');
      return;
    }

    setSalvando(true);
    try {
      if (novo || templateId === null) {
        await createTemplate(userId, nome, limpos, notas);
      } else {
        await updateTemplate(templateId, nome, limpos, notas);
      }
      router.back();
    } catch (e: any) {
      setErro(e?.message ?? 'Não foi possível salvar.');
    } finally {
      setSalvando(false);
    }
  }

  function excluir() {
    if (templateId === null) return;
    Alert.alert('Excluir treino', `Remover "${nome}"? As sessões já registradas continuam no histórico.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          await deleteTemplate(templateId);
          router.back();
        },
      },
    ]);
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen
        options={{
          title: novo ? 'Novo treino' : 'Editar treino',
          headerRight: () =>
            novo ? null : (
              <Pressable onPress={excluir} hitSlop={8}>
                <Ionicons name="trash-outline" size={20} color={colors.danger} />
              </Pressable>
            ),
        }}
      />
      <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 60 }}>
        <Card>
          <Input label="Nome do treino" value={nome} onChangeText={setNome} placeholder="Ex.: Treino A — Pernas" />
          <Input label="Observação (opcional)" value={notas} onChangeText={setNotas} placeholder="Ex.: Segunda. Cardio ao fim." />
        </Card>

        <Text style={styles.section}>Exercícios</Text>
        {exs.map((ex, i) => (
          <Card key={i}>
            <View style={styles.exHeader}>
              <Text style={styles.exNum}>#{i + 1}</Text>
              {exs.length > 1 && (
                <Pressable onPress={() => removerExercicio(i)} hitSlop={8}>
                  <Ionicons name="close-circle" size={20} color={colors.textMuted} />
                </Pressable>
              )}
            </View>
            <Input value={ex.name} onChangeText={(v) => setLinha(i, { name: v })} placeholder="Nome do exercício" />
            <View style={styles.row}>
              <View style={{ flex: 1, marginRight: spacing.sm }}>
                <Input label="Séries" value={ex.target_sets} onChangeText={(v) => setLinha(i, { target_sets: v.replace(/[^0-9]/g, '') })} keyboardType="number-pad" placeholder="3" />
              </View>
              <View style={{ flex: 1 }}>
                <Input label="Reps alvo" value={ex.target_reps} onChangeText={(v) => setLinha(i, { target_reps: v })} placeholder="12" />
              </View>
            </View>
            <Input value={ex.notes} onChangeText={(v) => setLinha(i, { notes: v })} placeholder="Observação (opcional)" />
          </Card>
        ))}

        <Pressable style={styles.addEx} onPress={addExercicio}>
          <Ionicons name="add" size={18} color={colors.primary} />
          <Text style={styles.addExTxt}>Adicionar exercício</Text>
        </Pressable>

        {erro && <Text style={styles.erro}>{erro}</Text>}
        <Button title="Salvar treino" onPress={salvar} loading={salvando} style={{ marginTop: spacing.md }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  section: { color: colors.text, fontSize: 16, fontWeight: '700', marginTop: spacing.lg, marginBottom: spacing.sm, paddingHorizontal: 4 },
  exHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  exNum: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  row: { flexDirection: 'row' },
  addEx: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed',
    borderRadius: radius.md ?? 12, paddingVertical: 12, marginTop: spacing.xs,
  },
  addExTxt: { color: colors.primary, fontSize: 14, fontWeight: '600', marginLeft: 4 },
  erro: { color: colors.danger, fontSize: 14, textAlign: 'center', marginTop: spacing.md },
});
