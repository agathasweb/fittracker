import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Input } from '../../components/Input';
import { OptionPicker } from '../../components/OptionPicker';
import { PreparoPickerModal } from '../../components/PreparoPickerModal';
import { useAuth } from '../../lib/auth';
import { useRequireAuth } from '../../lib/guards';
import {
  addTemplateItem,
  clearTemplateManualMacros,
  createTemplate,
  getTemplate,
  getTemplateItems,
  removeTemplateItem,
  TemplateItemWithFood,
  updateTemplate,
} from '../../lib/repos/mealTemplates';
import { colors, radius, spacing } from '../../lib/theme';
import { Food, MealType, MEAL_TYPE_LABEL } from '../../lib/types';

const MEAL_TYPE_OPTIONS: { value: MealType; label: string }[] = (
  Object.keys(MEAL_TYPE_LABEL) as MealType[]
).map((v) => ({ value: v, label: MEAL_TYPE_LABEL[v] }));

export default function MealTemplateScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const auth = useAuth();
  useRequireAuth();
  const userId = auth.status === 'authed' ? auth.user.id : null;

  const isNew = id === 'new';
  const tplId = isNew ? null : Number(id);

  const [templateLoaded, setTemplateLoaded] = useState(isNew);
  const [name, setName] = useState('');
  const [mealType, setMealType] = useState<MealType>('snack');
  const [items, setItems] = useState<TemplateItemWithFood[]>([]);
  const [savedId, setSavedId] = useState<number | null>(tplId);
  const [saving, setSaving] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    if (isNew || !tplId) return;
    (async () => {
      const t = await getTemplate(tplId);
      if (!t) {
        Alert.alert('Não encontrado');
        router.back();
        return;
      }
      setName(t.name);
      setMealType(t.meal_type);
      setItems(await getTemplateItems(tplId));
      setTemplateLoaded(true);
    })();
  }, [tplId, isNew, router]);

  if (!userId) return null;

  async function ensureSaved(): Promise<number> {
    if (savedId) return savedId;
    if (!name.trim()) throw new Error('Informe um nome');
    const t = await createTemplate(userId!, name, mealType);
    setSavedId(t.id);
    return t.id;
  }

  async function saveAll() {
    if (!name.trim()) {
      Alert.alert('Informe um nome');
      return;
    }
    setSaving(true);
    try {
      const tid = await ensureSaved();
      await updateTemplate(tid, { name, meal_type: mealType });
      // Limpa quaisquer macros manuais legados (templates antigos do modo "Preparo IA").
      await clearTemplateManualMacros(tid);
      router.back();
    } finally {
      setSaving(false);
    }
  }

  async function onPickPreparo(food: Food, quantityG: number) {
    const tid = await ensureSaved();
    await addTemplateItem(tid, food.id, quantityG);
    setItems(await getTemplateItems(tid));
    setPickerOpen(false);
  }

  async function removeItem(itemId: number) {
    await removeTemplateItem(itemId);
    if (savedId) setItems(await getTemplateItems(savedId));
  }

  function calcItemKcal(it: TemplateItemWithFood) {
    return Math.round((it.quantity_g * it.kcal_per_100g) / 100);
  }

  const totalKcal = Math.round(items.reduce((acc, it) => acc + calcItemKcal(it), 0));
  const totalFiber = Math.round(
    items.reduce((acc, it) => acc + (it.quantity_g * (it.fiber_g ?? 0)) / 100, 0)
  );

  if (!templateLoaded) return null;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xl }}
    >
      <Card title="Refeição padrão">
        <Input
          label="Nome"
          value={name}
          onChangeText={setName}
          placeholder='Ex: "Almoço completo"'
        />
        <OptionPicker<MealType>
          label="Tipo"
          value={mealType}
          options={MEAL_TYPE_OPTIONS}
          onChange={setMealType}
          horizontal
        />
      </Card>

      <View style={styles.sectionRow}>
        <View>
          <Text style={styles.sectionTitle}>Preparos</Text>
          <Text style={styles.totalLine}>
            {totalKcal} kcal · {totalFiber} g de fibra
          </Text>
        </View>
        <Pressable onPress={() => setPickerOpen(true)} style={styles.addBtn}>
          <Ionicons name="add" size={18} color={colors.primary} />
          <Text style={styles.addBtnText}>Adicionar</Text>
        </Pressable>
      </View>

      {items.length === 0 ? (
        <Card>
          <Text style={styles.empty}>
            Nenhum item ainda. Toque em "Adicionar" pra escolher preparos ou líquidos que compõem
            essa refeição padrão.
          </Text>
        </Card>
      ) : (
        items.map((it) => {
          const u = it.unit ?? 'g';
          return (
            <View key={it.id} style={styles.itemRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName}>{it.food_name}</Text>
                <Text style={styles.itemMeta}>
                  {it.quantity_g} {u} · {calcItemKcal(it)} kcal
                  {it.fiber_g !== null && it.fiber_g !== undefined
                    ? ` · ${((it.quantity_g * it.fiber_g) / 100).toFixed(1)} g fibra`
                    : ''}
                </Text>
              </View>
              <Pressable onPress={() => removeItem(it.id)} style={styles.removeBtn}>
                <Ionicons name="trash" size={18} color={colors.danger} />
              </Pressable>
            </View>
          );
        })
      )}

      <Button
        title="Salvar"
        onPress={saveAll}
        loading={saving}
        style={{ marginTop: spacing.md }}
      />

      <PreparoPickerModal
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={onPickPreparo}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
  totalLine: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: spacing.xs },
  addBtnText: { color: colors.primary, fontWeight: '700' },
  empty: { color: colors.textMuted, textAlign: 'center', padding: spacing.sm },
  itemRow: {
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
  itemName: { color: colors.text, fontWeight: '600' },
  itemMeta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  removeBtn: { padding: spacing.xs },
});
