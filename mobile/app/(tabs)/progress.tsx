import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Input } from '../../components/Input';
import { DayBar, WeekBarChart } from '../../components/WeekBarChart';
import { useAuth } from '../../lib/auth';
import { brDateToISO, maskBrDate, todayISO } from '../../lib/format';
import {
  addDaysISO,
  dailyRecords,
  firstActivityDate,
  groupByWeek,
  WeekBlock,
} from '../../lib/history';
import { generateWeeklyReportPdf, shareReport } from '../../lib/reports/weeklyReport';
import { colors, spacing } from '../../lib/theme';

const DOW = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D']; // seg→dom

function isoToBr(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function weekLabel(weekStart: string): string {
  const end = addDaysISO(weekStart, 6);
  const [, m1, d1] = weekStart.split('-');
  const [, m2, d2] = end.split('-');
  return `${d1}/${m1} – ${d2}/${m2}`;
}

export default function ProgressScreen() {
  const auth = useAuth();
  const [generating, setGenerating] = useState(false);

  const [startBr, setStartBr] = useState('');
  const [endBr, setEndBr] = useState('');
  const [weeks, setWeeks] = useState<WeekBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [inicializou, setInicializou] = useState(false);

  const userId = auth.status === 'authed' ? auth.user.id : null;
  const goalWater = auth.status === 'authed' ? auth.user.daily_water_goal_ml : null;
  const goalKcal = auth.status === 'authed' ? auth.user.daily_calorie_goal ?? null : null;

  const carregar = useCallback(
    async (startISO: string, endISO: string) => {
      if (!userId) return;
      setLoading(true);
      setErro(null);
      try {
        const recs = await dailyRecords(userId, startISO, endISO);
        setWeeks(groupByWeek(recs));
      } catch (e: any) {
        setErro(e?.message ?? 'Falha ao carregar histórico.');
      } finally {
        setLoading(false);
      }
    },
    [userId]
  );

  // Carga automática uma única vez (primeiro registro → hoje). Depois disso o
  // intervalo escolhido pelo usuário é preservado ao sair e voltar da aba.
  useFocusEffect(
    useCallback(() => {
      if (!userId || inicializou) return;
      let cancelado = false;
      (async () => {
        const first = (await firstActivityDate(userId)) ?? todayISO();
        const hoje = todayISO();
        if (cancelado) return;
        setStartBr(isoToBr(first));
        setEndBr(isoToBr(hoje));
        setInicializou(true);
        await carregar(first, hoje);
      })();
      return () => {
        cancelado = true;
      };
    }, [userId, inicializou, carregar])
  );

  function aplicarIntervalo() {
    const s = brDateToISO(startBr);
    const e = brDateToISO(endBr);
    if (!s || !e) {
      setErro('Use datas no formato dd/mm/aaaa.');
      return;
    }
    if (s > e) {
      setErro('A data inicial precisa ser antes da final.');
      return;
    }
    carregar(s, e);
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

  const comDados = weeks.filter((w) => w.hasData).length;

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

      {/* ── Seletor de intervalo ── */}
      <Card title="Histórico">
        <View style={styles.rangeRow}>
          <View style={{ flex: 1, marginRight: spacing.sm }}>
            <Input
              label="De"
              value={startBr}
              onChangeText={(v) => setStartBr(maskBrDate(v))}
              placeholder="dd/mm/aaaa"
              keyboardType="numeric"
              maxLength={10}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Input
              label="Até"
              value={endBr}
              onChangeText={(v) => setEndBr(maskBrDate(v))}
              placeholder="dd/mm/aaaa"
              keyboardType="numeric"
              maxLength={10}
            />
          </View>
        </View>
        {erro && <Text style={styles.erro}>{erro}</Text>}
        <Button title="Aplicar intervalo" variant="secondary" onPress={aplicarIntervalo} />
        <Text style={styles.rangeHint}>
          {loading
            ? 'Carregando…'
            : `${weeks.length} semana(s) no intervalo · ${comDados} com registros. Semanas e dias vazios aparecem como espaços — é o sinal de que faltou lançar.`}
        </Text>
      </Card>

      {/* ── Cards semanais ── */}
      {!loading && weeks.length === 0 && (
        <Card>
          <View style={{ alignItems: 'center', paddingVertical: spacing.lg }}>
            <Ionicons name="analytics-outline" size={44} color={colors.textMuted} />
            <Text style={styles.title}>Sem registros no período</Text>
            <Text style={styles.subtitle}>
              Comece a lançar hidratação, refeições, treinos e suplementos para ver sua
              evolução aqui.
            </Text>
          </View>
        </Card>
      )}

      {weeks.map((w) => {
        const barra = (pick: (d: WeekBlock['days'][number]) => number): DayBar[] =>
          w.days.map((d, i) => ({
            label: DOW[i],
            value: pick(d),
            hasData: d.hasData && pick(d) > 0,
          }));

        return (
          <Card key={w.weekStart}>
            <Text style={styles.weekTitle}>Semana {weekLabel(w.weekStart)}</Text>
            {!w.hasData ? (
              <Text style={styles.weekEmpty}>Nenhum registro nesta semana.</Text>
            ) : (
              <>
                <WeekBarChart title="Hidratação" unit="ml/dia" days={barra((d) => d.hydration_ml)} color="#38BDF8" goal={goalWater} />
                <WeekBarChart title="Refeições" unit="kcal/dia" days={barra((d) => d.meals_kcal)} color={colors.primary} goal={goalKcal} />
                <WeekBarChart title="Treinos" unit="séries feitas" days={barra((d) => d.workout_sets)} color="#A78BFA" />
                <WeekBarChart title="Suplementos" unit="tomadas" days={barra((d) => d.supplement_intakes)} color="#FB923C" />
              </>
            )}
          </Card>
        );
      })}

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
  title: { color: colors.text, fontSize: 18, fontWeight: '700', marginTop: spacing.sm },
  subtitle: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.sm, paddingHorizontal: spacing.md },
  rangeRow: { flexDirection: 'row' },
  rangeHint: { color: colors.textMuted, fontSize: 12, lineHeight: 17, marginTop: spacing.sm },
  weekTitle: { color: colors.text, fontSize: 15, fontWeight: '800', marginBottom: spacing.sm },
  weekEmpty: { color: colors.textMuted, fontSize: 13 },
  erro: { color: colors.danger, fontSize: 13, marginBottom: spacing.sm },
  helper: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
});
