import { Ionicons } from '@expo/vector-icons';
import { addDays, format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
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
} from '../lib/repos/bloodPressure';
import { colors, radius, spacing } from '../lib/theme';
import { BloodPressureReading } from '../lib/types';
import {
  getWatch,
  lastWatchSync,
  listWatchCandidates,
  setWatch,
  syncWatchNow,
  watchAvailable,
  WatchDevice,
} from '../lib/watch';

const HOURS = Array.from({ length: 24 }, (_, h) => h);

/** Faixas usuais de MAPA: vigília 07–22h, sono 23–06h. */
const isAwake = (h: number) => h >= 7 && h <= 22;

function avg(rs: BloodPressureReading[]): string | null {
  if (!rs.length) return null;
  const s = Math.round(rs.reduce((a, r) => a + r.systolic, 0) / rs.length);
  const d = Math.round(rs.reduce((a, r) => a + r.diastolic, 0) / rs.length);
  return `${s}/${d}`;
}

export default function BloodPressureScreen() {
  const auth = useAuth();
  useRequireAuth();
  const userId = auth.status === 'authed' ? auth.user.id : null;

  const [day, setDay] = useState(todayISO());
  const [readings, setReadings] = useState<BloodPressureReading[]>([]);
  const [watch, setWatchState] = useState<WatchDevice | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  const [pickOpen, setPickOpen] = useState(false);
  const [candidates, setCandidates] = useState<WatchDevice[]>([]);

  const [manualHour, setManualHour] = useState<number | null>(null);
  const [sys, setSys] = useState('');
  const [dia, setDia] = useState('');
  const [hr, setHr] = useState('');
  const [manualErr, setManualErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    setReadings(await listReadingsOfDay(userId, day));
    setWatchState(await getWatch());
    setLastSync(lastWatchSync());
  }, [userId, day]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (!userId) return null;

  const isToday = day === todayISO();

  async function syncNow() {
    setSyncing(true);
    try {
      const n = await syncWatchNow();
      await load();
      Alert.alert('Relógio sincronizado', n > 0 ? `${n} leitura(s) nova(s).` : 'Nenhuma leitura nova.');
    } catch (e: any) {
      Alert.alert('Não deu pra sincronizar', e?.message ?? 'Verifique se o relógio está perto e com Bluetooth.');
    } finally {
      setSyncing(false);
    }
  }

  async function openPicker() {
    try {
      setCandidates(await listWatchCandidates());
      setPickOpen(true);
    } catch (e: any) {
      Alert.alert('Bluetooth', e?.message ?? 'Falha ao listar dispositivos.');
    }
  }

  async function chooseWatch(d: WatchDevice | null) {
    await setWatch(d, userId!);
    setPickOpen(false);
    await load();
    if (d) syncNow();
  }

  function openManual(h: number) {
    setManualHour(h);
    setSys('');
    setDia('');
    setHr('');
    setManualErr(null);
  }

  async function saveManual() {
    const s = Number(sys);
    const d = Number(dia);
    const f = hr ? Number(hr) : null;
    if (!(s >= 60 && s <= 260) || !(d >= 30 && d <= 160) || d >= s) {
      setManualErr('Confira os valores (ex.: 120 / 80)');
      return;
    }
    const at = `${day} ${String(manualHour).padStart(2, '0')}:00:00`;
    await addManualReading(userId!, at, s, d, f && f > 0 ? f : null);
    setManualHour(null);
    await load();
  }

  function confirmDelete(r: BloodPressureReading) {
    Alert.alert('Apagar leitura', `${r.systolic}/${r.diastolic} às ${r.measured_at.slice(11, 16)}?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Apagar',
        style: 'destructive',
        onPress: async () => {
          await deleteReading(r.id);
          await load();
        },
      },
    ]);
  }

  // Uma linha por hora; se houver mais de uma leitura na hora, mostra a mais recente.
  const byHour = new Map<number, BloodPressureReading>();
  for (const r of readings) byHour.set(Number(r.measured_at.slice(11, 13)), r);
  const awake = readings.filter((r) => isAwake(Number(r.measured_at.slice(11, 13))));
  const asleep = readings.filter((r) => !isAwake(Number(r.measured_at.slice(11, 13))));

  return (
    <ScrollView style={{ backgroundColor: colors.bg, flex: 1 }} contentContainerStyle={{ padding: spacing.md }}>
      {watchAvailable() && (
        <Card>
          <Text style={styles.cardLabel}>RELÓGIO</Text>
          {watch ? (
            <>
              <Text style={styles.watchName}>{watch.name}</Text>
              <Text style={styles.muted}>
                Sincroniza sozinho de hora em hora
                {lastSync ? ` · última: ${format(lastSync, 'dd/MM HH:mm')}` : ''}
              </Text>
              <View style={styles.row}>
                <Button
                  title={syncing ? 'Sincronizando…' : 'Sincronizar agora'}
                  onPress={syncNow}
                  loading={syncing}
                  style={{ flex: 1 }}
                />
                <Button title="Trocar" variant="secondary" onPress={openPicker} style={{ flex: 0.6 }} />
              </View>
            </>
          ) : (
            <>
              <Text style={styles.muted}>
                Abra o Wearfit Pro com o relógio conectado e toque abaixo pra escolher o relógio.
              </Text>
              <Button title="Conectar relógio" onPress={openPicker} style={{ marginTop: spacing.sm }} />
            </>
          )}
        </Card>
      )}

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
            <Text style={styles.sumValue}>{readings.length}/24</Text>
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

      <Card>
        {HOURS.map((h) => {
          const r = byHour.get(h);
          return (
            <Pressable
              key={h}
              style={styles.hourRow}
              onPress={() => (r ? confirmDelete(r) : openManual(h))}
            >
              <Text style={styles.hourLabel}>{String(h).padStart(2, '0')}h</Text>
              {r ? (
                <>
                  <Text style={styles.bp}>
                    {r.systolic}/{r.diastolic}
                  </Text>
                  <Text style={styles.hr}>{r.heart_rate ? `FC ${r.heart_rate}` : ''}</Text>
                  <Ionicons
                    name={r.source === 'watch' ? 'watch-outline' : 'create-outline'}
                    size={16}
                    color={colors.textMuted}
                  />
                </>
              ) : (
                <Text style={styles.blank}>—</Text>
              )}
            </Pressable>
          );
        })}
      </Card>

      <Text style={styles.disclaimer}>
        A pressão do relógio é uma estimativa por sensor óptico (sem braçadeira). Serve pra ver
        tendência; não substitui o exame de MAPA nem a medição com aparelho de braço. Toque numa
        hora vazia pra lançar uma medição manual; toque numa leitura pra apagar.
      </Text>

      <Modal visible={pickOpen} animationType="slide" transparent onRequestClose={() => setPickOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Escolha o relógio</Text>
            {candidates.length === 0 ? (
              <Text style={styles.muted}>
                Nenhum dispositivo conectado. Abra o Wearfit Pro, espere o relógio conectar e tente de novo.
              </Text>
            ) : (
              candidates.map((c) => (
                <Pressable key={c.address} style={styles.devRow} onPress={() => chooseWatch(c)}>
                  <Ionicons name="watch-outline" size={20} color={colors.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.devName}>{c.name}</Text>
                    <Text style={styles.muted}>{c.address}</Text>
                  </View>
                </Pressable>
              ))
            )}
            <View style={styles.row}>
              {watch && (
                <Button title="Desconectar" variant="ghost" onPress={() => chooseWatch(null)} style={{ flex: 1 }} />
              )}
              <Button title="Fechar" variant="secondary" onPress={() => setPickOpen(false)} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={manualHour != null} animationType="fade" transparent onRequestClose={() => setManualHour(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>
              Leitura das {String(manualHour ?? 0).padStart(2, '0')}h
            </Text>
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
              error={manualErr}
            />
            <View style={styles.row}>
              <Button title="Cancelar" variant="secondary" onPress={() => setManualHour(null)} style={{ flex: 1 }} />
              <Button title="Salvar" onPress={saveManual} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>

      {syncing && <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.md }} />}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  cardLabel: { color: colors.textMuted, fontSize: 11, letterSpacing: 1.5, fontWeight: '600' },
  watchName: { color: colors.text, fontSize: 18, fontWeight: '700', marginTop: 2 },
  muted: { color: colors.textMuted, fontSize: 13 },
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
  blank: { color: colors.border, fontSize: 16, flex: 1 },
  disclaimer: { color: colors.textMuted, fontSize: 12, marginBottom: spacing.lg, lineHeight: 17 },
  devRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  devName: { color: colors.text, fontWeight: '700' },
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
