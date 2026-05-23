import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
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
import { useAuth } from '../../lib/auth';
import { useRequireAuth } from '../../lib/guards';
import { createFood, searchFoods } from '../../lib/repos/foods';
import {
  addTemplateItem,
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

  async function saveBasic() {
    if (!name.trim()) {
      Alert.alert('Informe um nome');
      return;
    }
    setSaving(true);
    try {
      if (savedId) {
        await updateTemplate(savedId, { name, meal_type: mealType });
      } else {
        const t = await createTemplate(userId!, name, mealType);
        setSavedId(t.id);
      }
    } finally {
      setSaving(false);
    }
  }

  async function onPickFood(food: Food, quantityG: number) {
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
          placeholder='Ex: "Café da manhã proteico"'
        />
        <OptionPicker<MealType>
          label="Tipo"
          value={mealType}
          options={MEAL_TYPE_OPTIONS}
          onChange={setMealType}
          horizontal
        />
        <Button title="Salvar dados" onPress={saveBasic} loading={saving} variant="secondary" />
      </Card>

      <View style={styles.sectionRow}>
        <View>
          <Text style={styles.sectionTitle}>Itens</Text>
          <Text style={styles.totalLine}>{totalKcal} kcal no total</Text>
        </View>
        <Pressable onPress={() => setPickerOpen(true)} style={styles.addBtn}>
          <Ionicons name="add" size={18} color={colors.primary} />
          <Text style={styles.addBtnText}>Adicionar</Text>
        </Pressable>
      </View>

      {items.length === 0 ? (
        <Card>
          <Text style={styles.empty}>
            Nenhum item ainda. Adicione os alimentos que compõem essa refeição.
          </Text>
        </Card>
      ) : (
        items.map((it) => (
          <View key={it.id} style={styles.itemRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemName}>{it.food_name}</Text>
              <Text style={styles.itemMeta}>
                {it.quantity_g} g · {calcItemKcal(it)} kcal
              </Text>
            </View>
            <Pressable onPress={() => removeItem(it.id)} style={styles.removeBtn}>
              <Ionicons name="trash" size={18} color={colors.danger} />
            </Pressable>
          </View>
        ))
      )}

      <FoodPickerModal
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={onPickFood}
      />
    </ScrollView>
  );
}

type FoodPickerProps = {
  visible: boolean;
  onClose: () => void;
  onPick: (food: Food, quantityG: number) => void | Promise<void>;
};

function FoodPickerModal({ visible, onClose, onPick }: FoodPickerProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Food[]>([]);
  const [selected, setSelected] = useState<Food | null>(null);
  const [quantity, setQuantity] = useState('100');
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    if (!visible) {
      setQuery('');
      setResults([]);
      setSelected(null);
      setQuantity('100');
      setCreateOpen(false);
    }
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    (async () => {
      const list = await searchFoods(query, 30);
      if (!cancelled) setResults(list);
    })();
    return () => {
      cancelled = true;
    };
  }, [query, visible]);

  async function confirm() {
    if (!selected) return;
    const q = Number(quantity);
    if (!q || q <= 0) return;
    await onPick(selected, q);
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalBackdrop}
      >
        <View style={styles.modal}>
          <Text style={styles.modalTitle}>Adicionar alimento</Text>

          {!selected ? (
            <>
              <Input
                label="Buscar"
                value={query}
                onChangeText={setQuery}
                placeholder="Nome do alimento"
                autoCapitalize="none"
              />
              <ScrollView style={{ maxHeight: 300 }}>
                {results.length === 0 ? (
                  <Text style={styles.empty}>
                    {query
                      ? 'Nenhum alimento encontrado. Cadastre um novo abaixo.'
                      : 'Nenhum alimento cadastrado ainda. Crie o primeiro abaixo.'}
                  </Text>
                ) : (
                  results.map((f) => (
                    <Pressable
                      key={f.id}
                      onPress={() => setSelected(f)}
                      style={styles.foodRow}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.foodName}>{f.name}</Text>
                        <Text style={styles.foodMeta}>
                          {f.kcal_per_100g} kcal/100g · P {f.protein_g}g · C {f.carbs_g}g · G {f.fat_g}g
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                    </Pressable>
                  ))
                )}
              </ScrollView>
              <View style={styles.modalBtns}>
                <Button title="Cancelar" variant="secondary" onPress={onClose} style={{ flex: 1 }} />
                <Button
                  title="Novo alimento"
                  onPress={() => setCreateOpen(true)}
                  style={{ flex: 1 }}
                />
              </View>
              <NewFoodModal
                visible={createOpen}
                initialName={query}
                onClose={() => setCreateOpen(false)}
                onCreated={(food) => {
                  setSelected(food);
                  setCreateOpen(false);
                }}
              />
            </>
          ) : (
            <>
              <Text style={styles.selectedName}>{selected.name}</Text>
              <Text style={styles.foodMeta}>
                {selected.kcal_per_100g} kcal/100g
              </Text>
              <Input
                label="Quantidade (g)"
                value={quantity}
                onChangeText={setQuantity}
                keyboardType="numeric"
              />
              <Text style={styles.kcalPreview}>
                ≈ {Math.round(((Number(quantity) || 0) * selected.kcal_per_100g) / 100)} kcal
              </Text>
              <View style={styles.modalBtns}>
                <Button
                  title="Trocar"
                  variant="secondary"
                  onPress={() => setSelected(null)}
                  style={{ flex: 1 }}
                />
                <Button title="Adicionar" onPress={confirm} style={{ flex: 1 }} />
              </View>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

type NewFoodProps = {
  visible: boolean;
  initialName: string;
  onClose: () => void;
  onCreated: (food: Food) => void;
};

function NewFoodModal({ visible, initialName, onClose, onCreated }: NewFoodProps) {
  const [name, setName] = useState(initialName);
  const [kcal, setKcal] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (visible) {
      setName(initialName);
      setKcal('');
      setProtein('');
      setCarbs('');
      setFat('');
      setErrors({});
    }
  }, [visible, initialName]);

  async function save() {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Informe o nome';
    const k = Number(kcal);
    if (k === 0 || isNaN(k) || k < 0) e.kcal = 'Obrigatório, ≥ 0';
    setErrors(e);
    if (Object.keys(e).length) return;
    const food = await createFood({
      name,
      kcal_per_100g: k,
      protein_g: Number(protein) || 0,
      carbs_g: Number(carbs) || 0,
      fat_g: Number(fat) || 0,
      fiber_g: null,
      source: 'custom',
    });
    onCreated(food);
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalBackdrop}
      >
        <View style={styles.modal}>
          <Text style={styles.modalTitle}>Cadastrar alimento</Text>
          <Text style={styles.modalSub}>Valores por 100g</Text>
          <ScrollView style={{ maxHeight: 380 }}>
            <Input
              label="Nome"
              value={name}
              onChangeText={setName}
              error={errors.name}
              placeholder='Ex: "Frango grelhado"'
            />
            <Input
              label="Calorias (kcal/100g)"
              value={kcal}
              onChangeText={setKcal}
              keyboardType="numeric"
              error={errors.kcal}
              placeholder="165"
            />
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <View style={{ flex: 1 }}>
                <Input
                  label="Proteína (g)"
                  value={protein}
                  onChangeText={setProtein}
                  keyboardType="numeric"
                  placeholder="31"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Input
                  label="Carbo (g)"
                  value={carbs}
                  onChangeText={setCarbs}
                  keyboardType="numeric"
                  placeholder="0"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Input
                  label="Gord. (g)"
                  value={fat}
                  onChangeText={setFat}
                  keyboardType="numeric"
                  placeholder="3.6"
                />
              </View>
            </View>
          </ScrollView>
          <View style={styles.modalBtns}>
            <Button title="Cancelar" variant="secondary" onPress={onClose} style={{ flex: 1 }} />
            <Button title="Salvar" onPress={save} style={{ flex: 1 }} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
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
    fontSize: 12,
    marginTop: 2,
    marginBottom: spacing.md,
  },
  modalBtns: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  foodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    marginBottom: spacing.xs,
  },
  foodName: { color: colors.text, fontWeight: '600' },
  foodMeta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  selectedName: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  kcalPreview: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 16,
    marginBottom: spacing.sm,
  },
});
