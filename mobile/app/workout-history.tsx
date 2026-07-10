import { Ionicons } from '@expo/vector-icons';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card } from '../components/Card';
import { useAuth } from '../lib/auth';
import { listSessions, SessionSummary } from '../lib/repos/workoutSessions';
import { colors, spacing } from '../lib/theme';

export default function WorkoutHistoryScreen() {
  const auth = useAuth();
  const router = useRouter();
  const userId = auth.status === 'authed' ? auth.user.id : null;
  const [sessions, setSessions] = useState<SessionSummary[]>([]);

  const load = useCallback(async () => {
    if (!userId) return;
    setSessions(await listSessions(userId, 100));
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ title: 'Histórico de treinos' }} />
      <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 60 }}>
        {sessions.length === 0 ? (
          <Card>
            <Text style={styles.empty}>Nenhuma sessão registrada ainda.</Text>
          </Card>
        ) : (
          sessions.map((s) => (
            <Pressable key={s.id} onPress={() => router.push(`/workout-session/${s.id}`)}>
              <Card>
                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{s.name}</Text>
                    <Text style={styles.meta}>
                      {s.performed_at.slice(0, 10)} · {s.done_sets}/{s.total_sets} séries · {Math.round(s.total_load)} kg de volume
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </View>
              </Card>
            </Pressable>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  name: { color: colors.text, fontSize: 15, fontWeight: '600' },
  meta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  empty: { color: colors.textMuted, fontSize: 13 },
});
