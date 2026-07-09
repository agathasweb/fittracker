import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { useAuth, AuthState } from './auth';

/**
 * Telas internas só rodam com `authed`. Qualquer outro estado (guest, blocked,
 * needs_reconnect, needs_profile) volta pra raiz, que é quem sabe rotear cada um.
 * Concentrar a decisão em `app/index.tsx` evita que uma tela nova esqueça de
 * tratar o bloqueio e vire uma porta dos fundos.
 */
export function useRequireAuth(): AuthState & { reload: () => Promise<void> } {
  const auth = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (auth.status !== 'loading' && auth.status !== 'authed') {
      router.replace('/');
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
