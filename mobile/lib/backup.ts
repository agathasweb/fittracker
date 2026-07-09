import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system';
import {
  apiBackupKey,
  apiBackupLatest,
  BackupMeta,
  NetworkError,
  NotEntitledError,
} from './api';
import { PANEL_BASE_URL } from './config';
import { cifrar, decifrar } from './crypto';
import { closeDb, DB_FILE_NAME, getDb } from './db';
import { getToken } from './entitlement';

/**
 * Backup do SQLite no painel.
 *
 * O banco é cifrado no aparelho antes de subir (ver lib/crypto.ts) — o painel
 * guarda um blob opaco. Existe porque desinstalar o app apaga o sandbox inteiro:
 * um backup gravado dentro do próprio app não sobrevive ao evento pra que existe.
 *
 * Piloto: só contas cortesia. Para as demais o painel devolve 403 e o app
 * simplesmente não faz backup — sem erro na cara do usuário.
 */

const ULTIMO_BACKUP_KEY = '@fittracker/ultimo_backup_em';
const INTERVALO_MS = 24 * 60 * 60 * 1000; // diário

const DB_PATH = `${FileSystem.documentDirectory}SQLite/${DB_FILE_NAME}`;

export type ResultadoBackup =
  | { status: 'feito'; bytes: number }
  | { status: 'pulado'; motivo: 'recente' | 'indisponivel' | 'sem_rede' | 'sem_sessao' };

async function sha256Hex(texto: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, texto, {
    encoding: Crypto.CryptoEncoding.HEX,
  });
}

export async function ultimoBackupEm(): Promise<number | null> {
  const v = await AsyncStorage.getItem(ULTIMO_BACKUP_KEY);
  return v ? Number(v) : null;
}

/** Sobe um backup agora. Lança só em erro inesperado; casos previstos viram 'pulado'. */
export async function fazerBackup(): Promise<ResultadoBackup> {
  const token = await getToken();
  if (!token) return { status: 'pulado', motivo: 'sem_sessao' };

  let chave: string;
  try {
    chave = await apiBackupKey(token);
  } catch (e) {
    if (e instanceof NotEntitledError) return { status: 'pulado', motivo: 'indisponivel' };
    if (e instanceof NetworkError) return { status: 'pulado', motivo: 'sem_rede' };
    throw e;
  }

  // Fecha e faz checkpoint: sem isso o WAL fica de fora e o backup sai velho.
  await closeDb();

  const info = await FileSystem.getInfoAsync(DB_PATH);
  if (!info.exists) {
    await getDb(); // reabre antes de desistir
    return { status: 'pulado', motivo: 'sem_sessao' };
  }

  const conteudo = await FileSystem.readAsStringAsync(DB_PATH, {
    encoding: FileSystem.EncodingType.Base64,
  });

  await getDb(); // reabre assim que o arquivo foi lido

  const envelope = cifrar(conteudo, chave);
  const sha = await sha256Hex(envelope);

  const tmp = `${FileSystem.cacheDirectory}backup-${Date.now()}.bin`;
  await FileSystem.writeAsStringAsync(tmp, envelope);

  try {
    const resposta = await FileSystem.uploadAsync(`${PANEL_BASE_URL}/api/backup`, tmp, {
      httpMethod: 'POST',
      uploadType: FileSystem.FileSystemUploadType.MULTIPART,
      fieldName: 'file',
      parameters: { sha256: sha },
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });

    if (resposta.status === 403) return { status: 'pulado', motivo: 'indisponivel' };
    if (resposta.status !== 201) {
      throw new Error(`Falha ao enviar backup (HTTP ${resposta.status}).`);
    }
  } catch (e) {
    if (e instanceof TypeError) return { status: 'pulado', motivo: 'sem_rede' };
    throw e;
  } finally {
    await FileSystem.deleteAsync(tmp, { idempotent: true });
  }

  await AsyncStorage.setItem(ULTIMO_BACKUP_KEY, String(Date.now()));
  return { status: 'feito', bytes: envelope.length };
}

/** Chamado na abertura do app. Só age se o último backup tem mais de 24h. */
export async function backupDiarioSeNecessario(): Promise<ResultadoBackup> {
  const ultimo = await ultimoBackupEm();
  if (ultimo && Date.now() - ultimo < INTERVALO_MS) {
    return { status: 'pulado', motivo: 'recente' };
  }
  return fazerBackup();
}

export async function backupDisponivel(): Promise<BackupMeta | null> {
  const token = await getToken();
  if (!token) return null;
  try {
    return await apiBackupLatest(token);
  } catch {
    return null; // 403 (não é piloto) ou sem rede: não oferecer restauração
  }
}

/**
 * Baixa, confere integridade e SUBSTITUI o banco local.
 *
 * Destrutivo: o SQLite atual é sobrescrito. Só chamar quando o usuário pedir
 * explicitamente (ou numa instalação nova, sem dados).
 */
export async function restaurarBackup(): Promise<void> {
  const token = await getToken();
  if (!token) throw new Error('Faça login antes de restaurar.');

  const meta = await apiBackupLatest(token);
  if (!meta) throw new Error('Nenhum backup encontrado na sua conta.');

  const chave = await apiBackupKey(token);

  const tmp = `${FileSystem.cacheDirectory}restore-${Date.now()}.bin`;
  const baixado = await FileSystem.downloadAsync(
    `${PANEL_BASE_URL}/api/backup/download`,
    tmp,
    { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } }
  );
  if (baixado.status !== 200) {
    await FileSystem.deleteAsync(tmp, { idempotent: true });
    throw new Error(`Não foi possível baixar o backup (HTTP ${baixado.status}).`);
  }

  try {
    const envelope = await FileSystem.readAsStringAsync(tmp);

    // Confere o que o painel disse ter guardado antes de tocar no banco local.
    const sha = await sha256Hex(envelope);
    if (sha !== meta.sha256) {
      throw new Error('O backup baixado não confere com o registrado no servidor.');
    }

    // decifrar() valida o MAC e lança se o conteúdo foi adulterado.
    const conteudo = decifrar(envelope, chave);

    await closeDb();
    await FileSystem.makeDirectoryAsync(`${FileSystem.documentDirectory}SQLite`, {
      intermediates: true,
    });

    // Sem isto, o -wal antigo é reaplicado por cima do banco restaurado e o
    // corrompe. Eles pertencem ao banco que está sendo substituído.
    await FileSystem.deleteAsync(`${DB_PATH}-wal`, { idempotent: true });
    await FileSystem.deleteAsync(`${DB_PATH}-shm`, { idempotent: true });

    await FileSystem.writeAsStringAsync(DB_PATH, conteudo, {
      encoding: FileSystem.EncodingType.Base64,
    });
  } finally {
    await FileSystem.deleteAsync(tmp, { idempotent: true });
    await getDb(); // reabre (e reaplica migrations se o backup for de versão antiga)
  }
}
