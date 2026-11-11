import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';
import { apiLogin, apiLogout } from './api';
import {
  clearToken,
  getToken,
  limparEntitlement,
  marcarConfirmado,
  setToken,
  verificarEntitlement,
} from './entitlement';
import {
  addExtraProfile,
  clearOwnerId,
  deleteExtraProfile,
  emailLocalDoPerfil,
  getOwnerId,
  listDeviceProfileIds,
  setOwnerId,
} from './profiles';
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

/**
 * 'full' revalida a assinatura (login, logout, perfil novo). 'profile' só relê o
 * usuário ativo: trocar de perfil não pode custar uma ida ao servidor por tela montada.
 */
type NotifyKind = 'full' | 'profile';
const listeners = new Set<(kind: NotifyKind) => void>();
function notify(kind: NotifyKind = 'full') {
  listeners.forEach((cb) => cb(kind));
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
    await setOwnerId(local.id);
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

/**
 * Depois de restaurar um backup, o perfil do usuário já existe no SQLite.
 * Aponta a sessão pra ele em vez de mandar o usuário preencher tudo de novo.
 * Retorna false se o backup não tinha esse e-mail (aí resta completar o perfil).
 */
export async function adotarPerfilLocal(email: string): Promise<boolean> {
  const local = await getUserByEmail(email);
  if (!local) return false;

  await AsyncStorage.setItem(SESSION_KEY, String(local.id));
  await setOwnerId(local.id);
  await AsyncStorage.removeItem(PENDING_KEY);
  notify();
  return true;
}

/** Cria o perfil local depois que o servidor já autenticou. Não pede senha. */
export async function completarPerfil(
  dados: Omit<NewUser, 'password_hash'>
): Promise<User> {
  const existente = await getUserByEmail(dados.email);
  const user =
    existente ?? (await createUser({ ...dados, password_hash: SENHA_NO_SERVIDOR }));

  await AsyncStorage.setItem(SESSION_KEY, String(user.id));
  await setOwnerId(user.id);
  await AsyncStorage.removeItem(PENDING_KEY);
  notify();
  return user;
}

/**
 * Cria um perfil extra debaixo da conta logada (ex.: a filha sem celular) e já
 * troca pra ele. Sem e-mail, ganha um endereço local; com e-mail de alguém que já
 * tem plano de treino no seed, o seed reconhece a pessoa.
 */
export async function adicionarPerfil(
  dados: Omit<NewUser, 'password_hash' | 'email'> & { email?: string | null }
): Promise<User> {
  const ownerId = await getOwnerUserId();
  if (!ownerId) throw new Error('Entre na sua conta antes de adicionar perfis.');
  const email = dados.email?.trim().toLowerCase() || emailLocalDoPerfil();
  const existente = await getUserByEmail(email);
  if (existente) {
    if (existente.id === ownerId) throw new Error('Esse e-mail é o do perfil principal.');
    throw new Error('Já existe um perfil com esse e-mail neste aparelho.');
  }
  const user = await createUser({ ...dados, email, password_hash: SENHA_NO_SERVIDOR });
  await addExtraProfile(ownerId, user.id);
  await AsyncStorage.setItem(SESSION_KEY, String(user.id));
  notify('profile');
  return user;
}

/** Remove um perfil extra e todos os dados dele; volta pro principal se era o ativo. */
export async function removerPerfil(userId: number): Promise<void> {
  const ownerId = await getOwnerUserId();
  if (!ownerId) return;
  await deleteExtraProfile(ownerId, userId);
  if ((await getCurrentUserId()) === userId) {
    await AsyncStorage.setItem(SESSION_KEY, String(ownerId));
  }
  notify('profile');
}

export async function logout(): Promise<void> {
  const token = await getToken();
  if (token) await apiLogout(token); // best-effort: sem rede, o logout local acontece igual
  await clearToken();
  await limparEntitlement();
  await AsyncStorage.removeItem(SESSION_KEY);
  await AsyncStorage.removeItem(PENDING_KEY);
  await clearOwnerId();
  notify();
}

/**
 * Perfil principal (o da conta logada). Instalações anteriores ao multi-perfil não
 * gravavam o dono: nelas a sessão sempre apontou pro próprio dono, então ela vira o dono.
 */
export async function getOwnerUserId(): Promise<number | null> {
  const owner = await getOwnerId();
  if (owner) return owner;
  const atual = await getCurrentUserId();
  if (atual) await setOwnerId(atual);
  return atual;
}

/** Troca o perfil ativo (1 toque no topo). Só aceita perfis deste aparelho/conta. */
export async function switchProfile(userId: number): Promise<void> {
  await getOwnerUserId();
  const ids = await listDeviceProfileIds();
  if (!ids.includes(userId)) throw new Error('Perfil não encontrado neste aparelho.');
  await AsyncStorage.setItem(SESSION_KEY, String(userId));
  notify('profile');
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
  const offlineRef = useRef(false);

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

      // Servidor confirmou (ou cache dentro das 24h). Falta o perfil local?
      const user = await getCurrentUser();
      if (!user) {
        const pending = await getPendingProfile();
        setState(pending ? { status: 'needs_profile', pending } : { status: 'guest' });
        return;
      }

      offlineRef.current = resultado.status === 'ok_offline';
      setState({ status: 'authed', user, offline: resultado.status === 'ok_offline' });
    } catch (e) {
      console.error('useAuth reload failed:', e);
      setState({ status: 'guest' });
    }
  }, []);

  useEffect(() => {
    reload();
    const cb = async (kind: NotifyKind) => {
      if (kind === 'full') {
        reload();
        return;
      }
      // Troca de perfil: a assinatura (da conta) não mudou, só o usuário ativo.
      const user = await getCurrentUser().catch(() => null);
      setState((atual) =>
        atual.status === 'authed' && user ? { status: 'authed', user, offline: offlineRef.current } : atual
      );
    };
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  }, [reload]);

  return { ...state, reload };
}
