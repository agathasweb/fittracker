import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius } from '../../lib/theme';

type Exercise = { name: string; sets: string };
type Workout = {
  id: string;
  name: string;
  day: string;
  duration: number;
  kcal: number;
  exercises: Exercise[];
  done: boolean;
};

const WORKOUTS: Workout[] = [
  {
    id: '1',
    name: 'Push A',
    day: 'Hoje',
    duration: 55,
    kcal: 320,
    done: false,
    exercises: [
      { name: 'Supino reto', sets: '4×8 — 70kg' },
      { name: 'Desenvolvimento militar', sets: '3×10 — 30kg' },
      { name: 'Tríceps testa', sets: '3×12 — 25kg' },
      { name: 'Elevação lateral', sets: '4×15 — 8kg' },
    ],
  },
  {
    id: '2',
    name: 'Pull A',
    day: 'Amanhã',
    duration: 60,
    kcal: 340,
    done: false,
    exercises: [
      { name: 'Barra fixa', sets: '4×6 — peso corporal' },
      { name: 'Remada curvada', sets: '4×10 — 60kg' },
      { name: 'Rosca direta', sets: '3×12 — 14kg' },
    ],
  },
];

export default function WorkoutsScreen() {
  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {WORKOUTS.map((w) => (
          <View key={w.id} style={styles.card}>
            <View style={styles.head}>
              <View>
                <Text style={styles.day}>{w.day.toUpperCase()}</Text>
                <Text style={styles.name}>{w.name}</Text>
              </View>
              <TouchableOpacity style={styles.startBtn}>
                <Ionicons name="play" size={18} color={colors.bg} />
                <Text style={styles.startText}>Iniciar</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.metaRow}>
              <Meta icon="time-outline" text={`${w.duration} min`} />
              <Meta icon="flame-outline" text={`${w.kcal} kcal`} />
              <Meta icon="barbell-outline" text={`${w.exercises.length} exercícios`} />
            </View>

            <View style={styles.exerciseList}>
              {w.exercises.map((ex, i) => (
                <View key={i} style={styles.exerciseRow}>
                  <Text style={styles.exerciseName}>{ex.name}</Text>
                  <Text style={styles.exerciseSets}>{ex.sets}</Text>
                </View>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>

      <TouchableOpacity style={styles.fab}>
        <Ionicons name="add" size={28} color={colors.bg} />
      </TouchableOpacity>
    </View>
  );
}

function Meta({ icon, text }: { icon: any; text: string }) {
  return (
    <View style={styles.meta}>
      <Ionicons name={icon} size={14} color={colors.textMuted} />
      <Text style={styles.metaText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.md },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  day: { color: colors.textMuted, fontSize: 11, letterSpacing: 1.5, fontWeight: '600' },
  name: { color: colors.text, fontSize: 22, fontWeight: '800', marginTop: 2 },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.pill,
  },
  startText: { color: colors.bg, fontWeight: '700' },
  metaRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { color: colors.textMuted, fontSize: 12 },
  exerciseList: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm },
  exerciseRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  exerciseName: { color: colors.text },
  exerciseSets: { color: colors.textMuted },
  fab: {
    position: 'absolute',
    bottom: spacing.lg,
    right: spacing.lg,
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
  },
});
