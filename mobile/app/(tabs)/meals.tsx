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
import { PreparoEditorModal } from '../../components/PreparoEditorModal';
import { useAuth } from '../../lib/auth';
import { formatTime, todayISO } from '../../lib/format';
import { deleteFood, isFoodInUse, listFoods } from '../../lib/repos/foods';
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
import { Food, MEAL_TYPE_LABEL } from '../../lib/types';

type View_ = 'today' | 'templates' | 'preparos';

export default function MealsScreen() {
  const auth = useAuth();
  const router = useRouter();
  const userId = auth.status === 'authed' ? auth.user.id : null;

  const [view, setView] = useState<View_>('today');
  const [meals, setMeals] = useState<MealWithSummary[]>([]);
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [preparos, setPreparos] = useState<Food[]>([]);
  const [pickTplOpen, setPickTplOpen] = useState(false);
  const [newMealMenuOpen, setNewMealMenuOpen] = useState(false);
  const [preparoEditor, setPreparoEditor] = useState<{ open: boolean; editing: Food | null }>({
    open: false,
    editing: null,
  });

  const load = useCallback(async () => {
    if (!userId) return;
    const [ms, ts, ps] = await Promise.all([
      listMealsOfDay(userId, todayISO()),
      listTemplates(userId),
      listFoods(500),
    ]);
    setMeals(ms);
    setTemplates(ts);
    setPreparos(ps);
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

  function removePreparo(p: Food) {
    Alert.alert(
      'Excluir preparo',
      `Excluir "${p.name}"? Se ele estiver em uso em alguma refeição padrão ou registrada, a exclusão será bloqueada.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            if (await isFoodInUse(p.id)) {
              Alert.alert(
                'Em uso',
                'Esse preparo está sendo usado em refeições padrão ou registradas. Remova de lá antes de excluir.'
              );
              return;
            }
            await deleteFood(p.id);
            await load();
          },
        },
      ]
    );
  }

  function openNewMealMenu() {
    if (templates.length === 0 && preparos.length === 0) {
      Alert.alert(
        'Comece pelos preparos',
        'Cadastre primeiro alguns preparos (ex.: arroz, frango grelhado) na aba "Preparos". Depois você pode montar refeições padrão ou avulsas.',
        [
          { text: 'Ir pra Preparos', onPress: () => setView('preparos') },
          { text: 'Cancelar', style: 'cancel' },
        ]
      );
      return;
    }
    setNewMealMenuOpen(true);
  }

  function onFabPress() {
    if (view === 'today') {
      openNewMealMenu();
    } else if (view === 'templates') {
      if (preparos.length === 0) {
        Alert.alert(
          'Cadastre preparos antes',
          'Uma refeição padrão é composta por preparos. Cadastre pelo menos um na aba "Preparos" primeiro.',
          [
            { text: 'Ir pra Preparos', onPress: () => setView('preparos') },
            { text: 'Cancelar', style: 'cancel' },
          ]
        );
        return;
      }
      router.push('/meal-template/new');
    } else {
      setPreparoEditor({ open: true, editing: null });
    }
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
        <Pressable
          onPress={() => setView('preparos')}
          style={[styles.toggle, view === 'preparos' && styles.toggleActive]}
        >
          <Text style={[styles.toggleText, view === 'preparos' && styles.toggleTextActive]}>
            Preparos
          </Text>
        </Pressable>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: spacing.md, paddingBottom: 100 }}
      >
        {view === 'today' && (
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
                    <View style={styles.mealActions}>
                      <Text style={styles.mealKcal}>{Math.round(m.total_kcal)} kcal</Text>
                      <Pressable
                        onPress={() => removeMeal(m)}
                        style={styles.deleteBtn}
                        hitSlop={8}
                      >
                        <Ionicons name="trash-outline" size={18} color={colors.danger} />
                      </Pressable>
                    </View>
                  </View>
                  <Text style={styles.mealMeta}>
                    {formatTime(m.consumed_at)} · {m.item_count} preparo{m.item_count !== 1 ? 's' : ''}
                  </Text>
                </Card>
              </Pressable>
            ))
          )
        )}

        {view === 'templates' && (
          templates.length === 0 ? (
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
                    <View style={styles.mealActions}>
                      <Text style={styles.mealKcal}>{Math.round(t.total_kcal)} kcal</Text>
                      <Pressable
                        onPress={() => removeTemplate(t)}
                        style={styles.deleteBtn}
                        hitSlop={8}
                      >
                        <Ionicons name="trash-outline" size={18} color={colors.danger} />
                      </Pressable>
                    </View>
                  </View>
                  <Text style={styles.mealMeta}>
                    {t.item_count} preparo{t.item_count !== 1 ? 's' : ''} · toque para editar
                  </Text>
                </Card>
              </Pressable>
            ))
          )
        )}

        {view === 'preparos' && (
          preparos.length === 0 ? (
            <Card>
              <Text style={styles.empty}>
                Cadastre seus preparos (ex.: "arroz integral cozido", "frango grelhado") com
                macros por 100g. Pode descrever o preparo e deixar a IA estimar.
              </Text>
            </Card>
          ) : (
            preparos.map((p) => {
              const u = p.unit ?? 'g';
              const isLiquid = u === 'ml';
              return (
                <Pressable
                  key={p.id}
                  onPress={() => setPreparoEditor({ open: true, editing: p })}
                  onLongPress={() => removePreparo(p)}
                >
                  <Card>
                    <View style={styles.mealHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.mealName}>
                          {isLiquid && (
                            <Ionicons name="wine-outline" size={14} color={colors.primary} />
                          )}
                          {isLiquid ? ' ' : ''}
                          {p.name}
                        </Text>
                        <Text style={styles.mealMeta}>
                          {p.kcal_per_100g} kcal/100{u} · P {p.protein_g}g · C {p.carbs_g}g · G {p.fat_g}g
                          {p.fiber_g !== null ? ` · F ${p.fiber_g}g` : ''}
                        </Text>
                      </View>
                      <Pressable
                        onPress={() => removePreparo(p)}
                        style={styles.deleteBtn}
                        hitSlop={8}
                      >
                        <Ionicons name="trash-outline" size={18} color={colors.danger} />
                      </Pressable>
                    </View>
                  </Card>
                </Pressable>
              );
            })
          )
        )}
      </ScrollView>

      <Pressable style={styles.fab} onPress={onFabPress}>
        <Ionicons name="add" size={28} color={colors.bg} />
      </Pressable>

      <Modal
        visible={newMealMenuOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setNewMealMenuOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Lançar refeição</Text>
            <Text style={styles.modalSub}>Como você quer registrar?</Text>

            <Pressable
              onPress={() => {
                setNewMealMenuOpen(false);
                if (templates.length === 0) {
                  Alert.alert(
                    'Sem refeições padrão',
                    'Cadastre primeiro uma refeição padrão na aba "Padrões" pra lançar com um toque.'
                  );
                  return;
                }
                setPickTplOpen(true);
              }}
              style={styles.menuRow}
            >
              <Ionicons name="albums-outline" size={22} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.menuTitle}>Usar uma refeição padrão</Text>
                <Text style={styles.menuSub}>
                  {templates.length} padr{templates.length === 1 ? 'ão' : 'ões'} cadastrad{templates.length === 1 ? 'a' : 'as'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>

            <Pressable
              onPress={() => {
                setNewMealMenuOpen(false);
                if (preparos.length === 0) {
                  Alert.alert(
                    'Cadastre preparos antes',
                    'Uma refeição avulsa também precisa de preparos. Cadastre na aba "Preparos" primeiro.'
                  );
                  return;
                }
                router.push('/ad-hoc-meal');
              }}
              style={styles.menuRow}
            >
              <Ionicons name="create-outline" size={22} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.menuTitle}>Refeição avulsa</Text>
                <Text style={styles.menuSub}>Montar agora com preparos e gramaturas</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>

            <Button
              title="Cancelar"
              variant="secondary"
              onPress={() => setNewMealMenuOpen(false)}
              style={{ marginTop: spacing.md }}
            />
          </View>
        </View>
      </Modal>

      <Modal
        visible={pickTplOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setPickTplOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Escolher padrão</Text>
            <Text style={styles.modalSub}>Toque numa das suas refeições padrão:</Text>
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

      <PreparoEditorModal
        visible={preparoEditor.open}
        editing={preparoEditor.editing}
        onClose={() => setPreparoEditor({ open: false, editing: null })}
        onSaved={async () => {
          setPreparoEditor({ open: false, editing: null });
          await load();
        }}
      />
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
  mealActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  deleteBtn: {
    padding: spacing.xs,
    borderRadius: radius.md,
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
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  menuTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  menuSub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
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
