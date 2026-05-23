import { Ionicons } from '@expo/vector-icons';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card } from '../../components/Card';
import { useAuth } from '../../lib/auth';
import { colors, spacing } from '../../lib/theme';

export default function ProgressScreen() {
  const auth = useAuth();
  if (auth.status !== 'authed') return null;
  const u = auth.user;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: spacing.md }}
    >
      <Card title="Peso">
        <Text style={styles.bigValue}>
          {u.current_weight_kg} <Text style={styles.unit}>kg</Text>
        </Text>
        <Text style={styles.subtitle}>Meta: {u.goal_weight_kg} kg</Text>
      </Card>

      <Card>
        <View style={{ alignItems: 'center', paddingVertical: spacing.lg }}>
          <Ionicons name="analytics-outline" size={48} color={colors.textMuted} />
          <Text style={styles.title}>Histórico em construção</Text>
          <Text style={styles.subtitle}>
            Em breve: gráfico de peso semanal, projeção da meta com regressão linear e
            detecção de plateau.
          </Text>
        </View>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  bigValue: {
    color: colors.text,
    fontSize: 40,
    fontWeight: '800',
  },
  unit: { color: colors.textMuted, fontSize: 20, fontWeight: '600' },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
    marginTop: spacing.sm,
  },
  subtitle: {
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
  },
});
