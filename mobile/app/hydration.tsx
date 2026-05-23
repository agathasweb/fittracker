import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Input } from '../components/Input';
import { ProgressBar } from '../components/ProgressBar';
import { useAuth } from '../lib/auth';
import { formatTime, todayISO } from '../lib/format';
import { useRequireAuth } from '../lib/guards';
import {
  createBottle,
  deleteBottle,
  listBottles,
  toggleBottleFavorite,
} from '../lib/repos/bottles';
import {
  addEntry,
  deleteEntry,
  HydrationEntryWithBottle,
  listEntriesOfDay,
  sumMlOfDay,
} from '../lib/repos/hydration';
import { updateUser } from '../lib/repos/users';
import { colors, radius, spacing } from '../lib/theme';
import { Bottle } from '../lib/types';

export default function HydrationScreen() {
  const auth = useAuth();
  useRequireAuth();
  const userId = auth.status === 'authed' ? auth.user.id : null;
  const user = auth.status === 'authed' ? auth.user : null;

  const [bottles, setBottles] = useState<Bottle[]>([]);
  const [entries, setEntries] = useState<HydrationEntryWithBottle[]>([]);
  const [totalMl, setTotalMl] = useState(0);

  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCapacity, setNewCapacity] = useState('');
  const [createErrors, setCreateErrors] = useState<Record<string, string>>({});

  const [goalOpen, setGoalOpen] = useState(false);
  const [goalDraft, setGoalDraft] = useState('');

  const load = useCallback(async () => {
    if (!userId) return;
    const day = todayISO();
    const [bs, es, sum] = await Promise.all([
      listBottles(userId),
      listEntriesOfDay(userId, day),
      sumMlOfDay(userId, day),
    ]);
    setBottles(bs);
    setEntries(es);
    setTotalMl(sum);
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (!user || !userId) return null;

  async function logBottle(b: Bottle) {
    await addEntry(userId!, b.capacity_ml, b.id);
    await load();
  }

  function openCreate() {
    setNewName('');
    setNewCapacity('');
    setCreateErrors({});
    setCreateOpen(true);
  }

  async function saveBottle() {
    const errs: Record<string, string> = {};
    if (!newName.trim()) errs.name = 'Informe um nome';
    const cap = Number(newCapacity);
    if (!cap || cap < 50 || cap > 5000) errs.capacity = '50–5000 ml';
    setCreateErrors(errs);
    if (Object.keys(errs).length) return;
    await createBottle(userId!, newName, cap, true);
    setCreateOpen(false);
    await load();
  }

  async function removeBottle(b: Bottle) {
    Alert.alert('Remover garrafa', `Excluir "${b.name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          await deleteBottle(b.id);
          await load();
        },
      },
    ]);
  }

  async function toggleFavorite(b: Bottle) {
    await toggleBottleFavorite(b.id);
    await load();
  }

  async function removeEntry(id: number) {
    await deleteEntry(id);
    await load();
  }

  function openGoalEdit() {
    setGoalDraft(String(user!.daily_water_goal_ml));
    setGoalOpen(true);
  }

  async function saveGoal() {
    const v = Number(goalDraft);
    if (!v || v < 500 || v > 8000) return;
    await updateUser(userId!, { daily_water_goal_ml: v });
    await auth.reload();
    setGoalOpen(false);
  }

  const pct = Math.min(1, totalMl / user.daily_water_goal_ml);
  const remaining = Math.max(0, user.daily_water_goal_ml - totalMl);

  return (
    <ScrollView style={{ backgroundColor: colors.bg, flex: 1 }} contentContainerStyle={{ padding: spacing.md }}>
      <Card>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardLabel}>HOJE</Text>
            <Text style={styles.totalValue}>
              {totalMl} <Text style={styles.unit}>ml</Text>
            </Text>
            <Text style={styles.goalLine}>
              Meta {user.daily_water_goal_ml} ml · faltam {remaining} ml
            </Text>
          </View>
          <Pressable onPress={openGoalEdit} style={styles.editGoalBtn}>
            <Ionicons name="create-outline" size={20} color={colors.textMuted} />
          </Pressable>
        </View>
        <ProgressBar value={totalMl} max={user.daily_water_goal_ml} height={14} />
        <Text style={styles.pctLine}>{Math.round(pct * 100)}% da meta</Text>
      </Card>

      <View style={styles.sectionRow}>
        <Text style={styles.sectionTitle}>Minhas garrafas</Text>
        <Pressable onPress={openCreate} style={styles.addBtn}>
          <Ionicons name="add" size={18} color={colors.primary} />
          <Text style={styles.addBtnText}>Nova</Text>
        </Pressable>
      </View>

      {bottles.length === 0 ? (
        <Card>
          <Text style={styles.emptyText}>
            Você ainda não cadastrou nenhuma garrafa. Adicione a sua mais usada — clicar nela registra uma porção.
          </Text>
        </Card>
      ) : (
        bottles.map((b) => (
          <View key={b.id} style={styles.bottleRow}>
            <Pressable
              style={styles.bottleMain}
              onPress={() => logBottle(b)}
              onLongPress={() => removeBottle(b)}
            >
              <View style={styles.bottleIcon}>
                <Ionicons name="water" size={22} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.bottleName}>{b.name}</Text>
                <Text style={styles.bottleSub}>{b.capacity_ml} ml · toque para +1</Text>
              </View>
            </Pressable>
            <Pressable onPress={() => toggleFavorite(b)} style={styles.starBtn}>
              <Ionicons
                name={b.is_favorite ? 'star' : 'star-outline'}
                size={22}
                color={b.is_favorite ? colors.warning : colors.textMuted}
              />
            </Pressable>
          </View>
        ))
      )}

      <Text style={[styles.sectionTitle, { marginTop: spacing.lg }]}>Lançamentos de hoje</Text>
      {entries.length === 0 ? (
        <Card>
          <Text style={styles.emptyText}>Nenhum lançamento ainda hoje.</Text>
        </Card>
      ) : (
        entries.map((e) => (
          <View key={e.id} style={styles.entryRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.entryMl}>{e.ml} ml</Text>
              <Text style={styles.entryMeta}>
                {formatTime(e.consumed_at)}
                {e.bottle_name ? ` · ${e.bottle_name}` : ''}
              </Text>
            </View>
            <Pressable onPress={() => removeEntry(e.id)} style={styles.removeBtn}>
              <Ionicons name="close" size={18} color={colors.danger} />
            </Pressable>
          </View>
        ))
      )}

      <Modal visible={createOpen} animationType="slide" transparent onRequestClose={() => setCreateOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Nova garrafa</Text>
            <Input
              label="Nome"
              value={newName}
              onChangeText={setNewName}
              placeholder='Ex: "trabalho", "academia"'
              error={createErrors.name}
            />
            <Input
              label="Capacidade (ml)"
              value={newCapacity}
              onChangeText={setNewCapacity}
              keyboardType="numeric"
              placeholder="750"
              error={createErrors.capacity}
            />
            <View style={styles.modalBtns}>
              <Button title="Cancelar" variant="secondary" onPress={() => setCreateOpen(false)} style={{ flex: 1 }} />
              <Button title="Salvar" onPress={saveBottle} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={goalOpen} animationType="fade" transparent onRequestClose={() => setGoalOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Meta diária de água</Text>
            <Input
              label="Meta (ml)"
              value={goalDraft}
              onChangeText={setGoalDraft}
              keyboardType="numeric"
              hint="Recomendação geral: 35 ml por kg"
            />
            <View style={styles.modalBtns}>
              <Button title="Cancelar" variant="secondary" onPress={() => setGoalOpen(false)} style={{ flex: 1 }} />
              <Button title="Salvar" onPress={saveGoal} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  cardLabel: {
    color: colors.textMuted,
    fontSize: 11,
    letterSpacing: 1.5,
    fontWeight: '600',
  },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.sm },
  totalValue: { color: colors.text, fontSize: 36, fontWeight: '800', marginTop: 2 },
  unit: { color: colors.textMuted, fontSize: 18, fontWeight: '600' },
  goalLine: { color: colors.textMuted, fontSize: 13 },
  pctLine: { color: colors.textMuted, fontSize: 12, marginTop: spacing.xs, textAlign: 'right' },
  editGoalBtn: { padding: spacing.xs },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: spacing.xs },
  addBtnText: { color: colors.primary, fontWeight: '700' },
  emptyText: { color: colors.textMuted, fontSize: 13, textAlign: 'center' },
  bottleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingRight: spacing.sm,
    marginBottom: spacing.sm,
  },
  bottleMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
    padding: spacing.md,
  },
  bottleIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottleName: { color: colors.text, fontWeight: '700', fontSize: 15 },
  bottleSub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  starBtn: { padding: spacing.sm },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.xs,
  },
  entryMl: { color: colors.text, fontSize: 15, fontWeight: '700' },
  entryMeta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  removeBtn: { padding: spacing.xs },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: spacing.md,
  },
  modal: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: spacing.md,
  },
  modalBtns: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
});
