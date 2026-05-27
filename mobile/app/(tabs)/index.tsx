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
import { ageFromBirth, get, tmb, todayISO } from '../../lib/format';
import { sumKcalOfDay as sumActivityKcalOfDay } from '../../lib/repos/activities';
import { listFavoriteBottles } from '../../lib/repos/bottles';
import { addEntry, sumMlOfDay } from '../../lib/repos/hydration';
import { totalsOfDay } from '../../lib/repos/meals';
import {
  listMedications,
  MedicationWithToday,
  recordIntake,
  reminderStatuses,
} from '../../lib/repos/medications';
import { colors, radius, spacing } from '../../lib/theme';
import { Bottle } from '../../lib/types';

export default function HojeScreen() {
  const auth = useAuth();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [favorites, setFavorites] = useState<Bottle[]>([]);
  const [hydrationMl, setHydrationMl] = useState(0);
  const [mealKcal, setMealKcal] = useState(0);
  const [activityKcal, setActivityKcal] = useState(0);
  const [meds, setMeds] = useState<MedicationWithToday[]>([]);

  const userId = auth.status === 'authed' ? auth.user.id : null;
  const user = auth.status === 'authed' ? auth.user : null;

  const load = useCallback(async () => {
    if (!userId) return;
    const day = todayISO();
    const [favs, ml, totals, actKcal, supps] = await Promise.all([
      listFavoriteBottles(userId),
      sumMlOfDay(userId, day),
      totalsOfDay(userId, day),
      sumActivityKcalOfDay(userId, day),
      listMedications(userId),
    ]);
    setFavorites(favs);
    setHydrationMl(ml);
    setMealKcal(Math.round(totals.kcal));
    setActivityKcal(actKcal);
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

  async function takeSupp(m: MedicationWithToday) {
    await recordIntake(m.id);
    await load();
  }

  if (!user) return null;

  const today = format(parseISO(todayISO()), "EEEE, dd 'de' MMMM", { locale: ptBR });
  const age = ageFromBirth(user.birth_date);
  const userTmb = tmb(user.sex, user.current_weight_kg, user.height_cm, age);
  const userGet = get(userTmb, user.activity_level);
  const goalKcal = user.daily_calorie_goal ?? Math.round(userGet - 500);
  const balance = mealKcal - activityKcal - goalKcal;
  const isDeficit = balance < 0;

  const waterPct = Math.min(1, hydrationMl / user.daily_water_goal_ml);

  // Lembretes pendentes/tomados de hoje, só pra suplementos que têm lembretes cadastrados
  const suppsWithReminders = meds
    .map((m) => ({
      med: m,
      statuses: reminderStatuses(m.reminder_times, m.today_count),
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

      <Card>
        <Text style={styles.cardLabel}>BALANÇO DE HOJE</Text>
        <Text
          style={[
            styles.balance,
            { color: isDeficit ? colors.success : colors.warning },
          ]}
        >
          {balance > 0 ? '+' : ''}
          {balance} kcal
        </Text>
        <Text style={styles.balanceHint}>
          {isDeficit ? 'Em déficit — emagrecendo' : 'Em superávit'}
        </Text>
        <View style={styles.statsRow}>
          <Stat label="Consumido" value={`${mealKcal}`} />
          <Stat label="Queimado" value={`${activityKcal}`} />
          <Stat label="Meta" value={`${goalKcal}`} />
        </View>
      </Card>

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
  balance: {
    fontSize: 40,
    fontWeight: '800',
    marginTop: 4,
  },
  balanceHint: {
    color: colors.textMuted,
    marginTop: 2,
    marginBottom: spacing.md,
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
