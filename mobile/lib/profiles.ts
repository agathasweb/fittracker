import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDb } from './db';
import { getUserById } from './repos/users';
import { User } from './types';

/**
 * Multi-perfil: várias pessoas usando o MESMO login (a mesma assinatura) num aparelho.
 *
 * - **Dono**: o perfil local da conta que fez login. Só ele autentica no painel; o
 *   token, a assinatura, o backup e o push são da conta dele.
 * - **Perfis extras**: linhas comuns da tabela `users`, criadas pelo dono (ex.: a filha
 *   sem celular). Como TODO dado do app já é separado por `user_id`, trocar de perfil é
 *   só mudar o usuário ativo da sessão.
 *
 * A lista de extras é guardada por dono, pra que outra conta que entre neste aparelho
 * não veja os perfis de quem saiu.
 */

const OWNER_KEY = '@fittracker/owner_user_id';
const extrasKey = (ownerId: number) => `@fittracker/extra_profiles:${ownerId}`;

export async function getOwnerId(): Promise<number | null> {
  const v = await AsyncStorage.getItem(OWNER_KEY);
  return v ? Number(v) : null;
}

export async function setOwnerId(id: number): Promise<void> {
  await AsyncStorage.setItem(OWNER_KEY, String(id));
}

export async function clearOwnerId(): Promise<void> {
  await AsyncStorage.removeItem(OWNER_KEY);
}

async function getExtraIds(ownerId: number): Promise<number[]> {
  try {
    const bruto = await AsyncStorage.getItem(extrasKey(ownerId));
    const ids = bruto ? (JSON.parse(bruto) as unknown) : [];
    return Array.isArray(ids) ? ids.map(Number).filter((n) => Number.isInteger(n) && n !== ownerId) : [];
  } catch {
    return [];
  }
}

async function setExtraIds(ownerId: number, ids: number[]): Promise<void> {
  await AsyncStorage.setItem(extrasKey(ownerId), JSON.stringify([...new Set(ids)]));
}

export async function addExtraProfile(ownerId: number, userId: number): Promise<void> {
  await setExtraIds(ownerId, [...(await getExtraIds(ownerId)), userId]);
}

/** Perfis deste aparelho: o dono primeiro, depois os extras na ordem em que foram criados. */
export async function listDeviceProfiles(ownerId: number): Promise<User[]> {
  const ids = [ownerId, ...(await getExtraIds(ownerId))];
  const users = await Promise.all(ids.map((id) => getUserById(id)));
  return users.filter((u): u is User => u != null);
}

export async function listDeviceProfileIds(): Promise<number[]> {
  const ownerId = await getOwnerId();
  if (!ownerId) return [];
  return (await listDeviceProfiles(ownerId)).map((u) => u.id);
}

/**
 * Apaga um perfil extra e TODOS os dados dele (o schema tem ON DELETE CASCADE em
 * cada tabela com `user_id`). O dono não pode ser removido por aqui.
 */
export async function deleteExtraProfile(ownerId: number, userId: number): Promise<void> {
  if (userId === ownerId) throw new Error('O perfil principal não pode ser removido.');
  const extras = await getExtraIds(ownerId);
  if (!extras.includes(userId)) throw new Error('Perfil não pertence a esta conta.');
  const db = await getDb();
  await db.runAsync('DELETE FROM users WHERE id = ?', userId);
  await setExtraIds(
    ownerId,
    extras.filter((id) => id !== userId)
  );
}

/**
 * E-mail é NOT NULL e UNIQUE em `users`. Perfil extra sem conta própria ganha um
 * endereço local que nunca colide nem chega a servidor nenhum.
 */
export function emailLocalDoPerfil(): string {
  return `perfil-${Date.now()}@local.fittracker`;
}
