import { Ionicons } from '@expo/vector-icons';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card } from '../../components/Card';
import { colors, spacing } from '../../lib/theme';

export default function WorkoutsScreen() {
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: spacing.md }}
    >
      <Card>
        <View style={{ alignItems: 'center', paddingVertical: spacing.lg }}>
          <Ionicons name="barbell-outline" size={48} color={colors.textMuted} />
          <Text style={styles.title}>Treinos chegando</Text>
          <Text style={styles.subtitle}>
            CRUD de treinos, sessões com cronômetro e log de séries virão na próxima
            fase. Por enquanto foque em alimentação e hidratação.
          </Text>
        </View>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
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
