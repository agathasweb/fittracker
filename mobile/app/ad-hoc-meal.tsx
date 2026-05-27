import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { OptionPicker } from '../components/OptionPicker';
import { PreparoPickerModal } from '../components/PreparoPickerModal';
import { useAuth } from '../lib/auth';
import { useRequireAuth } from '../lib/guards';
import { addMealItem, createMeal } from '../lib/repos/meals';
import { colors, radius, spacing } from '../lib/theme';
import { Food, MealType, MEAL_TYPE_LABEL } from '../lib/types';

type LocalItem = {
  // ID temporário só pro key do React
  tmpId: number;
  food: Food;
  quantity_g: number;
};

const MEAL_TYPE_OPTIONS: { value: MealType; label: string }[] = (
  Object.keys(MEAL_TYPE_LABEL) as MealType[]
).map((v) => ({ value: v, label: MEAL_TYPE_LABEL[v] }));

export default function AdHocMealScreen() {
  const router = useRouter();
  const auth = useAuth();
  useRequireAuth();
  const userId = auth.status === 'authed' ? auth.user.id : null;

  const [mealType, setMealType] = useState<MealType>('snack');
  const [items, setItems] = useState<LocalItem[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!userId) return null;

  function addItem(food: Food, quantityG: number) {
    setItems((prev) => [...prev, { tmpId: Date.now() + Math.random(), food, quantity_g: quantityG }]);
    setPickerOpen(false);
  }

  function removeItem(tmpId: number) {
    setItems((prev) => prev.filter((i) => i.tmpId !== tmpId));
  }

  function calcKcal(it: LocalItem) {
    return Math.round((it.quantity_g * it.food.kcal_per_100g) / 100);
  }

  const totalKcal = items.reduce((acc, it) => acc + calcKcal(it), 0);
  const totalFiber = items.reduce(
    (acc, it) => acc + (it.quantity_g * (it.food.fiber_g ?? 0)) / 100,
    0
  );

  async function save() {
    if (items.length === 0) {
      Alert.alert('Adicione pelo menos um preparo.');
      return;
    }
    setSaving(true);
    try {
      const meal = await createMeal(userId!, mealType);
      for (const it of items) {
        await addMealItem(meal.id, it.food.id, it.quantity_g);
      }
      router.back();
    } catch (e: any) {
      Alert.alert('Erro', e?.message ?? 'Falha ao salvar refeição.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xl }}
    >
      <Card title="Refeição avulsa">
        <Text style={styles.helper}>
          Use preparos cadastrados pra montar uma refeição única, sem salvar como padrão.
        </Text>
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
            {totalKcal} kcal · {totalFiber.toFixed(1)} g de fibra
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
            Nenhum preparo ainda. Toque em "Adicionar" pra montar a refeição.
          </Text>
        </Card>
      ) : (
        items.map((it) => (
          <View key={it.tmpId} style={styles.itemRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemName}>{it.food.name}</Text>
              <Text style={styles.itemMeta}>
                {it.quantity_g} g · {calcKcal(it)} kcal
                {it.food.fiber_g !== null && it.food.fiber_g !== undefined
                  ? ` · ${((it.quantity_g * it.food.fiber_g) / 100).toFixed(1)} g fibra`
                  : ''}
              </Text>
            </View>
            <Pressable onPress={() => removeItem(it.tmpId)} style={styles.removeBtn}>
              <Ionicons name="trash" size={18} color={colors.danger} />
            </Pressable>
          </View>
        ))
      )}

      <Button
        title="Lançar refeição"
        onPress={save}
        loading={saving}
        style={{ marginTop: spacing.md }}
      />

      <PreparoPickerModal
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={addItem}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  helper: { color: colors.textMuted, fontSize: 13, marginBottom: spacing.sm, lineHeight: 18 },
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
