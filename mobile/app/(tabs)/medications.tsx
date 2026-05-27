import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Input } from '../../components/Input';
import { useAuth } from '../../lib/auth';
import { formatTime } from '../../lib/format';
import { rescheduleMedicationReminders } from '../../lib/notifications';
import {
  createMedication,
  deleteIntake,
  deleteMedication,
  listIntakesOfDay,
  listMedications,
  MedicationWithToday,
  parseNotificationIds,
  parseReminderTimes,
  recordIntake,
  updateMedication,
} from '../../lib/repos/medications';
import { colors, radius, spacing } from '../../lib/theme';
import { Medication, MedicationIntake } from '../../lib/types';
import { todayISO } from '../../lib/format';

const COLORS = ['#A3E635', '#60A5FA', '#F472B6', '#FBBF24', '#34D399', '#A78BFA'];

export default function MedicationsScreen() {
  const auth = useAuth();
  const userId = auth.status === 'authed' ? auth.user.id : null;

  const [meds, setMeds] = useState<MedicationWithToday[]>([]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Medication | null>(null);
  const [historyMed, setHistoryMed] = useState<MedicationWithToday | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    setMeds(await listMedications(userId));
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (!userId) return null;

  async function takeNow(m: MedicationWithToday) {
    await recordIntake(m.id);
    await load();
  }

  function confirmRemove(m: MedicationWithToday) {
    Alert.alert(
      'Excluir suplemento',
      `Remover "${m.name}" e todo o histórico? Lembretes agendados também serão cancelados.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            const ids = parseNotificationIds(m.notification_ids);
            if (ids.length) {
              const { cancelNotifications } = await import('../../lib/notifications');
              await cancelNotifications(ids);
            }
            await deleteMedication(m.id);
            await load();
          },
        },
      ]
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: spacing.md, paddingBottom: 100 }}
      >
        {meds.length === 0 ? (
          <Card>
            <View style={{ alignItems: 'center', paddingVertical: spacing.md }}>
              <Ionicons name="medkit-outline" size={48} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>Nenhum suplemento cadastrado</Text>
              <Text style={styles.emptySub}>
                Cadastre seus suplementos e medicamentos de uso contínuo pra registrar tomadas e
                (opcional) receber lembretes.
              </Text>
            </View>
          </Card>
        ) : (
          meds.map((m) => {
            const reminders = parseReminderTimes(m.reminder_times);
            return (
              <Card key={m.id}>
                <View style={styles.medHeader}>
                  <View style={[styles.dot, { backgroundColor: m.color || colors.primary }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.medName}>{m.name}</Text>
                    {m.dosage && <Text style={styles.medDosage}>{m.dosage}</Text>}
                  </View>
                  <Pressable
                    onPress={() => {
                      setEditing(m);
                      setEditorOpen(true);
                    }}
                    style={styles.iconBtn}
                    hitSlop={8}
                  >
                    <Ionicons name="create-outline" size={20} color={colors.textMuted} />
                  </Pressable>
                  <Pressable
                    onPress={() => confirmRemove(m)}
                    style={styles.iconBtn}
                    hitSlop={8}
                  >
                    <Ionicons name="trash-outline" size={20} color={colors.danger} />
                  </Pressable>
                </View>

                <View style={styles.statsRow}>
                  <View style={styles.stat}>
                    <Text style={styles.statLabel}>Hoje</Text>
                    <Text style={styles.statValue}>
                      {m.today_count}{' '}
                      <Text style={styles.statUnit}>tomada{m.today_count === 1 ? '' : 's'}</Text>
                    </Text>
                  </View>
                  <View style={styles.stat}>
                    <Text style={styles.statLabel}>Última</Text>
                    <Text style={styles.statValue}>
                      {m.last_taken_at ? formatTime(m.last_taken_at) : '—'}
                    </Text>
                  </View>
                  <View style={styles.stat}>
                    <Text style={styles.statLabel}>Lembretes</Text>
                    <Text style={styles.statValue}>
                      {reminders.length || '—'}
                    </Text>
                  </View>
                </View>

                {reminders.length > 0 && (
                  <Text style={styles.reminderLine}>
                    🔔 {reminders.join(' · ')}
                  </Text>
                )}

                <View style={styles.actionRow}>
                  <Button
                    title="Tomei agora"
                    onPress={() => takeNow(m)}
                    style={{ flex: 1 }}
                  />
                  <Pressable
                    onPress={() => setHistoryMed(m)}
                    style={styles.historyBtn}
                  >
                    <Ionicons name="time-outline" size={18} color={colors.text} />
                    <Text style={styles.historyBtnText}>Hoje</Text>
                  </Pressable>
                </View>
              </Card>
            );
          })
        )}
      </ScrollView>

      <Pressable
        style={styles.fab}
        onPress={() => {
          setEditing(null);
          setEditorOpen(true);
        }}
      >
        <Ionicons name="add" size={28} color={colors.bg} />
      </Pressable>

      <MedicationEditor
        visible={editorOpen}
        userId={userId}
        editing={editing}
        onClose={() => setEditorOpen(false)}
        onSaved={async () => {
          setEditorOpen(false);
          await load();
        }}
      />

      <IntakesHistoryModal
        med={historyMed}
        onClose={() => setHistoryMed(null)}
        onChanged={load}
      />
    </View>
  );
}

type EditorProps = {
  visible: boolean;
  userId: number;
  editing: Medication | null;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
};

function MedicationEditor({ visible, userId, editing, onClose, onSaved }: EditorProps) {
  const [name, setName] = useState(editing?.name ?? '');
  const [dosage, setDosage] = useState(editing?.dosage ?? '');
  const [notes, setNotes] = useState(editing?.notes ?? '');
  const [color, setColor] = useState(editing?.color ?? COLORS[0]);
  const [reminders, setReminders] = useState<string[]>(parseReminderTimes(editing?.reminder_times ?? null));
  const [newTime, setNewTime] = useState('');
  const [saving, setSaving] = useState(false);

  // resetar quando abrir
  const resetFromEditing = useCallback(() => {
    setName(editing?.name ?? '');
    setDosage(editing?.dosage ?? '');
    setNotes(editing?.notes ?? '');
    setColor(editing?.color ?? COLORS[0]);
    setReminders(parseReminderTimes(editing?.reminder_times ?? null));
    setNewTime('');
  }, [editing]);

  // reage à abertura
  const [lastVisible, setLastVisible] = useState(false);
  if (visible !== lastVisible) {
    if (visible) resetFromEditing();
    setLastVisible(visible);
  }

  function addReminder() {
    const t = newTime.trim();
    if (!/^\d{1,2}:\d{2}$/.test(t)) {
      Alert.alert('Horário inválido', 'Use o formato HH:mm (ex.: 08:00).');
      return;
    }
    const [hh, mm] = t.split(':').map((n) => Number(n));
    if (hh < 0 || hh > 23 || mm < 0 || mm > 59) {
      Alert.alert('Horário inválido', 'Hora 0-23, minuto 0-59.');
      return;
    }
    const norm = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    if (reminders.includes(norm)) return;
    setReminders([...reminders, norm].sort());
    setNewTime('');
  }

  function removeReminder(t: string) {
    setReminders(reminders.filter((x) => x !== t));
  }

  async function save() {
    if (!name.trim()) {
      Alert.alert('Informe o nome do suplemento.');
      return;
    }
    setSaving(true);
    try {
      const oldIds = editing ? parseNotificationIds(editing.notification_ids) : [];
      const notificationIds = await rescheduleMedicationReminders(
        oldIds,
        name,
        dosage.trim() || null,
        reminders
      );
      if (editing) {
        await updateMedication(editing.id, {
          name,
          dosage: dosage.trim() || null,
          notes: notes.trim() || null,
          color,
          reminder_times: reminders,
          notification_ids: notificationIds,
        });
      } else {
        await createMedication({
          user_id: userId,
          name,
          dosage: dosage.trim() || null,
          notes: notes.trim() || null,
          color,
          reminder_times: reminders,
          notification_ids: notificationIds,
        });
      }
      await onSaved();
    } catch (e: any) {
      Alert.alert('Erro', e?.message ?? 'Falha ao salvar.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalBackdrop}
      >
        <View style={styles.modal}>
          <Text style={styles.modalTitle}>
            {editing ? 'Editar suplemento' : 'Novo suplemento'}
          </Text>
          <ScrollView style={{ maxHeight: 480 }}>
            <Input
              label="Nome"
              value={name}
              onChangeText={setName}
              placeholder='Ex.: "Whey protein" ou "Losartana"'
            />
            <Input
              label="Dosagem (opcional)"
              value={dosage}
              onChangeText={setDosage}
              placeholder='Ex.: "30 g" ou "50 mg"'
            />
            <Input
              label="Observações (opcional)"
              value={notes}
              onChangeText={setNotes}
              placeholder="Em jejum, com água..."
              multiline
              numberOfLines={2}
              textAlignVertical="top"
            />

            <Text style={styles.fieldLabel}>Cor</Text>
            <View style={styles.colorRow}>
              {COLORS.map((c) => (
                <Pressable
                  key={c}
                  onPress={() => setColor(c)}
                  style={[
                    styles.colorSwatch,
                    { backgroundColor: c },
                    color === c && styles.colorSwatchActive,
                  ]}
                />
              ))}
            </View>

            <Text style={styles.fieldLabel}>Lembretes (opcional)</Text>
            <Text style={styles.helperText}>
              Horários pra notificação diária. Deixe vazio se não quiser lembrete.
            </Text>
            <View style={styles.timesRow}>
              {reminders.map((t) => (
                <Pressable
                  key={t}
                  onPress={() => removeReminder(t)}
                  style={styles.timeChip}
                >
                  <Text style={styles.timeChipText}>{t}</Text>
                  <Ionicons name="close" size={14} color={colors.bg} />
                </Pressable>
              ))}
            </View>
            <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-end' }}>
              <View style={{ flex: 1 }}>
                <Input
                  label="Adicionar horário"
                  value={newTime}
                  onChangeText={setNewTime}
                  placeholder="08:00"
                  keyboardType="numbers-and-punctuation"
                  maxLength={5}
                />
              </View>
              <Button
                title="Adicionar"
                variant="secondary"
                onPress={addReminder}
                style={{ marginBottom: spacing.md }}
              />
            </View>
          </ScrollView>
          <View style={styles.modalBtns}>
            <Button title="Cancelar" variant="secondary" onPress={onClose} style={{ flex: 1 }} />
            <Button title="Salvar" onPress={save} loading={saving} style={{ flex: 1 }} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

type HistoryProps = {
  med: MedicationWithToday | null;
  onClose: () => void;
  onChanged: () => void | Promise<void>;
};

function IntakesHistoryModal({ med, onClose, onChanged }: HistoryProps) {
  const [intakes, setIntakes] = useState<MedicationIntake[]>([]);

  const load = useCallback(async () => {
    if (!med) return;
    setIntakes(await listIntakesOfDay(med.id, todayISO()));
  }, [med]);

  // load on open
  const currentMedId = med?.id ?? null;
  const [lastMedId, setLastMedId] = useState<number | null>(null);
  if (currentMedId !== lastMedId) {
    setLastMedId(currentMedId);
    if (med) load();
  }

  async function remove(id: number) {
    await deleteIntake(id);
    await load();
    await onChanged();
  }

  if (!med) return null;

  return (
    <Modal visible={!!med} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modal}>
          <Text style={styles.modalTitle}>Tomadas de hoje</Text>
          <Text style={styles.modalSub}>{med.name}</Text>
          <ScrollView style={{ maxHeight: 360 }}>
            {intakes.length === 0 ? (
              <Text style={styles.emptySub}>Nenhuma tomada registrada hoje.</Text>
            ) : (
              intakes.map((i) => (
                <View key={i.id} style={styles.intakeRow}>
                  <Text style={styles.intakeTime}>{formatTime(i.taken_at)}</Text>
                  <Pressable onPress={() => remove(i.id)} hitSlop={8}>
                    <Ionicons name="trash-outline" size={18} color={colors.danger} />
                  </Pressable>
                </View>
              ))
            )}
          </ScrollView>
          <Button title="Fechar" variant="secondary" onPress={onClose} style={{ marginTop: spacing.md }} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  emptyTitle: { color: colors.text, fontSize: 16, fontWeight: '700', marginTop: spacing.sm },
  emptySub: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xs, paddingHorizontal: spacing.md },
  medHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dot: { width: 12, height: 12, borderRadius: 6 },
  medName: { color: colors.text, fontSize: 16, fontWeight: '700' },
  medDosage: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  iconBtn: { padding: spacing.xs },
  statsRow: {
    flexDirection: 'row',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  stat: { flex: 1, alignItems: 'flex-start' },
  statLabel: {
    color: colors.textMuted,
    fontSize: 11,
    letterSpacing: 1,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  statValue: { color: colors.text, fontSize: 17, fontWeight: '700', marginTop: 2 },
  statUnit: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  reminderLine: {
    color: colors.textMuted,
    fontSize: 12,
    marginBottom: spacing.sm,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  historyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  historyBtnText: { color: colors.text, fontWeight: '600', fontSize: 13 },
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
  modalSub: { color: colors.textMuted, fontSize: 12, marginTop: 2, marginBottom: spacing.md },
  modalBtns: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  fieldLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  helperText: { color: colors.textMuted, fontSize: 12, marginBottom: spacing.sm, lineHeight: 16 },
  colorRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  colorSwatch: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorSwatchActive: { borderColor: colors.text },
  timesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.sm },
  timeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary,
    paddingVertical: 4,
    paddingHorizontal: spacing.sm + 2,
    borderRadius: radius.pill,
  },
  timeChipText: { color: colors.bg, fontWeight: '700', fontSize: 13 },
  intakeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.xs,
  },
  intakeTime: { color: colors.text, fontWeight: '600' },
});
