import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Input } from '../components/Input';
import { OptionPicker } from '../components/OptionPicker';
import { useAuth } from '../lib/auth';
import { brDateToISO, isoDateToBR, maskBrDate, todayISO } from '../lib/format';
import { useRequireAuth } from '../lib/guards';
import { CATEGORY_LABEL, createExam, ExamSummary, listExams } from '../lib/repos/exams';
import { colors, radius, spacing } from '../lib/theme';
import { ExamCategory } from '../lib/types';

const CATEGORIES = Object.entries(CATEGORY_LABEL).map(([value, label]) => ({
  value: value as ExamCategory,
  label,
}));

const CATEGORY_ICON: Record<ExamCategory, keyof typeof Ionicons.glyphMap> = {
  laboratorio: 'flask-outline',
  imagem: 'scan-outline',
  bioimpedancia: 'body-outline',
  pressao: 'heart-outline',
  receita: 'document-text-outline',
  outro: 'folder-outline',
};

export default function ExamsScreen() {
  const auth = useAuth();
  useRequireAuth();
  const router = useRouter();
  const userId = auth.status === 'authed' ? auth.user.id : null;

  const [exams, setExams] = useState<ExamSummary[]>([]);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [category, setCategory] = useState<ExamCategory>('laboratorio');
  const [place, setPlace] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!userId) return;
    setExams(await listExams(userId));
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (!userId) return null;

  function openNew() {
    setTitle('');
    setDate(isoDateToBR(todayISO()));
    setCategory('laboratorio');
    setPlace('');
    setErrors({});
    setOpen(true);
  }

  async function save() {
    const errs: Record<string, string> = {};
    if (!title.trim()) errs.title = 'Informe o nome do exame';
    const iso = brDateToISO(date);
    if (!iso) errs.date = 'Data inválida (dd/mm/aaaa)';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    const id = await createExam(userId!, { exam_date: iso!, title, category, place });
    setOpen(false);
    router.push(`/exam/${id}`);
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 100 }}>
        <Pressable style={styles.evolution} onPress={() => router.push('/exam-markers')}>
          <Ionicons name="trending-up" size={20} color={colors.primary} />
          <Text style={styles.evolutionText}>Evolução dos marcadores</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </Pressable>

        {exams.length === 0 ? (
          <Card>
            <View style={{ alignItems: 'center', paddingVertical: spacing.md }}>
              <Ionicons name="document-text-outline" size={44} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>Nenhum exame ainda</Text>
              <Text style={styles.muted}>
                Cadastre exames, laudos e receitas com os valores importantes e anexe a foto ou
                o PDF. Quando repetir, compare a evolução.
              </Text>
            </View>
          </Card>
        ) : (
          exams.map((e) => (
            <Pressable key={e.id} style={styles.row} onPress={() => router.push(`/exam/${e.id}`)}>
              <View style={styles.icon}>
                <Ionicons name={CATEGORY_ICON[e.category] ?? 'folder-outline'} size={20} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{e.title}</Text>
                <Text style={styles.muted}>
                  {isoDateToBR(e.exam_date)} · {CATEGORY_LABEL[e.category] ?? e.category}
                  {e.place ? ` · ${e.place}` : ''}
                </Text>
                <Text style={styles.meta}>
                  {e.results_count} valor(es)
                  {e.flagged_count > 0 ? ` · ${e.flagged_count} alterado(s)` : ''}
                  {e.files_count > 0 ? ` · 📎 ${e.files_count}` : ''}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>
          ))
        )}
      </ScrollView>

      <Pressable style={styles.fab} onPress={openNew}>
        <Ionicons name="add" size={28} color={colors.bg} />
      </Pressable>

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Novo exame / documento</Text>
            <Input label="Nome" value={title} onChangeText={setTitle} placeholder="Ex.: Hemograma, Glicemia" error={errors.title} />
            <Input
              label="Data"
              value={date}
              onChangeText={(t) => setDate(maskBrDate(t))}
              keyboardType="numeric"
              placeholder="dd/mm/aaaa"
              error={errors.date}
            />
            <OptionPicker label="Tipo" value={category} options={CATEGORIES} onChange={setCategory} />
            <Input label="Local / laboratório (opcional)" value={place} onChangeText={setPlace} />
            <View style={styles.btns}>
              <Button title="Cancelar" variant="secondary" onPress={() => setOpen(false)} style={{ flex: 1 }} />
              <Button title="Criar" onPress={save} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  evolution: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  evolutionText: { flex: 1, color: colors.text, fontWeight: '700', fontSize: 15 },
  emptyTitle: { color: colors.text, fontWeight: '700', fontSize: 16, marginVertical: spacing.sm },
  muted: { color: colors.textMuted, fontSize: 13 },
  meta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { color: colors.text, fontWeight: '700', fontSize: 15 },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: spacing.md },
  modal: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalTitle: { color: colors.text, fontSize: 18, fontWeight: '700', marginBottom: spacing.md },
  btns: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
});
