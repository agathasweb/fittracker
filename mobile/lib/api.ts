import { PANEL_BASE_URL } from './config';

/**
 * Cliente da API do painel.
 *
 * A distinção entre os erros é o coração do gate: "sem internet" NÃO é a mesma
 * coisa que "não pagou". Offline tolera 24h; falha de pagamento bloqueia na hora,
 * inclusive offline. Confundir os dois ou tranca quem pagou, ou libera quem não pagou.
 */

export type ApiUser = {
  id: number;
  name: string;
  email: string;
  is_comp: boolean;
  entitled: boolean;
};

/** Sem rede / servidor inalcançável. Não diz nada sobre a assinatura. */
export class NetworkError extends Error {}

/** Credenciais inválidas ou token expirado/revogado (401). Precisa logar de novo. */
export class UnauthorizedError extends Error {}

/** Assinatura inativa, vencida ou cancelada (403). Bloqueio total. */
export class NotEntitledError extends Error {
  constructor(
    message: string,
    readonly checkoutUrl: string | null
  ) {
    super(message);
  }
}

const TIMEOUT_MS = 12_000;

async function request(path: string, init: RequestInit = {}): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let resposta: Response;
  try {
    resposta = await fetch(`${PANEL_BASE_URL}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(init.headers ?? {}),
      },
    });
  } catch {
    // fetch só rejeita por rede/timeout — nunca por status HTTP.
    throw new NetworkError('Sem conexão com o servidor.');
  } finally {
    clearTimeout(timer);
  }

  let corpo: any = null;
  try {
    corpo = await resposta.json();
  } catch {
    corpo = null;
  }

  if (resposta.status === 401) {
    throw new UnauthorizedError(corpo?.message ?? 'Sessão expirada.');
  }
  if (resposta.status === 403) {
    throw new NotEntitledError(
      corpo?.message ?? 'Assinatura inativa.',
      corpo?.checkout_url ?? null
    );
  }
  if (!resposta.ok) {
    // 500, 429, 503... tratamos como indisponibilidade, não como inadimplência.
    throw new NetworkError(corpo?.message ?? `Erro do servidor (${resposta.status}).`);
  }

  return corpo;
}

export async function apiLogin(
  email: string,
  password: string
): Promise<{ token: string; user: ApiUser }> {
  const corpo = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
  });
  return { token: corpo.token, user: corpo.user };
}

export async function apiMe(token: string): Promise<ApiUser> {
  const corpo = await request('/api/auth/me', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return corpo.user;
}

export type BackupMeta = {
  id: number;
  size_bytes: number;
  sha256: string;
  created_at: string;
};

/** Chave AES do usuário. 403 quando o backup não está liberado pra conta (piloto). */
export async function apiBackupKey(token: string): Promise<string> {
  const corpo = await request('/api/backup/key', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return corpo.key;
}

export async function apiBackupLatest(token: string): Promise<BackupMeta | null> {
  const corpo = await request('/api/backup/latest', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return corpo.backup ?? null;
}

/** Erro de validação com mensagem do servidor (ex.: senha atual incorreta). */
export class ValidationError extends Error {}

/**
 * Troca a senha. Não passa pelo request() genérico porque precisa distinguir o
 * 422 ("senha atual incorreta") de indisponibilidade — o genérico junta tudo
 * em NetworkError e a mensagem certa se perderia.
 */
export async function apiChangePassword(
  token: string,
  currentPassword: string,
  newPassword: string
): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let resposta: Response;
  try {
    resposta = await fetch(`${PANEL_BASE_URL}/api/auth/password`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        current_password: currentPassword,
        password: newPassword,
        password_confirmation: newPassword,
      }),
    });
  } catch {
    throw new NetworkError('Sem conexão com o servidor.');
  } finally {
    clearTimeout(timer);
  }

  if (resposta.ok) return;

  let corpo: any = null;
  try {
    corpo = await resposta.json();
  } catch {
    corpo = null;
  }

  if (resposta.status === 401) throw new UnauthorizedError('Sessão expirada.');
  if (resposta.status === 422) {
    throw new ValidationError(corpo?.message ?? 'Verifique os dados e tente de novo.');
  }
  throw new NetworkError(corpo?.message ?? `Erro do servidor (${resposta.status}).`);
}

export async function apiLogout(token: string): Promise<void> {
  try {
    await request('/api/auth/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    // Sair localmente tem que funcionar mesmo sem rede.
  }
}
