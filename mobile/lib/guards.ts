import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { useAuth, AuthState } from './auth';

export function useRequireAuth(): AuthState & { reload: () => Promise<void> } {
  const auth = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (auth.status === 'guest') {
      router.replace('/auth/register');
    }
  }, [auth.status, router]);
  return auth;
}

export function useRedirectIfAuthed(): AuthState & { reload: () => Promise<void> } {
  const auth = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (auth.status === 'authed') {
      router.replace('/(tabs)');
    }
  }, [auth.status, router]);
  return auth;
}
