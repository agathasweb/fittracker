import AsyncStorage from '@react-native-async-storage/async-storage';
import bcrypt from 'bcryptjs';
import * as Crypto from 'expo-crypto';
import { useCallback, useEffect, useState } from 'react';
import { createUser, getUserByEmail, getUserById, NewUser } from './repos/users';
import { User } from './types';

const SESSION_KEY = '@fittracker/current_user_id';
const BCRYPT_ROUNDS = 10;

// bcryptjs tenta usar `crypto.randomBytes` (Node) ou `window.crypto.getRandomValues`
// (browser), nenhum dos dois existe no Hermes/RN. Sem esse fallback o hash de
// senha quebra com "Requiring unknown module" ao gerar o salt.
bcrypt.setRandomFallback((len: number) => Array.from(Crypto.getRandomBytes(len)));

const listeners = new Set<() => void>();
function notify() {
  listeners.forEach((cb) => cb());
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function register(
  data: Omit<NewUser, 'password_hash'> & { password: string }
): Promise<User> {
  const existing = await getUserByEmail(data.email);
  if (existing) throw new Error('E-mail já cadastrado');
  const password_hash = await hashPassword(data.password);
  const { password, ...rest } = data;
  const user = await createUser({ ...rest, password_hash });
  await AsyncStorage.setItem(SESSION_KEY, String(user.id));
  notify();
  return user;
}

export async function login(email: string, password: string): Promise<User> {
  const u = await getUserByEmail(email);
  if (!u) throw new Error('E-mail ou senha inválidos');
  const ok = await verifyPassword(password, u.password_hash);
  if (!ok) throw new Error('E-mail ou senha inválidos');
  await AsyncStorage.setItem(SESSION_KEY, String(u.id));
  notify();
  return u;
}

export async function logout(): Promise<void> {
  await AsyncStorage.removeItem(SESSION_KEY);
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
  | { status: 'authed'; user: User };

export function useAuth(): AuthState & { reload: () => Promise<void> } {
  const [state, setState] = useState<AuthState>({ status: 'loading' });

  const reload = useCallback(async () => {
    try {
      const u = await getCurrentUser();
      setState(u ? { status: 'authed', user: u } : { status: 'guest' });
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
