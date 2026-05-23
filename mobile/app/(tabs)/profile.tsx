import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Card } from '../../components/Card';
import { logout, useAuth } from '../../lib/auth';
import { ageFromBirth } from '../../lib/format';
import { colors, radius, spacing } from '../../lib/theme';
import { ACTIVITY_LABEL, SEX_LABEL } from '../../lib/types';

export default function ProfileScreen() {
  const auth = useAuth();
  const router = useRouter();

  if (auth.status !== 'authed') return null;
  const u = auth.user;
  const age = ageFromBirth(u.birth_date);
  const initial = u.name.trim().charAt(0).toUpperCase();
  const diff = u.current_weight_kg - u.goal_weight_kg;
  const objective =
    Math.abs(diff) < 0.5 ? 'Manter peso' : diff > 0 ? 'Emagrecer' : 'Ganhar peso';

  async function onLogout() {
    await logout();
    router.replace('/auth/login');
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
        <Text style={styles.name}>{u.name}</Text>
        <Text style={styles.email}>{u.email}</Text>
      </View>

      <Card title="Dados pessoais">
        <Row label="Sexo" value={SEX_LABEL[u.sex]} />
        <Row label="Idade" value={`${age} anos`} />
        <Row label="Altura" value={`${u.height_cm} cm`} />
        <Row label="Peso atual" value={`${u.current_weight_kg} kg`} />
        <Row
          label="Nível de atividade"
          value={ACTIVITY_LABEL[u.activity_level].split(' (')[0]}
        />
      </Card>

      <Card title="Meta">
        <Row label="Objetivo" value={objective} />
        <Row label="Peso meta" value={`${u.goal_weight_kg} kg`} />
        <Row label="Meta de água" value={`${u.daily_water_goal_ml} ml/dia`} />
        {u.daily_calorie_goal && (
          <Row label="Meta calórica" value={`${u.daily_calorie_goal} kcal`} />
        )}
      </Card>

      <Card title="Conta">
        <MenuRow icon="log-out-outline" text="Sair" danger onPress={onLogout} />
      </Card>
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function MenuRow({
  icon,
  text,
  danger,
  onPress,
}: {
  icon: any;
  text: string;
  danger?: boolean;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity style={styles.menuRow} onPress={onPress}>
      <Ionicons name={icon} size={20} color={danger ? colors.danger : colors.textMuted} />
      <Text style={[styles.menuText, danger && { color: colors.danger }]}>{text}</Text>
      <Ionicons
        name="chevron-forward"
        size={18}
        color={colors.textMuted}
        style={{ marginLeft: 'auto' }}
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.md },
  header: { alignItems: 'center', marginVertical: spacing.lg },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  avatarText: { color: colors.bg, fontSize: 36, fontWeight: '800' },
  name: { color: colors.text, fontSize: 22, fontWeight: '700' },
  email: { color: colors.textMuted, marginTop: 2 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowLabel: { color: colors.textMuted },
  rowValue: { color: colors.text, fontWeight: '600' },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 12 },
  menuText: { color: colors.text },
});
