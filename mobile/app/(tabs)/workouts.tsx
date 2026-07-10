import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ActivityEditorModal } from '../../components/ActivityEditorModal';
import { Card } from '../../components/Card';
import { useAuth } from '../../lib/auth';
import { formatTime, todayISO } from '../../lib/format';
import { deleteActivity, listActivitiesOfDay } from '../../lib/repos/activities';
import { seedInitialWorkoutsIfNeeded } from '../../lib/repos/workoutSeed';
import { listSessions, SessionSummary, startSessionFromTemplate, todaySession } from '../../lib/repos/workoutSessions';
import { listTemplates } from '../../lib/repos/workoutTemplates';
import { colors, radius, spacing } from '../../lib/theme';
import { Activity, WorkoutSession, WorkoutTemplate } from '../../lib/types';

export default function WorkoutsScreen() {
  const auth = useAuth();
  const router = useRouter();
  const user = auth.status === 'authed' ? auth.user : null;
  const userId = user?.id ?? null;

  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [today, setToday] = useState<WorkoutSession | null>(null);
  const [recent, setRecent] = useState<SessionSummary[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [editorOpen, setEditorOpen] = useState(false);

  const load = useCallback(async () => {
    if (!userId || !user) return;
    await seedInitialWorkoutsIfNeeded(userId, user.email);
    setTemplates(await listTemplates(userId));
    setToday(await todaySession(userId, todayISO()));
    setRecent((await listSessions(userId, 3)));
    setActivities(await listActivitiesOfDay(userId, todayISO()));
  }, [userId, user]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (!user || !userId) return null;

  async function iniciar(templateId: number) {
    const id = await startSessionFromTemplate(userId!, templateId);
    router.push(`/workout-session/${id}`);
  }

  function escolherTreino() {
    if (templates.length === 0) {
      router.push('/workout-template/new');
      return;
    }
    Alert.alert(
      'Iniciar treino',
      'Qual treino você vai fazer hoje?',
      [
        ...templates.map((t) => ({ text: t.name, onPress: () => iniciar(t.id) })),
        { text: 'Cancelar', style: 'cancel' as const },
      ],
      { cancelable: true }
    );
  }

  function confirmRemoveActivity(a: Activity) {
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

  const cardioKcal = activities.reduce((acc, a) => acc + a.kcal, 0);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 120 }}>
        {/* ── Treino do dia ── */}
        {today ? (
          <Pressable onPress={() => router.push(`/workout-session/${today.id}`)}>
            <Card>
              <Text style={styles.label}>TREINO DE HOJE</Text>
              <Text style={styles.todayName}>{today.name}</Text>
              <View style={styles.rowBetween}>
                <Text style={styles.todaySub}>{formatTime(today.performed_at)} · toque para continuar</Text>
                <Ionicons name="chevron-forward" size={20} color={colors.primary} />
              </View>
            </Card>
          </Pressable>
        ) : (
          <Pressable onPress={escolherTreino}>
            <Card>
              <View style={styles.startRow}>
                <View style={styles.startIcon}>
                  <Ionicons name="barbell" size={24} color={colors.bg} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.startTitle}>Iniciar treino de hoje</Text>
                  <Text style={styles.startSub}>
                    {templates.length ? 'Escolha um dos seus treinos' : 'Crie seu primeiro treino'}
                  </Text>
                </View>
                <Ionicons name="add-circle" size={28} color={colors.primary} />
              </View>
            </Card>
          </Pressable>
        )}

        {/* ── Meus treinos ── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Meus treinos</Text>
          <Pressable onPress={() => router.push('/workout-template/new')} hitSlop={8}>
            <Text style={styles.link}>+ Novo</Text>
          </Pressable>
        </View>

        {templates.length === 0 ? (
          <Card>
            <Text style={styles.emptySub}>
              Nenhum treino ainda. Crie um modelo com seus exercícios, séries e repetições —
              depois é só escolher e ir marcando o que fez.
            </Text>
          </Card>
        ) : (
          templates.map((t) => (
            <Card key={t.id}>
              <View style={styles.rowBetween}>
                <Pressable style={{ flex: 1 }} onPress={() => iniciar(t.id)}>
                  <Text style={styles.tplName}>{t.name}</Text>
                  {t.notes ? <Text style={styles.tplNotes} numberOfLines={1}>{t.notes}</Text> : null}
                </Pressable>
                <Pressable
                  onPress={() => router.push(`/workout-template/${t.id}`)}
                  hitSlop={8}
                  style={styles.editBtn}
                >
                  <Ionicons name="create-outline" size={20} color={colors.textMuted} />
                </Pressable>
              </View>
            </Card>
          ))
        )}

        {/* ── Histórico + evolução ── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Histórico</Text>
          <Pressable onPress={() => router.push('/workout-history')} hitSlop={8}>
            <Text style={styles.link}>Ver tudo</Text>
          </Pressable>
        </View>
        {recent.length === 0 ? (
          <Card><Text style={styles.emptySub}>Suas sessões concluídas aparecem aqui.</Text></Card>
        ) : (
          recent.map((s) => (
            <Pressable key={s.id} onPress={() => router.push(`/workout-session/${s.id}`)}>
              <Card>
                <View style={styles.rowBetween}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.tplName}>{s.name}</Text>
                    <Text style={styles.tplNotes}>
                      {s.performed_at.slice(0, 10)} · {s.done_sets}/{s.total_sets} séries · {Math.round(s.total_load)} kg vol.
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </View>
              </Card>
            </Pressable>
          ))
        )}
        <Pressable onPress={() => router.push('/workout-progress')}>
          <Card>
            <View style={styles.rowBetween}>
              <View style={styles.startRow}>
                <Ionicons name="trending-up" size={20} color={colors.primary} />
                <Text style={[styles.tplName, { marginLeft: spacing.sm }]}>Evolução de carga</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </View>
          </Card>
        </Pressable>

        {/* ── Cardio / atividades (recurso existente, preservado) ── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Cardio de hoje</Text>
          <Pressable onPress={() => setEditorOpen(true)} hitSlop={8}>
            <Text style={styles.link}>+ Registrar</Text>
          </Pressable>
        </View>
        {activities.length === 0 ? (
          <Card><Text style={styles.emptySub}>Caminhada, bike, esteira… registre o cardio do fim do treino.</Text></Card>
        ) : (
          <Card>
            <Text style={styles.label}>{cardioKcal} kcal queimadas hoje</Text>
            {activities.map((a) => (
              <View key={a.id} style={styles.activityRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.tplName}>{a.name}</Text>
                  <Text style={styles.tplNotes}>
                    {formatTime(a.performed_at)} · {a.duration_min} min{a.distance_km ? ` · ${a.distance_km} km` : ''}
                  </Text>
                </View>
                <Text style={styles.activityKcal}>{a.kcal} kcal</Text>
                <Pressable onPress={() => confirmRemoveActivity(a)} hitSlop={8} style={{ marginLeft: spacing.sm }}>
                  <Ionicons name="trash-outline" size={18} color={colors.danger} />
                </Pressable>
              </View>
            ))}
          </Card>
        )}
      </ScrollView>

      <Pressable style={styles.fab} onPress={escolherTreino}>
        <Ionicons name="barbell" size={26} color={colors.bg} />
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
  label: { color: colors.textMuted, fontSize: 11, letterSpacing: 1.5, fontWeight: '600', marginBottom: spacing.xs },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  todayName: { color: colors.text, fontSize: 20, fontWeight: '800', marginBottom: 4 },
  todaySub: { color: colors.textMuted, fontSize: 13 },
  startRow: { flexDirection: 'row', alignItems: 'center' },
  startIcon: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm,
  },
  startTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  startSub: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: spacing.lg, marginBottom: spacing.sm, paddingHorizontal: 4,
  },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  link: { color: colors.primary, fontSize: 14, fontWeight: '700' },
  tplName: { color: colors.text, fontSize: 15, fontWeight: '600' },
  tplNotes: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  editBtn: { padding: 6, marginLeft: spacing.sm },
  emptySub: { color: colors.textMuted, fontSize: 13, lineHeight: 19 },
  activityRow: {
    flexDirection: 'row', alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border,
    paddingTop: spacing.sm, marginTop: spacing.sm,
  },
  activityKcal: { color: colors.primary, fontSize: 14, fontWeight: '700' },
  fab: {
    position: 'absolute', right: spacing.lg, bottom: spacing.lg,
    width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
});
