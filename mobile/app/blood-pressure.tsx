import { Ionicons } from '@expo/vector-icons';
import { addDays, format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Input } from '../components/Input';
import { useAuth } from '../lib/auth';
import { todayISO } from '../lib/format';
import { useRequireAuth } from '../lib/guards';
import {
  addManualReading,
  deleteReading,
  listReadingsOfDay,
  updateReading,
} from '../lib/repos/bloodPressure';
import { colors, radius, spacing } from '../lib/theme';
import { BloodPressureReading } from '../lib/types';

const HOURS = Array.from({ length: 24 }, (_, h) => h);

/** Faixas usuais de MAPA: vigília 07–22h, sono 23–06h. */
const isAwake = (h: number) => h >= 7 && h <= 22;

function avg(rs: BloodPressureReading[]): string | null {
  if (!rs.length) return null;
  const s = Math.round(rs.reduce((a, r) => a + r.systolic, 0) / rs.length);
  const d = Math.round(rs.reduce((a, r) => a + r.diastolic, 0) / rs.length);
  return `${s}/${d}`;
}

/** Formulário aberto: nova leitura (reading null) ou edição de uma existente. */
type FormState = { reading: BloodPressureReading | null };

export default function BloodPressureScreen() {
  const auth = useAuth();
  useRequireAuth();
  const userId = auth.status === 'authed' ? auth.user.id : null;

  const [day, setDay] = useState(todayISO());
  const [readings, setReadings] = useState<BloodPressureReading[]>([]);

  const [form, setForm] = useState<FormState | null>(null);
  const [time, setTime] = useState('');
  const [sys, setSys] = useState('');
  const [dia, setDia] = useState('');
  const [hr, setHr] = useState('');
  const [formErr, setFormErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    setReadings(await listReadingsOfDay(userId, day));
  }, [userId, day]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (!userId) return null;

  const isToday = day === todayISO();

  function openNew(h?: number) {
    const now = new Date();
    setForm({ reading: null });
    setTime(
      h != null
        ? `${String(h).padStart(2, '0')}:00`
        : isToday
          ? format(now, 'HH:mm')
          : '12:00'
    );
    setSys('');
    setDia('');
    setHr('');
    setFormErr(null);
  }

  function openEdit(r: BloodPressureReading) {
    setForm({ reading: r });
    setTime(r.measured_at.slice(11, 16));
    setSys(String(r.systolic));
    setDia(String(r.diastolic));
    setHr(r.heart_rate ? String(r.heart_rate) : '');
    setFormErr(null);
  }

  async function save() {
    const s = Number(sys);
    const d = Number(dia);
    const f = hr ? Number(hr) : null;
    const m = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
    if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) {
      setFormErr('Horário inválido (ex.: 08:30)');
      return;
    }
    if (!(s >= 60 && s <= 260) || !(d >= 30 && d <= 160) || d >= s) {
      setFormErr('Confira os valores (ex.: 120 / 80)');
      return;
    }
    const at = `${day} ${m[1].padStart(2, '0')}:${m[2]}:00`;
    const fc = f && f > 0 ? f : null;
    if (form?.reading) await updateReading(form.reading.id, at, s, d, fc);
    else await addManualReading(userId!, at, s, d, fc);
    setForm(null);
    await load();
  }

  function confirmDelete() {
    const r = form?.reading;
    if (!r) return;
    Alert.alert('Excluir leitura', `${r.systolic}/${r.diastolic} às ${r.measured_at.slice(11, 16)}?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          await deleteReading(r.id);
          setForm(null);
          await load();
        },
      },
    ]);
  }

  // Leituras agrupadas por hora (pode haver mais de uma na mesma hora).
  const byHour = new Map<number, BloodPressureReading[]>();
  for (const r of readings) {
    const h = Number(r.measured_at.slice(11, 13));
    byHour.set(h, [...(byHour.get(h) ?? []), r]);
  }
  const awake = readings.filter((r) => isAwake(Number(r.measured_at.slice(11, 13))));
  const asleep = readings.filter((r) => !isAwake(Number(r.measured_at.slice(11, 13))));

  return (
    <ScrollView style={{ backgroundColor: colors.bg, flex: 1 }} contentContainerStyle={{ padding: spacing.md }}>
      <View style={styles.nav}>
        <Pressable onPress={() => setDay(format(addDays(parseISO(day), -1), 'yyyy-MM-dd'))} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color={colors.primary} />
        </Pressable>
        <Text style={styles.navTitle}>
          {format(parseISO(day), "EEE, dd 'de' MMM", { locale: ptBR })}
        </Text>
        <Pressable
          onPress={() => setDay(format(addDays(parseISO(day), 1), 'yyyy-MM-dd'))}
          disabled={isToday}
          hitSlop={8}
        >
          <Ionicons name="chevron-forward" size={24} color={isToday ? colors.border : colors.primary} />
        </Pressable>
      </View>

      <Card>
        <View style={styles.summary}>
          <View style={styles.sumCell}>
            <Text style={styles.sumLabel}>Leituras</Text>
            <Text style={styles.sumValue}>{readings.length}</Text>
          </View>
          <View style={styles.sumCell}>
            <Text style={styles.sumLabel}>Vigília (7–22h)</Text>
            <Text style={styles.sumValue}>{avg(awake) ?? '—'}</Text>
          </View>
          <View style={styles.sumCell}>
            <Text style={styles.sumLabel}>Sono (23–6h)</Text>
            <Text style={styles.sumValue}>{avg(asleep) ?? '—'}</Text>
          </View>
        </View>
      </Card>

      <Button title="Lançar medição" onPress={() => openNew()} style={{ marginBottom: spacing.md }} />

      <Card>
        {HOURS.map((h) => {
          const rs = byHour.get(h) ?? [];
          if (rs.length === 0) {
            return (
              <Pressable key={h} style={styles.hourRow} onPress={() => openNew(h)}>
                <Text style={styles.hourLabel}>{String(h).padStart(2, '0')}h</Text>
                <Text style={styles.blank}>—</Text>
                <Ionicons name="add" size={16} color={colors.border} />
              </Pressable>
            );
          }
          return rs.map((r, i) => (
            <Pressable key={r.id} style={styles.hourRow} onPress={() => openEdit(r)}>
              <Text style={styles.hourLabel}>{i === 0 ? `${String(h).padStart(2, '0')}h` : ''}</Text>
              <Text style={styles.bp}>
                {r.systolic}/{r.diastolic}
                <Text style={styles.min}>  {r.measured_at.slice(11, 16)}</Text>
              </Text>
              {r.heart_rate ? <Text style={styles.hr}>FC {r.heart_rate}</Text> : null}
              <Ionicons name="create-outline" size={16} color={colors.textMuted} />
            </Pressable>
          ));
        })}
      </Card>

      <Text style={styles.disclaimer}>
        Toque numa hora vazia pra lançar uma medição; toque numa leitura pra editar ou excluir.
        Use o aparelho de braço pra medir; o registro aqui ajuda a ver a tendência, não substitui
        o exame de MAPA.
      </Text>

      <Modal visible={form != null} animationType="fade" transparent onRequestClose={() => setForm(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>{form?.reading ? 'Editar leitura' : 'Nova leitura'}</Text>
            <Input
              label="Horário"
              value={time}
              onChangeText={setTime}
              keyboardType="numbers-and-punctuation"
              placeholder="08:30"
            />
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Input label="Sistólica" value={sys} onChangeText={setSys} keyboardType="numeric" placeholder="120" />
              </View>
              <View style={{ flex: 1 }}>
                <Input label="Diastólica" value={dia} onChangeText={setDia} keyboardType="numeric" placeholder="80" />
              </View>
            </View>
            <Input
              label="Frequência cardíaca (opcional)"
              value={hr}
              onChangeText={setHr}
              keyboardType="numeric"
              placeholder="70"
              error={formErr}
            />
            <View style={styles.row}>
              <Button title="Cancelar" variant="secondary" onPress={() => setForm(null)} style={{ flex: 1 }} />
              <Button title="Salvar" onPress={save} style={{ flex: 1 }} />
            </View>
            {form?.reading && (
              <Button title="Excluir leitura" variant="ghost" onPress={confirmDelete} style={{ marginTop: spacing.sm }} />
            )}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  navTitle: { color: colors.text, fontSize: 16, fontWeight: '700', textTransform: 'capitalize' },
  summary: { flexDirection: 'row' },
  sumCell: { flex: 1, alignItems: 'center' },
  sumLabel: { color: colors.textMuted, fontSize: 11, marginBottom: 2 },
  sumValue: { color: colors.text, fontSize: 18, fontWeight: '700' },
  hourRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  hourLabel: { color: colors.textMuted, width: 36, fontWeight: '600' },
  bp: { color: colors.text, fontSize: 16, fontWeight: '800', flex: 1 },
  hr: { color: colors.textMuted, fontSize: 13 },
  min: { color: colors.textMuted, fontSize: 13, fontWeight: '400' },
  blank: { color: colors.border, fontSize: 16, flex: 1 },
  disclaimer: { color: colors.textMuted, fontSize: 12, marginBottom: spacing.lg, lineHeight: 17 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: spacing.md,
  },
  modal: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalTitle: { color: colors.text, fontSize: 18, fontWeight: '700', marginBottom: spacing.md },
});
