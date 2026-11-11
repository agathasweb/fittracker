import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { UpdateBanner } from '../../components/UpdateBanner';
import { colors } from '../../lib/theme';
import { useRequireAuth } from '../../lib/guards';
import { registerForPushNotificationsAsync } from '../../lib/push';
import { syncMedicationAlarms } from '../../lib/alarms';
import { disconnectWatch } from '../../lib/watch';
import { ProfileSwitcher } from '../../components/ProfileSwitcher';
import { getOwnerUserId } from '../../lib/auth';
import { getUserById } from '../../lib/repos/users';

export default function TabsLayout() {
  const auth = useRequireAuth();
  // Barra de gestos/botões do Android e home indicator do iPhone ficam abaixo das abas.
  const { bottom } = useSafeAreaInsets();

  // Registra o device pra push remoto e reporta a instalação ao painel assim
  // que o usuário está autenticado. Idempotente e silencioso em falha.
  const authedUser = auth.status === 'authed' ? auth.user : null;
  useEffect(() => {
    if (!authedUser) return;
    (async () => {
      // O aparelho pertence à conta logada (o dono), não ao perfil que está ativo:
      // trocar pro perfil da Julia não pode re-registrar o celular no nome dela.
      const ownerId = (await getOwnerUserId()) ?? authedUser.id;
      const owner = ownerId === authedUser.id ? authedUser : (await getUserById(ownerId)) ?? authedUser;
      registerForPushNotificationsAsync({
        userName: owner.name,
        userEmail: owner.email,
      });
      // Migra lembretes antigos pro alarme nativo e reagenda os de TODOS os perfis (idempotente).
      syncMedicationAlarms(authedUser.id).catch(() => {});
      // Relógio removido do app: garante que a sync/mensagens nativas fiquem desligadas.
      disconnectWatch(owner.id);
    })().catch(() => {});
  }, [authedUser?.id]);

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
            height: 64 + bottom,
            paddingBottom: 10 + bottom,
            paddingTop: 6,
          },
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
          // O SafeAreaView acima já recua o topo; sem isto o header somava a barra de status de novo.
          headerStatusBarHeight: 0,
          headerRight: () => <ProfileSwitcher current={auth.user} />,
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
            // Desativada (out/2026): balanço calórico aposentado em favor da Meta
            // Proteica. Tela e dados preservados — pra reativar, remova o href.
            href: null,
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
