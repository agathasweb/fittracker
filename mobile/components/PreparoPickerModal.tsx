import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { searchFoods } from '../lib/repos/foods';
import { colors, radius, spacing } from '../lib/theme';
import { Food } from '../lib/types';
import { Button } from './Button';
import { Input } from './Input';
import { PreparoEditorModal } from './PreparoEditorModal';

type Props = {
  visible: boolean;
  onClose: () => void;
  onPick: (preparo: Food, quantityG: number) => void | Promise<void>;
};

export function PreparoPickerModal({ visible, onClose, onPick }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Food[]>([]);
  const [selected, setSelected] = useState<Food | null>(null);
  const [quantity, setQuantity] = useState('100');
  const [createOpen, setCreateOpen] = useState(false);
  const [createUnit, setCreateUnit] = useState<'g' | 'ml'>('g');

  useEffect(() => {
    if (!visible) {
      setQuery('');
      setResults([]);
      setSelected(null);
      setQuantity('100');
      setCreateOpen(false);
      setCreateUnit('g');
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
    const q = Number(quantity.replace(',', '.'));
    if (!q || q <= 0) return;
    await onPick(selected, q);
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.backdrop}
      >
        <View style={styles.modal}>
          <Text style={styles.title}>Adicionar preparo ou líquido</Text>

          {!selected ? (
            <>
              <Input
                label="Buscar"
                value={query}
                onChangeText={setQuery}
                placeholder="Nome do preparo ou bebida"
                autoCapitalize="none"
              />
              <ScrollView style={{ maxHeight: 300 }}>
                {results.length === 0 ? (
                  <Text style={styles.empty}>
                    {query
                      ? 'Nenhum item encontrado. Cadastre um novo abaixo.'
                      : 'Nenhum preparo cadastrado ainda. Crie o primeiro abaixo.'}
                  </Text>
                ) : (
                  results.map((f) => {
                    const u = f.unit ?? 'g';
                    return (
                      <Pressable
                        key={f.id}
                        onPress={() => {
                          setSelected(f);
                          setQuantity(u === 'ml' ? '200' : '100');
                        }}
                        style={styles.row}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={styles.rowName}>
                            {f.name}{' '}
                            <Text style={styles.unitTag}>{u === 'ml' ? '· ml' : ''}</Text>
                          </Text>
                          <Text style={styles.rowMeta}>
                            {f.kcal_per_100g} kcal/100{u} · P {f.protein_g}g · C {f.carbs_g}g · G {f.fat_g}g
                            {f.fiber_g !== null ? ` · F ${f.fiber_g}g` : ''}
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                      </Pressable>
                    );
                  })
                )}
              </ScrollView>
              <View style={styles.btns}>
                <Button title="Cancelar" variant="secondary" onPress={onClose} style={{ flex: 1 }} />
                <Button
                  title="Novo sólido"
                  variant="secondary"
                  onPress={() => {
                    setCreateUnit('g');
                    setCreateOpen(true);
                  }}
                  style={{ flex: 1 }}
                />
                <Button
                  title="Novo líquido"
                  onPress={() => {
                    setCreateUnit('ml');
                    setCreateOpen(true);
                  }}
                  style={{ flex: 1 }}
                />
              </View>
              <PreparoEditorModal
                visible={createOpen}
                editing={null}
                initialName={query}
                initialUnit={createUnit}
                onClose={() => setCreateOpen(false)}
                onSaved={(food) => {
                  setSelected(food);
                  setQuantity((food.unit ?? 'g') === 'ml' ? '200' : '100');
                  setCreateOpen(false);
                }}
              />
            </>
          ) : (
            <>
              <Text style={styles.selectedName}>{selected.name}</Text>
              <Text style={styles.rowMeta}>
                {selected.kcal_per_100g} kcal/100{selected.unit ?? 'g'}
              </Text>
              <Input
                label={`Quantidade (${selected.unit ?? 'g'})`}
                value={quantity}
                onChangeText={setQuantity}
                keyboardType="numeric"
              />
              <Text style={styles.kcalPreview}>
                ≈ {Math.round(((Number(quantity.replace(',', '.')) || 0) * selected.kcal_per_100g) / 100)} kcal
              </Text>
              <View style={styles.btns}>
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
  title: { color: colors.text, fontSize: 18, fontWeight: '700', marginBottom: spacing.md },
  empty: { color: colors.textMuted, textAlign: 'center', padding: spacing.sm },
  row: {
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
  rowName: { color: colors.text, fontWeight: '600' },
  unitTag: { color: colors.primary, fontSize: 12, fontWeight: '600' },
  rowMeta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  btns: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
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
