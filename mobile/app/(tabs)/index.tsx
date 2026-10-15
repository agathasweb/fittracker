import { Ionicons } from '@expo/vector-icons';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useRouter, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Card } from '../../components/Card';
import { ProgressBar } from '../../components/ProgressBar';
import { useAuth } from '../../lib/auth';
import { ageFromBirth, formatTime, tmb, todayISO } from '../../lib/format';
import { listFavoriteBottles } from '../../lib/repos/bottles';
import { addEntry, sumMlOfDay } from '../../lib/repos/hydration';
import {
  listMedications,
  MedicationWithToday,
  recordIntake,
  reminderStatuses,
} from '../../lib/repos/medications';
import { listSources, logSource, sumProteinOfDay } from '../../lib/repos/protein';
import { lastReading } from '../../lib/repos/bloodPressure';
import { colors, radius, spacing } from '../../lib/theme';
import { BloodPressureReading, Bottle, ProteinSource } from '../../lib/types';

export default function HojeScreen() {
  const auth = useAuth();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [favorites, setFavorites] = useState<Bottle[]>([]);
  const [hydrationMl, setHydrationMl] = useState(0);
  const [proteinG, setProteinG] = useState(0);
  const [proteinSources, setProteinSources] = useState<ProteinSource[]>([]);
  const [bp, setBp] = useState<BloodPressureReading | null>(null);
  const [meds, setMeds] = useState<MedicationWithToday[]>([]);

  const userId = auth.status === 'authed' ? auth.user.id : null;
  const user = auth.status === 'authed' ? auth.user : null;

  const load = useCallback(async () => {
    if (!userId) return;
    const day = todayISO();
    const [favs, ml, protein, sources, supps, lastBp] = await Promise.all([
      listFavoriteBottles(userId),
      sumMlOfDay(userId, day),
      sumProteinOfDay(userId, day),
      listSources(userId),
      listMedications(userId),
      lastReading(userId),
    ]);
    setBp(lastBp);
    setFavorites(favs);
    setHydrationMl(ml);
    setProteinG(protein);
    setProteinSources(sources);
    setMeds(supps);
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  async function logBottle(b: Bottle) {
    if (!userId) return;
    await addEntry(userId, b.capacity_ml, b.id);
    setHydrationMl((v) => v + b.capacity_ml);
  }

  async function logProtein(s: ProteinSource) {
    if (!userId) return;
    await logSource(userId, s);
    setProteinG((v) => v + s.protein_g);
  }

  async function takeSupp(m: MedicationWithToday) {
    await recordIntake(m.id);
    await load();
  }

  if (!user) return null;

  const today = format(parseISO(todayISO()), "EEEE, dd 'de' MMMM", { locale: ptBR });
  const age = ageFromBirth(user.birth_date);
  const userTmb = tmb(user.sex, user.current_weight_kg, user.height_cm, age);
  const proteinGoal = user.daily_protein_goal_g;
  const proteinLeft = Math.max(0, Math.round(proteinGoal - proteinG));

  const waterPct = Math.min(1, hydrationMl / user.daily_water_goal_ml);

  // Lembretes pendentes/tomados de hoje, só pra suplementos que têm lembretes cadastrados
  const suppsWithReminders = meds
    .map((m) => ({
      med: m,
      statuses: reminderStatuses(m.reminder_times, m.today_count, m.reminder_weekday),
    }))
    .filter((s) => s.statuses.length > 0);
  const totalReminders = suppsWithReminders.reduce((acc, s) => acc + s.statuses.length, 0);
  const totalTaken = suppsWithReminders.reduce(
    (acc, s) => acc + s.statuses.filter((x) => x.taken).length,
    0
  );

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          tintColor={colors.primary}
          refreshing={refreshing}
          onRefresh={onRefresh}
        />
      }
    >
      <Text style={styles.greeting}>Olá, {user.name.split(' ')[0]}</Text>
      <Text style={styles.date}>{today}</Text>

      <Pressable onPress={() => router.push('/hydration')}>
        <Card>
          <View style={styles.hydrationHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardLabel}>HIDRATAÇÃO</Text>
              <Text style={styles.hydrationValue}>
                {hydrationMl} <Text style={styles.hydrationUnit}>ml</Text>
              </Text>
              <Text style={styles.hydrationGoal}>
                de {user.daily_water_goal_ml} ml ({Math.round(waterPct * 100)}%)
              </Text>
            </View>
            <Ionicons name="water" size={42} color={colors.primary} />
          </View>
          <ProgressBar value={hydrationMl} max={user.daily_water_goal_ml} height={12} />

          {favorites.length === 0 ? (
            <Text style={styles.hydrationEmpty}>
              Cadastre suas garrafas favoritas pra lançar com um toque →
            </Text>
          ) : (
            <View style={styles.bottlesRow}>
              {favorites.slice(0, 4).map((b) => (
                <Pressable
                  key={b.id}
                  onPress={(e) => {
                    e.stopPropagation();
                    logBottle(b);
                  }}
                  style={styles.bottleChip}
                >
                  <Ionicons name="add" size={16} color={colors.bg} />
                  <Text style={styles.bottleChipText}>
                    {b.name} · {b.capacity_ml}ml
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </Card>
      </Pressable>

      <Pressable onPress={() => router.push('/protein')}>
        <Card>
          <View style={styles.hydrationHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardLabel}>META PROTEICA</Text>
              <Text style={styles.hydrationValue}>
                {Math.round(proteinG)} <Text style={styles.hydrationUnit}>g</Text>
              </Text>
              <Text style={styles.hydrationGoal}>
                {proteinLeft > 0
                  ? `de ${proteinGoal} g · faltam ${proteinLeft} g`
                  : `de ${proteinGoal} g · meta batida!`}
              </Text>
            </View>
            <Ionicons name="nutrition" size={42} color={colors.primary} />
          </View>
          <ProgressBar value={proteinG} max={proteinGoal} height={12} />
          <View style={styles.bottlesRow}>
            {proteinSources.map((s) => (
              <Pressable
                key={s.id}
                onPress={(e) => {
                  e.stopPropagation();
                  logProtein(s);
                }}
                style={styles.bottleChip}
              >
                <Ionicons name="add" size={16} color={colors.bg} />
                <Text style={styles.bottleChipText}>
                  {s.name} · {Math.round(s.protein_g)}g
                </Text>
              </Pressable>
            ))}
          </View>
        </Card>
      </Pressable>

      <Pressable onPress={() => router.push('/blood-pressure')}>
        <Card>
          <View style={styles.hydrationHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardLabel}>PRESSÃO ARTERIAL</Text>
              {bp ? (
                <>
                  <Text style={styles.hydrationValue}>
                    {bp.systolic}/{bp.diastolic} <Text style={styles.hydrationUnit}>mmHg</Text>
                  </Text>
                  <Text style={styles.hydrationGoal}>
                    {bp.measured_at.slice(0, 10) === todayISO()
                      ? `hoje às ${formatTime(bp.measured_at)}`
                      : `em ${bp.measured_at.slice(8, 10)}/${bp.measured_at.slice(5, 7)} às ${formatTime(bp.measured_at)}`}
                    {bp.source === 'watch' ? ' · relógio' : ''}
                  </Text>
                </>
              ) : (
                <Text style={styles.hydrationGoal}>Toque pra conectar o relógio ou lançar uma medição</Text>
              )}
            </View>
            <Ionicons name="heart" size={42} color={colors.danger} />
          </View>
        </Card>
      </Pressable>

      {suppsWithReminders.length > 0 && (
        <Card>
          <View style={styles.suppHeader}>
            <Text style={styles.cardLabel}>SUPLEMENTOS DE HOJE</Text>
            <Text style={styles.suppCount}>
              {totalTaken}/{totalReminders} tomados
            </Text>
          </View>
          {suppsWithReminders.map(({ med, statuses }) => (
            <View key={med.id} style={styles.suppRow}>
              <View style={[styles.suppDot, { backgroundColor: med.color || colors.primary }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.suppName}>{med.name}</Text>
                <View style={styles.timesWrap}>
                  {statuses.map((s) => (
                    <View
                      key={s.time}
                      style={[styles.timeChip, s.taken && styles.timeChipTaken]}
                    >
                      {s.taken && (
                        <Ionicons name="checkmark" size={12} color={colors.bg} />
                      )}
                      <Text
                        style={[styles.timeChipText, s.taken && styles.timeChipTextTaken]}
                      >
                        {s.time}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
              <Pressable
                onPress={() => takeSupp(med)}
                style={styles.takeBtn}
                hitSlop={6}
              >
                <Ionicons name="add" size={18} color={colors.bg} />
              </Pressable>
            </View>
          ))}
        </Card>
      )}

      <Card title="Perfil resumido">
        <View style={styles.statsRow}>
          <Stat label="TMB" value={`${userTmb}`} unit="kcal" />
          <Stat
            label="Peso"
            value={`${user.current_weight_kg}`}
            unit="kg"
          />
          <Stat label="Meta" value={`${user.goal_weight_kg}`} unit="kg" />
        </View>
      </Card>
    </ScrollView>
  );
}

function Stat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>
        {value}
        {unit && <Text style={styles.statUnit}> {unit}</Text>}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { backgroundColor: colors.bg, flex: 1 },
  content: { padding: spacing.md, paddingTop: spacing.lg },
  greeting: { color: colors.text, fontSize: 24, fontWeight: '700' },
  date: {
    color: colors.textMuted,
    marginBottom: spacing.lg,
    textTransform: 'capitalize',
  },
  cardLabel: {
    color: colors.textMuted,
    fontSize: 11,
    letterSpacing: 1.5,
    fontWeight: '600',
  },
  hydrationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  hydrationValue: {
    color: colors.text,
    fontSize: 36,
    fontWeight: '800',
    marginTop: 2,
  },
  hydrationUnit: {
    color: colors.textMuted,
    fontSize: 18,
    fontWeight: '600',
  },
  hydrationGoal: {
    color: colors.textMuted,
    fontSize: 13,
  },
  hydrationEmpty: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  bottlesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  bottleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary,
    paddingVertical: 6,
    paddingHorizontal: spacing.sm + 2,
    borderRadius: radius.pill,
  },
  bottleChipText: {
    color: colors.bg,
    fontWeight: '700',
    fontSize: 13,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stat: { alignItems: 'center', flex: 1 },
  statLabel: { color: colors.textMuted, fontSize: 11, marginBottom: 2 },
  statValue: { color: colors.text, fontSize: 20, fontWeight: '700' },
  statUnit: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  suppHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  suppCount: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  suppRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  suppDot: { width: 10, height: 10, borderRadius: 5 },
  suppName: { color: colors.text, fontWeight: '700', fontSize: 14 },
  timesWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  timeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  timeChipTaken: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  timeChipText: { color: colors.textMuted, fontWeight: '600', fontSize: 12 },
  timeChipTextTaken: { color: colors.bg },
  takeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
