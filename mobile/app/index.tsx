import { Redirect } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Logo } from '../components/Logo';
import { useAuth } from '../lib/auth';
import { colors, spacing } from '../lib/theme';
import { checkForOTAUpdate } from '../lib/updates';

export default function Index() {
  const auth = useAuth();

  useEffect(() => {
    checkForOTAUpdate();
  }, []);

  if (auth.status === 'loading') {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.bg,
          gap: spacing.lg,
        }}
      >
        <Logo size={112} />
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (auth.status === 'authed') return <Redirect href="/(tabs)" />;
  return <Redirect href="/auth/register" />;
}
