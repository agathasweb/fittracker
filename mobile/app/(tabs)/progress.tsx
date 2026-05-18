import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Card } from '../../components/Card';
import { colors, spacing, radius } from '../../lib/theme';

const WEIGHT_HISTORY = [
  { week: 'S1', kg: 80.2 },
  { week: 'S2', kg: 79.6 },
  { week: 'S3', kg: 79.1 },
  { week: 'S4', kg: 78.5 },
  { week: 'S5', kg: 78.0 },
  { week: 'S6', kg: 77.3 },
  { week: 'S7', kg: 76.8 },
  { week: 'S8', kg: 76.4 },
];

const MAX_BAR_H = 120;

export default function ProgressScreen() {
  const minKg = Math.min(...WEIGHT_HISTORY.map((d) => d.kg));
  const maxKg = Math.max(...WEIGHT_HISTORY.map((d) => d.kg));
  const range = maxKg - minKg || 1;
  const delta = WEIGHT_HISTORY[0].kg - WEIGHT_HISTORY[WEIGHT_HISTORY.length - 1].kg;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <Card>
        <Text style={styles.label}>VOCÊ ESTÁ INDO BEM</Text>
        <Text style={styles.headline}>-{delta.toFixed(1)} kg</Text>
        <Text style={styles.hint}>nas últimas {WEIGHT_HISTORY.length} semanas</Text>
      </Card>

      <Card title="Peso semanal">
        <View style={styles.chart}>
          {WEIGHT_HISTORY.map((d) => {
            const h = ((d.kg - minKg) / range) * MAX_BAR_H + 20;
            return (
              <View key={d.week} style={styles.barCol}>
                <Text style={styles.barValue}>{d.kg.toFixed(1)}</Text>
                <View style={[styles.bar, { height: h }]} />
                <Text style={styles.barLabel}>{d.week}</Text>
              </View>
            );
          })}
        </View>
      </Card>

      <Card title="Conquistas">
        <Achievement icon="🔥" text="7 dias seguidos em déficit" />
        <Achievement icon="💪" text="20 treinos completos no mês" />
        <Achievement icon="🥗" text="Meta de proteína batida 5 dias da semana" />
      </Card>

      <Card title="Projeção">
        <Text style={styles.projection}>72.0 kg em ≈ 11 semanas</Text>
        <Text style={styles.projectionHint}>
          Mantendo o déficit médio atual de 500 kcal/dia
        </Text>
      </Card>
    </ScrollView>
  );
}

function Achievement({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={styles.ach}>
      <Text style={styles.achIcon}>{icon}</Text>
      <Text style={styles.achText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.md },
  label: { color: colors.textMuted, fontSize: 11, letterSpacing: 1.5, fontWeight: '600' },
  headline: { color: colors.success, fontSize: 44, fontWeight: '800', marginTop: 4 },
  hint: { color: colors.textMuted, marginTop: 2 },
  chart: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 180 },
  barCol: { alignItems: 'center', flex: 1 },
  bar: { width: 18, backgroundColor: colors.primary, borderRadius: radius.sm, marginBottom: 6 },
  barValue: { color: colors.textMuted, fontSize: 10, marginBottom: 4 },
  barLabel: { color: colors.textMuted, fontSize: 11 },
  ach: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 6 },
  achIcon: { fontSize: 22 },
  achText: { color: colors.text },
  projection: { color: colors.primary, fontSize: 22, fontWeight: '700' },
  projectionHint: { color: colors.textMuted, marginTop: 4 },
});
