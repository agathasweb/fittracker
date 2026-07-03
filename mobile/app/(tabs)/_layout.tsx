import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { UpdateBanner } from '../../components/UpdateBanner';
import { colors } from '../../lib/theme';
import { useRequireAuth } from '../../lib/guards';
import { registerForPushNotificationsAsync } from '../../lib/push';

export default function TabsLayout() {
  const auth = useRequireAuth();

  // Registra o device pra push remoto assim que o usuário está autenticado.
  // Idempotente e silencioso em falha (web / Expo Go / permissão negada).
  useEffect(() => {
    if (auth.status === 'authed') {
      registerForPushNotificationsAsync();
    }
  }, [auth.status]);

  if (auth.status !== 'authed') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <UpdateBanner />
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
            height: 64,
            paddingBottom: 10,
            paddingTop: 6,
          },
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Hoje',
            tabBarIcon: ({ color, size }) => <Ionicons name="flame" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="meals"
          options={{
            title: 'Refeições',
            tabBarIcon: ({ color, size }) => <Ionicons name="restaurant" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="workouts"
          options={{
            title: 'Treinos',
            tabBarIcon: ({ color, size }) => <Ionicons name="barbell" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="medications"
          options={{
            title: 'Suplementos',
            tabBarIcon: ({ color, size }) => <Ionicons name="medkit" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="progress"
          options={{
            title: 'Progresso',
            tabBarIcon: ({ color, size }) => <Ionicons name="trending-up" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Perfil',
            tabBarIcon: ({ color, size }) => <Ionicons name="person-circle" size={size} color={color} />,
          }}
        />
      </Tabs>
    </SafeAreaView>
  );
}
