import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../../components/Card';
import { colors, spacing, radius } from '../../lib/theme';

type Meal = {
  id: string;
  kind: 'Café da manhã' | 'Almoço' | 'Lanche' | 'Jantar' | 'Ceia';
  time: string;
  items: string[];
  kcal: number;
};

const MEALS: Meal[] = [
  { id: '1', kind: 'Café da manhã', time: '08:00', items: ['40g aveia', '1 banana', '2 ovos cozidos'], kcal: 380 },
  { id: '2', kind: 'Almoço', time: '12:30', items: ['150g arroz', '100g feijão', '180g peito de frango'], kcal: 620 },
  { id: '3', kind: 'Lanche', time: '16:00', items: ['30g whey', '1 banana'], kcal: 220 },
  { id: '4', kind: 'Jantar', time: '20:00', items: ['180g peito de frango', '200g batata doce'], kcal: 540 },
];

export default function MealsScreen() {
  const total = MEALS.reduce((acc, m) => acc + m.kcal, 0);

  return (
    <View style={styles.container}>
      <Card>
        <Text style={styles.dayLabel}>HOJE</Text>
        <View style={styles.row}>
          <Text style={styles.totalKcal}>{total} kcal</Text>
          <Text style={styles.totalHint}>{MEALS.length} refeições</Text>
        </View>
      </Card>

      <FlatList
        data={MEALS}
        keyExtractor={(m) => m.id}
        renderItem={({ item }) => (
          <View style={styles.mealCard}>
            <View style={styles.mealHeader}>
              <Text style={styles.mealKind}>{item.kind}</Text>
              <Text style={styles.mealTime}>{item.time}</Text>
            </View>
            {item.items.map((it, i) => (
              <Text key={i} style={styles.mealItem}>• {it}</Text>
            ))}
            <View style={styles.mealFooter}>
              <Text style={styles.mealKcal}>{item.kcal} kcal</Text>
            </View>
          </View>
        )}
      />

      <TouchableOpacity style={styles.fab} activeOpacity={0.85}>
        <Ionicons name="add" size={28} color={colors.bg} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.md },
  dayLabel: { color: colors.textMuted, fontSize: 11, letterSpacing: 1.5, fontWeight: '600' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 4 },
  totalKcal: { color: colors.primary, fontSize: 32, fontWeight: '800' },
  totalHint: { color: colors.textMuted },
  mealCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  mealHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm },
  mealKind: { color: colors.text, fontWeight: '700', fontSize: 16 },
  mealTime: { color: colors.textMuted },
  mealItem: { color: colors.text, marginBottom: 2 },
  mealFooter: { marginTop: spacing.sm, alignItems: 'flex-end' },
  mealKcal: { color: colors.primary, fontWeight: '700' },
  fab: {
    position: 'absolute',
    bottom: spacing.lg,
    right: spacing.lg,
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: colors.primary,
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
});
