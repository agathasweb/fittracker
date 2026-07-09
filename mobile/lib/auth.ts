import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import { apiLogin, apiLogout } from './api';
import {
  clearToken,
  getToken,
  limparEntitlement,
  marcarConfirmado,
  setToken,
  verificarEntitlement,
} from './entitlement';
import { createUser, getUserByEmail, getUserById, NewUser } from './repos/users';
import { User } from './types';

/**
 * Autenticação do app.
 *
 * A senha é validada pelo PAINEL, não mais localmente: só quem tem assinatura
 * ativa (ou cortesia) recebe token. O SQLite continua guardando os dados e o
 * PERFIL do usuário (sexo, altura, metas) — o servidor não conhece nada disso.
 *
 * Por isso quem entra pela primeira vez neste aparelho passa por duas etapas:
 * autentica no servidor e depois completa o perfil local.
 */

const SESSION_KEY = '@fittracker/current_user_id';
const PENDING_KEY = '@fittracker/pending_profile';

/**
 * A senha não vive mais no device. A coluna `password_hash` do SQLite é NOT NULL
 * e continua existindo por compatibilidade com bancos já instalados; gravamos um
 * marcador que não valida contra senha nenhuma.
 */
const SENHA_NO_SERVIDOR = 'server-authenticated';

const listeners = new Set<() => void>();
function notify() {
  listeners.forEach((cb) => cb());
}

export type PendingProfile = { email: string; name: string };

export type LoginResult =
  | { kind: 'authed' }
  | { kind: 'needs_profile'; pending: PendingProfile };

/**
 * Autentica no painel. Propaga NotEntitledError (assinatura inativa),
 * UnauthorizedError (senha errada) e NetworkError (sem rede) — a tela de
 * login trata cada um de um jeito diferente.
 */
export async function login(email: string, password: string): Promise<LoginResult> {
  const { token, user } = await apiLogin(email, password);

  await setToken(token);
  await marcarConfirmado();

  const local = await getUserByEmail(user.email);
  if (local) {
    await AsyncStorage.setItem(SESSION_KEY, String(local.id));
    notify();
    return { kind: 'authed' };
  }

  // Primeiro acesso neste aparelho: falta o perfil local.
  const pending: PendingProfile = { email: user.email, name: user.name };
  await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(pending));
  notify();
  return { kind: 'needs_profile', pending };
}

export async function getPendingProfile(): Promise<PendingProfile | null> {
  const bruto = await AsyncStorage.getItem(PENDING_KEY);
  if (!bruto) return null;
  try {
    return JSON.parse(bruto) as PendingProfile;
  } catch {
    return null;
  }
}

/** Cria o perfil local depois que o servidor já autenticou. Não pede senha. */
export async function completarPerfil(
  dados: Omit<NewUser, 'password_hash'>
): Promise<User> {
  const existente = await getUserByEmail(dados.email);
  const user =
    existente ?? (await createUser({ ...dados, password_hash: SENHA_NO_SERVIDOR }));

  await AsyncStorage.setItem(SESSION_KEY, String(user.id));
  await AsyncStorage.removeItem(PENDING_KEY);
  notify();
  return user;
}

export async function logout(): Promise<void> {
  const token = await getToken();
  if (token) await apiLogout(token); // best-effort: sem rede, o logout local acontece igual
  await clearToken();
  await limparEntitlement();
  await AsyncStorage.removeItem(SESSION_KEY);
  await AsyncStorage.removeItem(PENDING_KEY);
  notify();
}

export async function getCurrentUserId(): Promise<number | null> {
  const v = await AsyncStorage.getItem(SESSION_KEY);
  return v ? Number(v) : null;
}

export async function getCurrentUser(): Promise<User | null> {
  const id = await getCurrentUserId();
  if (!id) return null;
  return getUserById(id);
}

export type AuthState =
  | { status: 'loading' }
  | { status: 'guest' }
  | { status: 'needs_profile'; pending: PendingProfile }
  | { status: 'blocked'; message: string; checkoutUrl: string | null }
  | { status: 'needs_reconnect' }
  | { status: 'authed'; user: User; offline: boolean };

export function useAuth(): AuthState & { reload: () => Promise<void> } {
  const [state, setState] = useState<AuthState>({ status: 'loading' });

  const reload = useCallback(async () => {
    try {
      const resultado = await verificarEntitlement();

      if (resultado.status === 'needs_login') {
        setState({ status: 'guest' });
        return;
      }
      if (resultado.status === 'blocked') {
        setState({
          status: 'blocked',
          message: resultado.message,
          checkoutUrl: resultado.checkoutUrl,
        });
        return;
      }
      if (resultado.status === 'needs_reconnect') {
        setState({ status: 'needs_reconnect' });
        return;
      }

      // Servidor confirmou (ou cache dentro das 48h). Falta o perfil local?
      const user = await getCurrentUser();
      if (!user) {
        const pending = await getPendingProfile();
        setState(pending ? { status: 'needs_profile', pending } : { status: 'guest' });
        return;
      }

      setState({ status: 'authed', user, offline: resultado.status === 'ok_offline' });
    } catch (e) {
      console.error('useAuth reload failed:', e);
      setState({ status: 'guest' });
    }
  }, []);

  useEffect(() => {
    reload();
    const cb = () => {
      reload();
    };
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  }, [reload]);

  return { ...state, reload };
}
