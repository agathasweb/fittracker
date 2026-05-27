import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
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
import * as deepseek from '../lib/ai/deepseek';
import { createActivity } from '../lib/repos/activities';
import { colors, radius, spacing } from '../lib/theme';
import { User } from '../lib/types';
import { Button } from './Button';
import { Input } from './Input';

type Props = {
  visible: boolean;
  user: User;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
};

const PRESETS: { name: string; icon: keyof typeof Ionicons.glyphMap; hasDistance: boolean }[] = [
  { name: 'Caminhada', icon: 'walk-outline', hasDistance: true },
  { name: 'Corrida', icon: 'walk-outline', hasDistance: true },
  { name: 'Pedalada', icon: 'bicycle-outline', hasDistance: true },
  { name: 'Natação', icon: 'water-outline', hasDistance: true },
  { name: 'Musculação', icon: 'barbell-outline', hasDistance: false },
  { name: 'Funcional', icon: 'fitness-outline', hasDistance: false },
];

export function ActivityEditorModal({ visible, user, onClose, onSaved }: Props) {
  const [name, setName] = useState('');
  const [presetIdx, setPresetIdx] = useState<number | null>(null);
  const [duration, setDuration] = useState('');
  const [distance, setDistance] = useState('');
  const [kcal, setKcal] = useState('');
  const [notes, setNotes] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!visible) return;
    setName('');
    setPresetIdx(null);
    setDuration('');
    setDistance('');
    setKcal('');
    setNotes('');
    setErrors({});
  }, [visible]);

  function pickPreset(idx: number) {
    setPresetIdx(idx);
    setName(PRESETS[idx].name);
    if (!PRESETS[idx].hasDistance) setDistance('');
  }

  const showDistance = presetIdx === null || PRESETS[presetIdx].hasDistance;

  async function calcWithAI() {
    const dur = Number(duration.replace(',', '.'));
    if (!name.trim()) {
      Alert.alert('Informe a atividade', 'Escolha um preset ou digite o nome da atividade.');
      return;
    }
    if (!dur || dur <= 0) {
      Alert.alert('Informe a duração', 'A duração em minutos é necessária pra estimar o gasto.');
      return;
    }
    const dist = Number(distance.replace(',', '.'));
    const distVal = showDistance && dist > 0 ? dist : null;

    setAiLoading(true);
    try {
      const estimated = await deepseek.estimateActivityCalories(
        user,
        name.trim(),
        dur,
        distVal
      );
      setKcal(String(estimated));
    } catch (e: any) {
      if (e?.code === 'NO_KEY') {
        Alert.alert(
          'Chave DeepSeek não cadastrada',
          'Vá em Perfil → Integrações pra cadastrar.'
        );
      } else {
        Alert.alert('IA', e?.message ?? 'Erro ao consultar a IA.');
      }
    } finally {
      setAiLoading(false);
    }
  }

  async function save() {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Informe a atividade';
    const dur = Number(duration.replace(',', '.'));
    if (!dur || dur <= 0) e.duration = 'Duração em minutos, > 0';
    const k = Number(kcal.replace(',', '.'));
    if (!Number.isFinite(k) || k < 0) e.kcal = 'Informe ou calcule as calorias';
    setErrors(e);
    if (Object.keys(e).length) return;

    const dist = Number(distance.replace(',', '.'));
    setSaving(true);
    try {
      await createActivity({
        user_id: user.id,
        name,
        duration_min: dur,
        distance_km: showDistance && dist > 0 ? dist : null,
        kcal: k,
        notes: notes.trim() || null,
      });
      await onSaved();
    } catch (err: any) {
      Alert.alert('Erro', err?.message ?? 'Falha ao salvar atividade.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.backdrop}
      >
        <View style={styles.modal}>
          <Text style={styles.title}>Nova atividade</Text>
          <ScrollView style={{ maxHeight: 520 }}>
            <Text style={styles.fieldLabel}>Tipo</Text>
            <View style={styles.presetGrid}>
              {PRESETS.map((p, idx) => {
                const active = presetIdx === idx;
                return (
                  <Pressable
                    key={p.name}
                    onPress={() => pickPreset(idx)}
                    style={[styles.preset, active && styles.presetActive]}
                  >
                    <Ionicons
                      name={p.icon}
                      size={20}
                      color={active ? colors.bg : colors.text}
                    />
                    <Text
                      style={[styles.presetText, active && styles.presetTextActive]}
                    >
                      {p.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Input
              label="Nome da atividade"
              value={name}
              onChangeText={(v) => {
                setName(v);
                setPresetIdx(null);
              }}
              error={errors.name}
              placeholder='Ex: "Caminhada"'
            />

            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <View style={{ flex: 1 }}>
                <Input
                  label="Duração (min)"
                  value={duration}
                  onChangeText={setDuration}
                  keyboardType="numeric"
                  error={errors.duration}
                  placeholder="30"
                />
              </View>
              {showDistance && (
                <View style={{ flex: 1 }}>
                  <Input
                    label="Distância (km)"
                    value={distance}
                    onChangeText={setDistance}
                    keyboardType="numeric"
                    placeholder="opcional"
                  />
                </View>
              )}
            </View>

            <Button
              title={aiLoading ? 'Calculando…' : 'Calcular calorias com IA'}
              onPress={calcWithAI}
              loading={aiLoading}
              variant="secondary"
              style={{ marginBottom: spacing.md }}
            />

            <Input
              label="Calorias queimadas (kcal)"
              value={kcal}
              onChangeText={setKcal}
              keyboardType="numeric"
              error={errors.kcal}
              placeholder="180"
            />

            <Input
              label="Observações (opcional)"
              value={notes}
              onChangeText={setNotes}
              placeholder='"Esteira inclinação 5"'
              multiline
              numberOfLines={2}
              textAlignVertical="top"
            />
          </ScrollView>
          <View style={styles.btns}>
            <Button title="Cancelar" variant="secondary" onPress={onClose} style={{ flex: 1 }} />
            <Button title="Salvar" onPress={save} loading={saving} style={{ flex: 1 }} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
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
  title: { color: colors.text, fontSize: 18, fontWeight: '700', marginBottom: spacing.md },
  fieldLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  presetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  preset: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  presetActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  presetText: { color: colors.text, fontWeight: '600', fontSize: 13 },
  presetTextActive: { color: colors.bg },
  btns: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
});
