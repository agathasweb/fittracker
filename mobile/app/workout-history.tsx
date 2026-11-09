import { Ionicons } from '@expo/vector-icons';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card } from '../components/Card';
import { useAuth } from '../lib/auth';
import { deleteSession, listSessions, SessionSummary } from '../lib/repos/workoutSessions';
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

  function excluir(s: SessionSummary) {
    Alert.alert('Excluir treino', `Apagar "${s.name}" de ${s.performed_at.slice(8, 10)}/${s.performed_at.slice(5, 7)} com todas as séries anotadas?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          await deleteSession(s.id);
          await load();
        },
      },
    ]);
  }

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
            <Text style={styles.empty}>Nenhum treino concluído ainda. Os treinos aparecem aqui depois de tocar em Concluir.</Text>
          </Card>
        ) : (
          sessions.map((s) => (
            <Card key={s.id}>
                <View style={styles.row}>
                  <Pressable style={{ flex: 1 }} onPress={() => router.push(`/workout-session/${s.id}`)}>
                    <Text style={styles.name}>{s.name}</Text>
                    <Text style={styles.meta}>
                      {s.performed_at.slice(0, 10)} · {s.done_sets}/{s.total_sets} séries · {Math.round(s.total_load)} kg de volume
                    </Text>
                  </Pressable>
                  <Pressable onPress={() => router.push(`/workout-session/${s.id}`)} hitSlop={8} style={styles.icon}>
                    <Ionicons name="create-outline" size={19} color={colors.textMuted} />
                  </Pressable>
                  <Pressable onPress={() => excluir(s)} hitSlop={8} style={styles.icon}>
                    <Ionicons name="trash-outline" size={19} color={colors.danger} />
                  </Pressable>
                </View>
            </Card>
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
  icon: { padding: 6, marginLeft: 4 },
  empty: { color: colors.textMuted, fontSize: 13 },
});
