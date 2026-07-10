import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { DayBar, WeekBarChart } from '../../components/WeekBarChart';
import { useAuth } from '../../lib/auth';
import { todayISO } from '../../lib/format';
import {
  addDaysISO,
  dailyRecords,
  firstActivityDate,
  groupByWeek,
  mondayOf,
  WeekBlock,
} from '../../lib/history';
import { generateWeeklyReportPdf, shareReport } from '../../lib/reports/weeklyReport';
import { colors, spacing } from '../../lib/theme';

const DOW = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D']; // seg→dom

function weekLabel(weekStart: string): string {
  const end = addDaysISO(weekStart, 6);
  const [, m1, d1] = weekStart.split('-');
  const [, m2, d2] = end.split('-');
  return `${d1}/${m1} – ${d2}/${m2}`;
}

export default function ProgressScreen() {
  const auth = useAuth();
  const [generating, setGenerating] = useState(false);

  const [refMonday, setRefMonday] = useState<string | null>(null);
  const [firstMonday, setFirstMonday] = useState<string | null>(null);
  const [week, setWeek] = useState<WeekBlock | null>(null);
  const [loading, setLoading] = useState(true);

  const userId = auth.status === 'authed' ? auth.user.id : null;
  const goalWater = auth.status === 'authed' ? auth.user.daily_water_goal_ml : null;
  const goalKcal = auth.status === 'authed' ? auth.user.daily_calorie_goal ?? null : null;

  const thisMonday = mondayOf(todayISO());

  const carregarSemana = useCallback(
    async (monday: string) => {
      if (!userId) return;
      setLoading(true);
      try {
        const recs = await dailyRecords(userId, monday, addDaysISO(monday, 6));
        const blocks = groupByWeek(recs);
        setWeek(blocks[0] ?? null);
      } finally {
        setLoading(false);
      }
    },
    [userId]
  );

  // Primeira carga: semana atual.
  useFocusEffect(
    useCallback(() => {
      if (!userId || refMonday) return;
      let cancelado = false;
      (async () => {
        const first = await firstActivityDate(userId);
        if (cancelado) return;
        setFirstMonday(first ? mondayOf(first) : thisMonday);
        setRefMonday(thisMonday);
        await carregarSemana(thisMonday);
      })();
      return () => {
        cancelado = true;
      };
    }, [userId, refMonday, thisMonday, carregarSemana])
  );

  function navegar(deltaSemanas: number) {
    if (!refMonday) return;
    const alvo = addDaysISO(refMonday, deltaSemanas * 7);
    if (alvo > thisMonday) return; // não vai pro futuro
    setRefMonday(alvo);
    carregarSemana(alvo);
  }

  function irParaHoje() {
    setRefMonday(thisMonday);
    carregarSemana(thisMonday);
  }

  async function onGenerate() {
    if (auth.status !== 'authed') return;
    setGenerating(true);
    try {
      const report = await generateWeeklyReportPdf(auth.user);
      await shareReport(report);
    } catch (e: any) {
      Alert.alert('Erro', e?.message ?? 'Falha ao gerar relatório.');
    } finally {
      setGenerating(false);
    }
  }

  if (auth.status !== 'authed') return null;
  const u = auth.user;

  const naSemanaAtual = refMonday === thisMonday;
  const podeVoltar = firstMonday ? (refMonday ?? thisMonday) > firstMonday : true;

  const barra = (pick: (d: WeekBlock['days'][number]) => number): DayBar[] =>
    (week?.days ?? []).map((d, i) => ({
      label: DOW[i],
      value: pick(d),
      hasData: d.hasData && pick(d) > 0,
    }));

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: spacing.md, paddingBottom: 80 }}
    >
      <Card title="Peso">
        <Text style={styles.bigValue}>
          {u.current_weight_kg} <Text style={styles.unit}>kg</Text>
        </Text>
        <Text style={styles.subtitle}>Meta: {u.goal_weight_kg} kg</Text>
      </Card>

      {/* ── Navegação de semana ── */}
      <Card>
        <View style={styles.nav}>
          <Pressable
            onPress={() => navegar(-1)}
            disabled={!podeVoltar}
            hitSlop={8}
            style={[styles.navBtn, !podeVoltar && styles.navBtnOff]}
          >
            <Ionicons name="chevron-back" size={22} color={podeVoltar ? colors.primary : colors.border} />
          </Pressable>

          <View style={{ alignItems: 'center' }}>
            <Text style={styles.weekTitle}>
              {refMonday ? `Semana ${weekLabel(refMonday)}` : '—'}
            </Text>
            <Text style={styles.weekSub}>{naSemanaAtual ? 'Semana atual' : 'Toque em Hoje para voltar'}</Text>
          </View>

          <Pressable
            onPress={() => navegar(1)}
            disabled={naSemanaAtual}
            hitSlop={8}
            style={[styles.navBtn, naSemanaAtual && styles.navBtnOff]}
          >
            <Ionicons name="chevron-forward" size={22} color={naSemanaAtual ? colors.border : colors.primary} />
          </Pressable>
        </View>
        {!naSemanaAtual && (
          <Pressable onPress={irParaHoje} style={styles.hoje}>
            <Text style={styles.hojeTxt}>Ir para hoje</Text>
          </Pressable>
        )}
      </Card>

      {/* ── Gráficos da semana ── */}
      <Card>
        {loading ? (
          <Text style={styles.loading}>Carregando…</Text>
        ) : !week || !week.hasData ? (
          <View style={{ alignItems: 'center', paddingVertical: spacing.md }}>
            <Ionicons name="calendar-outline" size={40} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>Nenhum registro nesta semana</Text>
            <Text style={styles.subtitle}>
              Os dias sem lançamento aparecem como espaços tracejados — lançar todo dia deixa
              seu histórico completo.
            </Text>
          </View>
        ) : (
          <>
            <WeekBarChart title="Hidratação" unit="ml/dia" days={barra((d) => d.hydration_ml)} color="#38BDF8" goal={goalWater} />
            <WeekBarChart title="Refeições" unit="kcal/dia" days={barra((d) => d.meals_kcal)} color={colors.primary} goal={goalKcal} />
            <WeekBarChart title="Treinos" unit="séries feitas" days={barra((d) => d.workout_sets)} color="#A78BFA" />
            <WeekBarChart title="Suplementos" unit="tomadas" days={barra((d) => d.supplement_intakes)} color="#FB923C" />
          </>
        )}
      </Card>

      {/* ── PDF (o modelo será unificado com este painel depois de validar) ── */}
      <Card title="Relatório semanal">
        <Text style={styles.helper}>
          Gera um PDF dos últimos 7 dias para compartilhar. Em breve, o mesmo modelo deste
          histórico vai montar o relatório.
        </Text>
        <Button
          title={generating ? 'Gerando…' : 'Gerar e compartilhar PDF'}
          onPress={onGenerate}
          loading={generating}
          style={{ marginTop: spacing.sm }}
        />
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  bigValue: { color: colors.text, fontSize: 40, fontWeight: '800' },
  unit: { color: colors.textMuted, fontSize: 20, fontWeight: '600' },
  subtitle: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.sm, paddingHorizontal: spacing.md },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  navBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  navBtnOff: { backgroundColor: 'transparent' },
  weekTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  weekSub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  hoje: { alignSelf: 'center', marginTop: spacing.sm, paddingVertical: 6, paddingHorizontal: 16 },
  hojeTxt: { color: colors.primary, fontSize: 13, fontWeight: '700' },
  loading: { color: colors.textMuted, textAlign: 'center', paddingVertical: spacing.md },
  emptyTitle: { color: colors.text, fontSize: 16, fontWeight: '700', marginTop: spacing.sm },
  helper: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
});
