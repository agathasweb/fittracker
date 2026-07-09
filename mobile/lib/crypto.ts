import CryptoJS from 'crypto-js';
import * as Crypto from 'expo-crypto';

/**
 * Cifra do backup. `expo-crypto` só faz hash e bytes aleatórios, então o AES vem
 * do crypto-js (JS puro — aceitável para um banco pequeno).
 *
 * Formato: `FTB1.<iv>.<mac>.<ciphertext>` (tudo base64).
 *
 * Encrypt-then-MAC: AES-CBC sozinho não detecta adulteração — um byte trocado
 * produz outro "texto claro" sem erro nenhum. O HMAC-SHA256 sobre iv+ciphertext
 * é conferido ANTES de decifrar, então blob corrompido ou forjado é rejeitado.
 *
 * As duas chaves (cifra e MAC) são derivadas da chave mestra vinda do painel,
 * pra não reusar o mesmo segredo em dois algoritmos.
 */

const MAGIC = 'FTB1';

type WordArray = CryptoJS.lib.WordArray;

function derivar(masterKeyB64: string): { enc: WordArray; mac: WordArray } {
  const master = CryptoJS.enc.Base64.parse(masterKeyB64);
  return {
    enc: CryptoJS.SHA256(master.clone().concat(CryptoJS.enc.Utf8.parse('enc'))),
    mac: CryptoJS.SHA256(master.clone().concat(CryptoJS.enc.Utf8.parse('mac'))),
  };
}

function bytesParaWordArray(bytes: Uint8Array): WordArray {
  const words: number[] = [];
  for (let i = 0; i < bytes.length; i++) {
    words[i >>> 2] |= bytes[i] << (24 - (i % 4) * 8);
  }
  return CryptoJS.lib.WordArray.create(words, bytes.length);
}

/** Comparação em tempo constante — não vaza onde o MAC diverge. */
function comparaConstante(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Recebe o conteúdo do arquivo em base64 e devolve o envelope cifrado (texto). */
export function cifrar(conteudoBase64: string, masterKeyB64: string): string {
  const { enc, mac } = derivar(masterKeyB64);
  const iv = bytesParaWordArray(Crypto.getRandomBytes(16));

  const cifrado = CryptoJS.AES.encrypt(CryptoJS.enc.Base64.parse(conteudoBase64), enc, {
    iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });

  const ivB64 = CryptoJS.enc.Base64.stringify(iv);
  const ctB64 = CryptoJS.enc.Base64.stringify(cifrado.ciphertext);
  const macB64 = CryptoJS.enc.Base64.stringify(CryptoJS.HmacSHA256(`${ivB64}.${ctB64}`, mac));

  return `${MAGIC}.${ivB64}.${macB64}.${ctB64}`;
}

/** Confere o MAC e decifra. Devolve o conteúdo original em base64. */
export function decifrar(envelope: string, masterKeyB64: string): string {
  const partes = envelope.split('.');
  if (partes.length !== 4 || partes[0] !== MAGIC) {
    throw new Error('Backup em formato desconhecido.');
  }
  const [, ivB64, macB64, ctB64] = partes;
  const { enc, mac } = derivar(masterKeyB64);

  const esperado = CryptoJS.enc.Base64.stringify(CryptoJS.HmacSHA256(`${ivB64}.${ctB64}`, mac));
  if (!comparaConstante(esperado, macB64)) {
    throw new Error('Backup corrompido ou adulterado.');
  }

  const decifrado = CryptoJS.AES.decrypt(
    CryptoJS.lib.CipherParams.create({ ciphertext: CryptoJS.enc.Base64.parse(ctB64) }),
    enc,
    { iv: CryptoJS.enc.Base64.parse(ivB64), mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 }
  );

  return CryptoJS.enc.Base64.stringify(decifrado);
}
