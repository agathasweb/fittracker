import * as SecureStore from 'expo-secure-store';
import { Macros } from '../types';

const KEY_STORE_NAME = 'fittracker_deepseek_api_key';
const API_URL = 'https://api.deepseek.com/chat/completions';
const MODEL = 'deepseek-chat';

export async function getApiKey(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(KEY_STORE_NAME);
  } catch {
    return null;
  }
}

export async function setApiKey(key: string): Promise<void> {
  await SecureStore.setItemAsync(KEY_STORE_NAME, key.trim());
}

export async function clearApiKey(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY_STORE_NAME);
}

export async function hasApiKey(): Promise<boolean> {
  return !!(await getApiKey());
}

export class DeepSeekError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
  }
}

const SYSTEM_PROMPT = `Você é um nutricionista que estima macros de preparações alimentares brasileiras.
Retorne SEMPRE um JSON único, sem markdown nem texto extra, com este formato exato:
{"kcal": number, "protein_g": number, "carbs_g": number, "fat_g": number, "fiber_g": number}

Regras:
- Valores são para a PORÇÃO TOTAL descrita (não por 100g).
- Use a TACO (tabela brasileira) como referência quando aplicável.
- Se uma quantidade não estiver clara, assuma porção média de uma pessoa adulta.
- Não inclua comentários, unidades textuais ou campos extras — só os 5 campos numéricos.
- Arredonde para 1 casa decimal.`;

/**
 * Estima macros de um preparo a partir da descrição em texto livre.
 *
 * Exemplo de descrição: "100g de arroz integral, 80g de feijão preto cozido,
 * salada com 50g de alface, 30g de tomate, 1 colher de azeite".
 */
export async function estimateMacros(description: string): Promise<Macros> {
  const key = await getApiKey();
  if (!key) {
    throw new DeepSeekError(
      'Chave DeepSeek não cadastrada. Adicione no perfil.',
      'NO_KEY'
    );
  }
  const trimmed = description.trim();
  if (!trimmed) {
    throw new DeepSeekError('Descreva o preparo antes de estimar.', 'EMPTY');
  }

  let res: Response;
  try {
    res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: trimmed },
        ],
        temperature: 0.2,
        response_format: { type: 'json_object' },
      }),
    });
  } catch (e: any) {
    throw new DeepSeekError(
      'Falha de rede ao consultar a IA. Verifique sua conexão.',
      'NETWORK'
    );
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    if (res.status === 401 || res.status === 403) {
      throw new DeepSeekError('Chave DeepSeek inválida.', 'INVALID_KEY');
    }
    if (res.status === 429) {
      throw new DeepSeekError('Limite de uso atingido na DeepSeek.', 'RATE_LIMIT');
    }
    throw new DeepSeekError(`Erro da IA (${res.status}): ${body.slice(0, 200)}`, 'HTTP');
  }

  let data: any;
  try {
    data = await res.json();
  } catch {
    throw new DeepSeekError('Resposta inválida da IA.', 'BAD_JSON');
  }
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== 'string') {
    throw new DeepSeekError('Resposta inesperada da IA.', 'BAD_SHAPE');
  }
  let parsed: any;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new DeepSeekError('A IA não devolveu JSON válido.', 'PARSE');
  }

  const macros: Macros = {
    kcal: Number(parsed.kcal),
    protein_g: Number(parsed.protein_g),
    carbs_g: Number(parsed.carbs_g),
    fat_g: Number(parsed.fat_g),
    fiber_g: parsed.fiber_g === null || parsed.fiber_g === undefined ? null : Number(parsed.fiber_g),
  };
  for (const k of ['kcal', 'protein_g', 'carbs_g', 'fat_g'] as const) {
    if (!Number.isFinite(macros[k]) || macros[k] < 0) {
      throw new DeepSeekError('A IA devolveu valores inválidos.', 'INVALID_VALUES');
    }
  }
  if (macros.fiber_g !== null && (!Number.isFinite(macros.fiber_g) || macros.fiber_g < 0)) {
    macros.fiber_g = null;
  }
  return macros;
}
