import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ActivityEditorModal } from '../../components/ActivityEditorModal';
import { Card } from '../../components/Card';
import { useAuth } from '../../lib/auth';
import { formatTime, todayISO } from '../../lib/format';
import { deleteActivity, listActivitiesOfDay } from '../../lib/repos/activities';
import { colors, radius, spacing } from '../../lib/theme';
import { Activity } from '../../lib/types';

export default function WorkoutsScreen() {
  const auth = useAuth();
  const user = auth.status === 'authed' ? auth.user : null;
  const userId = user?.id ?? null;

  const [activities, setActivities] = useState<Activity[]>([]);
  const [editorOpen, setEditorOpen] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    setActivities(await listActivitiesOfDay(userId, todayISO()));
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (!user) return null;

  function confirmRemove(a: Activity) {
    Alert.alert('Remover atividade', `Excluir "${a.name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          await deleteActivity(a.id);
          await load();
        },
      },
    ]);
  }

  const totalKcal = activities.reduce((acc, a) => acc + a.kcal, 0);
  const totalMin = activities.reduce((acc, a) => acc + a.duration_min, 0);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: spacing.md, paddingBottom: 100 }}
      >
        <Card>
          <Text style={styles.cardLabel}>HOJE</Text>
          <View style={styles.summaryRow}>
            <View style={styles.summaryStat}>
              <Text style={styles.summaryValue}>{totalKcal}</Text>
              <Text style={styles.summaryUnit}>kcal queimadas</Text>
            </View>
            <View style={styles.summaryStat}>
              <Text style={styles.summaryValue}>{totalMin}</Text>
              <Text style={styles.summaryUnit}>minutos</Text>
            </View>
            <View style={styles.summaryStat}>
              <Text style={styles.summaryValue}>{activities.length}</Text>
              <Text style={styles.summaryUnit}>
                atividade{activities.length === 1 ? '' : 's'}
              </Text>
            </View>
          </View>
        </Card>

        {activities.length === 0 ? (
          <Card>
            <View style={{ alignItems: 'center', paddingVertical: spacing.md }}>
              <Ionicons name="barbell-outline" size={48} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>Nenhuma atividade registrada hoje</Text>
              <Text style={styles.emptySub}>
                Lance uma caminhada, corrida, pedalada ou treino. A IA pode estimar o gasto
                calórico com base no seu peso, altura e tempo.
              </Text>
            </View>
          </Card>
        ) : (
          activities.map((a) => (
            <Card key={a.id}>
              <View style={styles.activityHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.activityName}>{a.name}</Text>
                  <Text style={styles.activityMeta}>
                    {formatTime(a.performed_at)} · {a.duration_min} min
                    {a.distance_km ? ` · ${a.distance_km} km` : ''}
                  </Text>
                  {a.notes && <Text style={styles.activityNotes}>{a.notes}</Text>}
                </View>
                <View style={styles.activityRight}>
                  <Text style={styles.activityKcal}>{a.kcal} kcal</Text>
                  <Pressable
                    onPress={() => confirmRemove(a)}
                    style={styles.deleteBtn}
                    hitSlop={8}
                  >
                    <Ionicons name="trash-outline" size={18} color={colors.danger} />
                  </Pressable>
                </View>
              </View>
            </Card>
          ))
        )}
      </ScrollView>

      <Pressable style={styles.fab} onPress={() => setEditorOpen(true)}>
        <Ionicons name="add" size={28} color={colors.bg} />
      </Pressable>

      <ActivityEditorModal
        visible={editorOpen}
        user={user}
        onClose={() => setEditorOpen(false)}
        onSaved={async () => {
          setEditorOpen(false);
          await load();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  cardLabel: {
    color: colors.textMuted,
    fontSize: 11,
    letterSpacing: 1.5,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  summaryStat: { alignItems: 'center', flex: 1 },
  summaryValue: { color: colors.primary, fontSize: 22, fontWeight: '800' },
  summaryUnit: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  emptyTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    marginTop: spacing.sm,
  },
  emptySub: {
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xs,
    paddingHorizontal: spacing.md,
    lineHeight: 18,
  },
  activityHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  activityName: { color: colors.text, fontSize: 16, fontWeight: '700' },
  activityMeta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  activityNotes: { color: colors.textMuted, fontSize: 12, marginTop: 4, fontStyle: 'italic' },
  activityRight: { alignItems: 'flex-end', gap: spacing.xs },
  activityKcal: { color: colors.primary, fontSize: 16, fontWeight: '700' },
  deleteBtn: { padding: spacing.xs, borderRadius: radius.md },
  fab: {
    position: 'absolute',
    right: spacing.md,
    bottom: spacing.md,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
});
