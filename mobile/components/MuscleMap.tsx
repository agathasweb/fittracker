import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Body, { ExtendedBodyPart } from 'react-native-body-highlighter';
import { useAuth } from '../lib/auth';
import { MUSCLE_LABEL, MuscleTargets, musclesFor } from '../lib/muscles';
import { useSheetBottomPadding } from '../lib/safeArea';
import { colors, radius, spacing } from '../lib/theme';
import { Button } from './Button';

// intensity 1 = secundário, 2 = principal.
const MUSCLE_COLORS = [colors.primaryDark, colors.primary];
const BODY_FILL = '#3B4658';

function toData(t: MuscleTargets): ExtendedBodyPart[] {
  return [
    ...t.secondary.filter((s) => !t.primary.includes(s)).map((slug) => ({ slug, intensity: 1 })),
    ...t.primary.map((slug) => ({ slug, intensity: 2 })),
  ] as ExtendedBodyPart[];
}

/** Silhueta de frente e de costas com os músculos do exercício pintados. */
export function MuscleMap({ exerciseName, scale = 0.7 }: { exerciseName: string; scale?: number }) {
  const auth = useAuth();
  const gender = auth.status === 'authed' && auth.user.sex === 'F' ? 'female' : 'male';
  const t = musclesFor(exerciseName);
  if (!t) {
    return (
      <Text style={styles.unknown}>
        Ainda não sei quais músculos esse exercício trabalha. Usar um nome comum (ex.: "Supino",
        "Remada", "Cadeira extensora") ajuda a reconhecer.
      </Text>
    );
  }
  const data = toData(t);
  const common = {
    data,
    gender: gender as 'male' | 'female',
    scale,
    colors: MUSCLE_COLORS,
    defaultFill: BODY_FILL,
    border: 'none',
  };
  return (
    <View>
      <View style={styles.bodies}>
        <View style={styles.bodyCol}>
          <Body {...common} side="front" />
          <Text style={styles.sideLabel}>Frente</Text>
        </View>
        <View style={styles.bodyCol}>
          <Body {...common} side="back" />
          <Text style={styles.sideLabel}>Costas</Text>
        </View>
      </View>
      <View style={styles.legend}>
        <View style={styles.legendRow}>
          <View style={[styles.swatch, { backgroundColor: colors.primary }]} />
          <Text style={styles.legendText}>
            <Text style={styles.legendStrong}>Principal: </Text>
            {t.primary.map((s) => MUSCLE_LABEL[s]).join(', ')}
          </Text>
        </View>
        {t.secondary.length > 0 && (
          <View style={styles.legendRow}>
            <View style={[styles.swatch, { backgroundColor: colors.primaryDark }]} />
            <Text style={styles.legendText}>
              <Text style={styles.legendStrong}>Auxiliar: </Text>
              {t.secondary.map((s) => MUSCLE_LABEL[s]).join(', ')}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

/** Botão "Músculos" que abre a silhueta numa janela. Some se o nome estiver vazio. */
export function MuscleButton({ exerciseName }: { exerciseName: string }) {
  const [open, setOpen] = useState(false);
  const sheetBottom = useSheetBottomPadding();
  if (!exerciseName.trim()) return null;
  const known = musclesFor(exerciseName) != null;
  return (
    <>
      <Pressable onPress={() => setOpen(true)} hitSlop={8} style={styles.btn}>
        <Ionicons name="body-outline" size={16} color={known ? colors.primary : colors.textMuted} />
        <Text style={[styles.btnText, !known && { color: colors.textMuted }]}>Músculos</Text>
      </Pressable>
      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop}>
          <View style={[styles.sheet, { paddingBottom: sheetBottom }]}>
            <Text style={styles.title}>{exerciseName}</Text>
            <MuscleMap exerciseName={exerciseName} />
            <Button title="Fechar" variant="secondary" onPress={() => setOpen(false)} style={{ marginTop: spacing.md }} />
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  bodies: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm },
  bodyCol: { alignItems: 'center' },
  sideLabel: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  legend: { marginTop: spacing.md, gap: 6 },
  legendRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  swatch: { width: 12, height: 12, borderRadius: 3, marginTop: 3 },
  legendText: { color: colors.text, fontSize: 14, flex: 1 },
  legendStrong: { fontWeight: '700' },
  unknown: { color: colors.textMuted, fontSize: 14, textAlign: 'center', paddingVertical: spacing.md },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  btnText: { color: colors.primary, fontSize: 12, fontWeight: '600' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
  },
  title: { color: colors.text, fontSize: 18, fontWeight: '700', marginBottom: spacing.md, textAlign: 'center' },
});
