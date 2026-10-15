import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card } from '../components/Card';
import { useAuth } from '../lib/auth';
import { flagColor, formatNumber, formatResultValue } from '../lib/examFormat';
import { isoDateToBR } from '../lib/format';
import { useRequireAuth } from '../lib/guards';
import { listMarkers, MarkerSummary } from '../lib/repos/exams';
import { colors, spacing } from '../lib/theme';

/**
 * Evolução: cada marcador com todas as medições (mais recente em cima) e a variação
 * contra a medição anterior. Útil quando os exames forem repetidos.
 */
export default function ExamMarkersScreen() {
  const auth = useAuth();
  useRequireAuth();
  const router = useRouter();
  const userId = auth.status === 'authed' ? auth.user.id : null;
  const [markers, setMarkers] = useState<MarkerSummary[]>([]);
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    setMarkers(await listMarkers(userId));
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (!userId) return null;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: spacing.md }}>
      {markers.length === 0 && (
        <Card>
          <Text style={styles.muted}>Nenhum valor cadastrado ainda.</Text>
        </Card>
      )}
      {markers.map((m) => {
        const last = m.points[m.points.length - 1];
        const prev = m.points.length > 1 ? m.points[m.points.length - 2] : null;
        const delta = last.value != null && prev?.value != null ? last.value - prev.value : null;
        const expanded = open === m.marker;
        return (
          <Card key={m.marker}>
            <Pressable onPress={() => setOpen(expanded ? null : m.marker)} style={styles.head}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{m.marker}</Text>
                <Text style={styles.muted}>
                  {m.points.length} medição(ões) · última em {isoDateToBR(last.exam_date)}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.value, { color: flagColor(last.flag) }]}>{formatResultValue(last)}</Text>
                {delta != null && delta !== 0 && (
                  <Text style={styles.delta}>
                    {delta > 0 ? '▲' : '▼'} {formatNumber(Math.abs(Math.round(delta * 10) / 10))}
                  </Text>
                )}
              </View>
            </Pressable>
            {expanded &&
              [...m.points].reverse().map((p, i) => (
                <Pressable key={`${p.exam_id}-${i}`} style={styles.point} onPress={() => router.push(`/exam/${p.exam_id}`)}>
                  <Text style={styles.pointDate}>{isoDateToBR(p.exam_date)}</Text>
                  <Text style={[styles.pointValue, { color: flagColor(p.flag) }]}>{formatResultValue(p)}</Text>
                  <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
                </Pressable>
              ))}
          </Card>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  muted: { color: colors.textMuted, fontSize: 12 },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  name: { color: colors.text, fontWeight: '700', fontSize: 15 },
  value: { fontSize: 16, fontWeight: '800' },
  delta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  point: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    marginTop: 4,
  },
  pointDate: { color: colors.textMuted, width: 90 },
  pointValue: { flex: 1, fontWeight: '700' },
});
