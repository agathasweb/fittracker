import React from 'react';
import { ScrollView, View, Text, StyleSheet, RefreshControl } from 'react-native';
import { Card } from '../../components/Card';
import { MacroBar } from '../../components/MacroBar';
import { colors, spacing } from '../../lib/theme';

// Mock — substituir por chamada à API quando backend estiver acessível
const MOCK = {
  date: new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }),
  tmb: 1750,
  get: 2710,
  kcal_eaten: 1850,
  kcal_burned: 320,
  macros: { protein: 145, carbs: 180, fat: 55 },
  targets: { protein: 160, carbs: 220, fat: 70 },
};

export default function HojeScreen() {
  const [refreshing, setRefreshing] = React.useState(false);
  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 600);
  };

  const balance = MOCK.kcal_eaten - MOCK.get - MOCK.kcal_burned;
  const isDeficit = balance < 0;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl tintColor={colors.primary} refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={styles.greeting}>Bom dia, Gutto 👋</Text>
      <Text style={styles.date}>{MOCK.date}</Text>

      {/* HERO: balanço calórico */}
      <Card>
        <Text style={styles.heroLabel}>BALANÇO DE HOJE</Text>
        <Text style={[styles.heroValue, { color: isDeficit ? colors.success : colors.warning }]}>
          {balance > 0 ? '+' : ''}{Math.round(balance)} kcal
        </Text>
        <Text style={styles.heroHint}>
          {isDeficit ? '🔥 Em déficit — emagrecendo' : '⚠️ Em superávit'}
        </Text>

        <View style={styles.gridRow}>
          <Stat label="Consumido" value={`${MOCK.kcal_eaten}`} />
          <Stat label="Gasto" value={`${MOCK.get + MOCK.kcal_burned}`} />
          <Stat label="Meta" value={`${MOCK.get - 500}`} />
        </View>
      </Card>

      {/* Macros */}
      <Card title="Macronutrientes">
        <MacroBar label="Proteína" current={MOCK.macros.protein} target={MOCK.targets.protein} color="#60A5FA" />
        <MacroBar label="Carboidrato" current={MOCK.macros.carbs} target={MOCK.targets.carbs} color="#FBBF24" />
        <MacroBar label="Gordura" current={MOCK.macros.fat} target={MOCK.targets.fat} color="#F87171" />
      </Card>

      {/* Treino do dia */}
      <Card title="Treino de hoje">
        <Text style={styles.workoutName}>🏋️  Push A — Peito, ombro, tríceps</Text>
        <Text style={styles.workoutMeta}>55 min · 320 kcal estimadas</Text>
      </Card>

      {/* Próxima previsão */}
      <Card title="Previsão de meta">
        <Text style={styles.prevValue}>~ 11 semanas até 72 kg</Text>
        <Text style={styles.prevHint}>com déficit médio de 500 kcal/dia</Text>
      </Card>
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { backgroundColor: colors.bg, flex: 1 },
  content: { padding: spacing.md, paddingTop: spacing.lg },
  greeting: { color: colors.text, fontSize: 24, fontWeight: '700' },
  date: { color: colors.textMuted, marginBottom: spacing.lg, textTransform: 'capitalize' },
  heroLabel: { color: colors.textMuted, fontSize: 11, letterSpacing: 1.5, fontWeight: '600' },
  heroValue: { fontSize: 44, fontWeight: '800', marginTop: 4 },
  heroHint: { color: colors.textMuted, marginTop: 2, marginBottom: spacing.md },
  gridRow: { flexDirection: 'row', justifyContent: 'space-between' },
  stat: { alignItems: 'center', flex: 1 },
  statLabel: { color: colors.textMuted, fontSize: 11, marginBottom: 2 },
  statValue: { color: colors.text, fontSize: 18, fontWeight: '700' },
  workoutName: { color: colors.text, fontSize: 16, fontWeight: '600' },
  workoutMeta: { color: colors.textMuted, marginTop: 4 },
  prevValue: { color: colors.primary, fontSize: 22, fontWeight: '700' },
  prevHint: { color: colors.textMuted, marginTop: 4 },
});
