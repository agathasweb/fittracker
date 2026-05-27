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
import * as deepseek from '../lib/ai/deepseek';
import { createFood, updateFood } from '../lib/repos/foods';
import { colors, radius, spacing } from '../lib/theme';
import { Food, FoodUnit } from '../lib/types';
import { Button } from './Button';
import { Input } from './Input';

type Props = {
  visible: boolean;
  /** Preparo existente em edição, ou null pra cadastro novo. */
  editing: Food | null;
  /** Nome inicial sugerido ao cadastrar (vem da busca). Ignorado se editing está setado. */
  initialName?: string;
  /** Unidade inicial pra cadastro novo. Default 'g'. Ignorado se editing está setado. */
  initialUnit?: FoodUnit;
  onClose: () => void;
  onSaved: (food: Food) => void;
};

function toStr(n: number | null | undefined): string {
  if (n === null || n === undefined) return '';
  return String(Number.isInteger(n) ? n : Number(n.toFixed(1)));
}

export function PreparoEditorModal({
  visible,
  editing,
  initialName,
  initialUnit = 'g',
  onClose,
  onSaved,
}: Props) {
  const [name, setName] = useState('');
  const [unit, setUnit] = useState<FoodUnit>('g');
  const [description, setDescription] = useState('');
  const [kcal, setKcal] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [fiber, setFiber] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!visible) return;
    if (editing) {
      setName(editing.name);
      setUnit(editing.unit ?? 'g');
      setDescription('');
      setKcal(toStr(editing.kcal_per_100g));
      setProtein(toStr(editing.protein_g));
      setCarbs(toStr(editing.carbs_g));
      setFat(toStr(editing.fat_g));
      setFiber(toStr(editing.fiber_g));
    } else {
      setName(initialName ?? '');
      setUnit(initialUnit);
      setDescription('');
      setKcal('');
      setProtein('');
      setCarbs('');
      setFat('');
      setFiber('');
    }
    setErrors({});
  }, [visible, editing, initialName, initialUnit]);

  const isLiquid = unit === 'ml';
  const unitLabel = isLiquid ? '100ml' : '100g';

  async function calcWithAI() {
    if (!description.trim()) {
      Alert.alert(
        isLiquid ? 'Descreva a bebida' : 'Descreva o preparo',
        isLiquid
          ? 'Conta o que tem na bebida (ingredientes, açúcar, leite, álcool). A IA estima os macros por 100ml.'
          : 'Conta como você preparou (ingredientes, óleo, cocção). A IA estima os macros por 100g.'
      );
      return;
    }
    setAiLoading(true);
    try {
      const m = isLiquid
        ? await deepseek.estimateLiquidPer100ml(description)
        : await deepseek.estimatePreparoPer100g(description);
      setKcal(toStr(m.kcal));
      setProtein(toStr(m.protein_g));
      setCarbs(toStr(m.carbs_g));
      setFat(toStr(m.fat_g));
      setFiber(toStr(m.fiber_g));
    } catch (e: any) {
      if (e?.code === 'NO_KEY') {
        Alert.alert('Chave DeepSeek não cadastrada', 'Vá em Perfil → Integrações pra cadastrar.');
      } else {
        Alert.alert('IA', e?.message ?? 'Erro ao consultar a IA.');
      }
    } finally {
      setAiLoading(false);
    }
  }

  async function save() {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Informe o nome';
    const k = Number(kcal.replace(',', '.'));
    if (!Number.isFinite(k) || k < 0) e.kcal = 'Obrigatório, ≥ 0';
    setErrors(e);
    if (Object.keys(e).length) return;

    const fiberNum = Number(fiber.replace(',', '.'));
    const payload = {
      name,
      unit,
      kcal_per_100g: k,
      protein_g: Number(protein.replace(',', '.')) || 0,
      carbs_g: Number(carbs.replace(',', '.')) || 0,
      fat_g: Number(fat.replace(',', '.')) || 0,
      fiber_g: fiber.trim() === '' || isNaN(fiberNum) ? null : fiberNum,
    };

    if (editing) {
      await updateFood(editing.id, payload);
      onSaved({ ...editing, ...payload });
    } else {
      const food = await createFood({ ...payload, source: 'custom' });
      onSaved(food);
    }
  }

  const title = editing
    ? isLiquid
      ? 'Editar líquido'
      : 'Editar preparo'
    : isLiquid
      ? 'Nova bebida'
      : 'Novo preparo';

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.backdrop}
      >
        <View style={styles.modal}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.sub}>Valores por {unitLabel}</Text>
          <ScrollView style={{ maxHeight: 500 }}>
            <Text style={styles.fieldLabel}>Tipo</Text>
            <View style={styles.unitRow}>
              <Pressable
                onPress={() => setUnit('g')}
                style={[styles.unitChip, unit === 'g' && styles.unitChipActive]}
              >
                <Text
                  style={[styles.unitChipText, unit === 'g' && styles.unitChipTextActive]}
                >
                  Sólido (g)
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setUnit('ml')}
                style={[styles.unitChip, unit === 'ml' && styles.unitChipActive]}
              >
                <Text
                  style={[styles.unitChipText, unit === 'ml' && styles.unitChipTextActive]}
                >
                  Líquido (ml)
                </Text>
              </Pressable>
            </View>

            <Input
              label={isLiquid ? 'Nome da bebida' : 'Nome do preparo'}
              value={name}
              onChangeText={setName}
              error={errors.name}
              placeholder={
                isLiquid
                  ? 'Ex: "Café com leite" ou "Cerveja Heineken"'
                  : 'Ex: "Arroz integral cozido"'
              }
            />

            <Text style={styles.fieldLabel}>Descrição (opcional, pra IA)</Text>
            <Text style={styles.helper}>
              {isLiquid
                ? 'Conta o que tem na bebida — ingredientes, açúcar, leite, álcool. A IA estima os macros por 100ml.'
                : 'Conta como você prepara — ingredientes, óleo, cocção. A IA estima os macros por 100g do preparo pronto.'}
            </Text>
            <Input
              value={description}
              onChangeText={setDescription}
              placeholder={
                isLiquid
                  ? 'Ex: suco de laranja natural sem açúcar'
                  : 'Ex: arroz integral cozido em água com 1 colher de azeite e sal'
              }
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              style={{ minHeight: 80 }}
            />
            <Button
              title={aiLoading ? 'Calculando…' : 'Calcular com IA'}
              onPress={calcWithAI}
              loading={aiLoading}
              variant="secondary"
              style={{ marginBottom: spacing.md }}
            />

            <Input
              label={`Calorias (kcal/${unitLabel})`}
              value={kcal}
              onChangeText={setKcal}
              keyboardType="numeric"
              error={errors.kcal}
              placeholder={isLiquid ? '42' : '165'}
            />
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <View style={{ flex: 1 }}>
                <Input
                  label="Proteína (g)"
                  value={protein}
                  onChangeText={setProtein}
                  keyboardType="numeric"
                  placeholder="3"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Input
                  label="Carbo (g)"
                  value={carbs}
                  onChangeText={setCarbs}
                  keyboardType="numeric"
                  placeholder="28"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Input
                  label="Gord. (g)"
                  value={fat}
                  onChangeText={setFat}
                  keyboardType="numeric"
                  placeholder="2"
                />
              </View>
            </View>
            <Input
              label={`Fibra (g/${unitLabel}) — opcional`}
              value={fiber}
              onChangeText={setFiber}
              keyboardType="numeric"
              placeholder="2"
            />
          </ScrollView>
          <View style={styles.btns}>
            <Button title="Cancelar" variant="secondary" onPress={onClose} style={{ flex: 1 }} />
            <Button title="Salvar" onPress={save} style={{ flex: 1 }} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
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
  title: { color: colors.text, fontSize: 18, fontWeight: '700' },
  sub: { color: colors.textMuted, fontSize: 12, marginTop: 2, marginBottom: spacing.md },
  fieldLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  helper: { color: colors.textMuted, fontSize: 12, marginBottom: spacing.sm, lineHeight: 16 },
  btns: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  unitRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  unitChip: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    alignItems: 'center',
  },
  unitChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  unitChipText: { color: colors.text, fontWeight: '600', fontSize: 13 },
  unitChipTextActive: { color: colors.bg },
});
