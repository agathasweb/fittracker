import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { apiMe, NetworkError, NotEntitledError, UnauthorizedError } from './api';
import { OFFLINE_GRACE_MS } from './config';

/**
 * Direito de uso do app.
 *
 * Regras (decisão do usuário):
 *  - Sem internet: libera por até 48h desde a última confirmação do servidor.
 *  - Falha de pagamento detectada (403): bloqueio TOTAL e persistido — nem offline
 *    o app abre. Só um 200 do servidor limpa esse estado.
 *  - Token inválido (401): não é inadimplência; manda pro login.
 *
 * Por isso o bloqueio mora no disco: se dependesse de estar online pra bloquear,
 * bastaria desligar o Wi-Fi pra usar de graça.
 */

const TOKEN_KEY = 'fittracker_token';          // SecureStore (keychain/keystore)
const CACHE_KEY = '@fittracker/entitlement';   // AsyncStorage

type Cache = {
  /** Última vez que o servidor confirmou o direito de uso (epoch ms). */
  checkedAt: number;
  /** true = pagamento falhou/assinatura caiu. Bloqueia inclusive offline. */
  blocked: boolean;
};

export type EntitlementResult =
  | { status: 'ok' }
  | { status: 'ok_offline'; checkedAt: number }
  | { status: 'blocked'; message: string; checkoutUrl: string | null }
  | { status: 'needs_reconnect' }   // offline e cache velho (>48h)
  | { status: 'needs_login' };

/**
 * Motivo do último bloqueio, para a tela `/auth/blocked` exibir.
 *
 * Fica em memória de propósito: passar isso por parâmetro de rota deixaria um deep
 * link (`fittracker://auth/blocked?...`) injetar texto e URL na tela oficial de
 * assinatura — phishing com a nossa marca em volta.
 */
let _motivoBloqueio: { message: string; checkoutUrl: string | null } | null = null;

export function registrarMotivoBloqueio(message: string, checkoutUrl: string | null): void {
  _motivoBloqueio = { message, checkoutUrl };
}

export function motivoBloqueio(): { message: string; checkoutUrl: string | null } | null {
  return _motivoBloqueio;
}

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

async function lerCache(): Promise<Cache | null> {
  const bruto = await AsyncStorage.getItem(CACHE_KEY);
  if (!bruto) return null;
  try {
    return JSON.parse(bruto) as Cache;
  } catch {
    return null;
  }
}

async function gravarCache(c: Cache): Promise<void> {
  await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(c));
}

export async function limparEntitlement(): Promise<void> {
  await AsyncStorage.removeItem(CACHE_KEY);
}

/** Chamado após um login bem-sucedido: o servidor acabou de confirmar o direito. */
export async function marcarConfirmado(): Promise<void> {
  await gravarCache({ checkedAt: Date.now(), blocked: false });
}

/**
 * Executado a cada abertura do app. Consulta o servidor quando há rede e
 * decide o acesso; sem rede, cai no cache — a não ser que exista bloqueio.
 */
export async function verificarEntitlement(): Promise<EntitlementResult> {
  const token = await getToken();
  if (!token) return { status: 'needs_login' };

  const cache = await lerCache();

  // Bloqueio persistido vence tudo: nem tenta o caminho offline.
  // (Ainda assim consultamos o servidor abaixo — pagar deve destravar.)
  try {
    await apiMe(token);
    await gravarCache({ checkedAt: Date.now(), blocked: false });
    return { status: 'ok' };
  } catch (e) {
    if (e instanceof NotEntitledError) {
      await gravarCache({ checkedAt: cache?.checkedAt ?? Date.now(), blocked: true });
      return { status: 'blocked', message: e.message, checkoutUrl: e.checkoutUrl };
    }

    if (e instanceof UnauthorizedError) {
      await clearToken();
      await limparEntitlement();
      return { status: 'needs_login' };
    }

    if (e instanceof NetworkError) {
      if (cache?.blocked) {
        // Pagamento falhou numa checagem anterior: offline não é rota de fuga.
        return {
          status: 'blocked',
          message: 'Sua assinatura não está ativa. Conecte-se à internet após pagar.',
          checkoutUrl: null,
        };
      }
      if (cache && Date.now() - cache.checkedAt <= OFFLINE_GRACE_MS) {
        return { status: 'ok_offline', checkedAt: cache.checkedAt };
      }
      return { status: 'needs_reconnect' };
    }

    throw e;
  }
}
