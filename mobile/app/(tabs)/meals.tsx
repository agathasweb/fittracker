import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
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
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { useAuth } from '../../lib/auth';
import { formatTime, todayISO } from '../../lib/format';
import {
  createMealFromTemplate,
  deleteMeal,
  listMealsOfDay,
  MealWithSummary,
} from '../../lib/repos/meals';
import {
  deleteTemplate,
  listTemplates,
  TemplateSummary,
} from '../../lib/repos/mealTemplates';
import { colors, radius, spacing } from '../../lib/theme';
import { MEAL_TYPE_LABEL } from '../../lib/types';

type View_ = 'today' | 'templates';

export default function MealsScreen() {
  const auth = useAuth();
  const router = useRouter();
  const userId = auth.status === 'authed' ? auth.user.id : null;

  const [view, setView] = useState<View_>('today');
  const [meals, setMeals] = useState<MealWithSummary[]>([]);
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [pickTplOpen, setPickTplOpen] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    const [ms, ts] = await Promise.all([
      listMealsOfDay(userId, todayISO()),
      listTemplates(userId),
    ]);
    setMeals(ms);
    setTemplates(ts);
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (!userId) return null;

  async function logFromTemplate(t: TemplateSummary) {
    await createMealFromTemplate(userId!, t.id);
    setPickTplOpen(false);
    await load();
  }

  function removeMeal(m: MealWithSummary) {
    Alert.alert('Remover refeição', 'Tem certeza?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          await deleteMeal(m.id);
          await load();
        },
      },
    ]);
  }

  function removeTemplate(t: TemplateSummary) {
    Alert.alert('Excluir refeição padrão', `Excluir "${t.name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          await deleteTemplate(t.id);
          await load();
        },
      },
    ]);
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={styles.toggleRow}>
        <Pressable
          onPress={() => setView('today')}
          style={[styles.toggle, view === 'today' && styles.toggleActive]}
        >
          <Text style={[styles.toggleText, view === 'today' && styles.toggleTextActive]}>
            Hoje
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setView('templates')}
          style={[styles.toggle, view === 'templates' && styles.toggleActive]}
        >
          <Text style={[styles.toggleText, view === 'templates' && styles.toggleTextActive]}>
            Padrões
          </Text>
        </Pressable>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: spacing.md, paddingBottom: 100 }}
      >
        {view === 'today' ? (
          meals.length === 0 ? (
            <Card>
              <Text style={styles.empty}>
                Nenhuma refeição registrada hoje. Toque no botão + abaixo pra começar.
              </Text>
            </Card>
          ) : (
            meals.map((m) => (
              <Pressable key={m.id} onLongPress={() => removeMeal(m)}>
                <Card>
                  <View style={styles.mealHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.mealType}>{MEAL_TYPE_LABEL[m.meal_type]}</Text>
                      <Text style={styles.mealName}>
                        {m.template_name ?? 'Refeição avulsa'}
                      </Text>
                    </View>
                    <Text style={styles.mealKcal}>{Math.round(m.total_kcal)} kcal</Text>
                  </View>
                  <Text style={styles.mealMeta}>
                    {formatTime(m.consumed_at)} · {m.item_count} item{m.item_count !== 1 ? 's' : ''}
                  </Text>
                </Card>
              </Pressable>
            ))
          )
        ) : templates.length === 0 ? (
          <Card>
            <Text style={styles.empty}>
              Cadastre suas refeições mais frequentes pra lançá-las com um toque.
            </Text>
          </Card>
        ) : (
          templates.map((t) => (
            <Pressable
              key={t.id}
              onPress={() => router.push(`/meal-template/${t.id}`)}
              onLongPress={() => removeTemplate(t)}
            >
              <Card>
                <View style={styles.mealHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.mealType}>{MEAL_TYPE_LABEL[t.meal_type]}</Text>
                    <Text style={styles.mealName}>{t.name}</Text>
                  </View>
                  <Text style={styles.mealKcal}>{Math.round(t.total_kcal)} kcal</Text>
                </View>
                <Text style={styles.mealMeta}>
                  {t.item_count} item{t.item_count !== 1 ? 's' : ''} · toque para editar · segure para excluir
                </Text>
              </Card>
            </Pressable>
          ))
        )}
      </ScrollView>

      <Pressable
        style={styles.fab}
        onPress={() => {
          if (view === 'today') {
            if (templates.length === 0) {
              Alert.alert(
                'Sem refeições padrão',
                'Cadastre primeiro uma refeição padrão pra poder lançar com um toque.',
                [
                  {
                    text: 'Criar padrão',
                    onPress: () => router.push('/meal-template/new'),
                  },
                  { text: 'Cancelar', style: 'cancel' },
                ]
              );
              return;
            }
            setPickTplOpen(true);
          } else {
            router.push('/meal-template/new');
          }
        }}
      >
        <Ionicons name="add" size={28} color={colors.bg} />
      </Pressable>

      <Modal
        visible={pickTplOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setPickTplOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Lançar refeição</Text>
            <Text style={styles.modalSub}>Escolha uma das suas refeições padrão:</Text>
            <ScrollView style={{ maxHeight: 360 }}>
              {templates.map((t) => (
                <Pressable
                  key={t.id}
                  onPress={() => logFromTemplate(t)}
                  style={styles.tplPick}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.tplPickType}>{MEAL_TYPE_LABEL[t.meal_type]}</Text>
                    <Text style={styles.tplPickName}>{t.name}</Text>
                  </View>
                  <Text style={styles.tplPickKcal}>{Math.round(t.total_kcal)} kcal</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Button
              title="Cancelar"
              variant="secondary"
              onPress={() => setPickTplOpen(false)}
              style={{ marginTop: spacing.md }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  toggleRow: {
    flexDirection: 'row',
    padding: spacing.md,
    paddingBottom: 0,
    gap: spacing.sm,
  },
  toggle: {
    flex: 1,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  toggleActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  toggleText: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 14,
  },
  toggleTextActive: {
    color: colors.bg,
  },
  empty: { color: colors.textMuted, textAlign: 'center' },
  mealHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  mealType: {
    color: colors.textMuted,
    fontSize: 11,
    letterSpacing: 1,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  mealName: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    marginTop: 2,
  },
  mealKcal: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '700',
  },
  mealMeta: { color: colors.textMuted, fontSize: 12, marginTop: spacing.xs },
  fab: {
    position: 'absolute',
    right: spacing.md,
    bottom: spacing.md,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  modalSub: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 4,
    marginBottom: spacing.md,
  },
  tplPick: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tplPickType: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  tplPickName: { color: colors.text, fontWeight: '700', fontSize: 15, marginTop: 2 },
  tplPickKcal: { color: colors.primary, fontWeight: '700' },
});
