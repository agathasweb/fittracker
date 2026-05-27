import * as SecureStore from 'expo-secure-store';
import { ageFromBirth } from '../format';
import { Macros, User } from '../types';

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

const SYSTEM_PROMPT_PER_100G = `Você é um nutricionista que estima macros de preparações alimentares brasileiras.
Retorne SEMPRE um JSON único, sem markdown nem texto extra, com este formato exato:
{"kcal": number, "protein_g": number, "carbs_g": number, "fat_g": number, "fiber_g": number}

Regras:
- Valores são SEMPRE POR 100g do preparo pronto (kcal/100g, proteína g/100g, etc.).
- Use a TACO (tabela brasileira) como referência quando aplicável.
- Considere o método de preparo descrito (cocção, óleo adicionado, etc.) — isso altera a densidade calórica final.
- Não inclua comentários, unidades textuais ou campos extras — só os 5 campos numéricos.
- Arredonde para 1 casa decimal.`;

const SYSTEM_PROMPT_PER_100ML = `Você é um nutricionista que estima macros de bebidas (líquidos: café, sucos, refrigerantes, bebidas alcoólicas, leite, etc.).
Retorne SEMPRE um JSON único, sem markdown nem texto extra, com este formato exato:
{"kcal": number, "protein_g": number, "carbs_g": number, "fat_g": number, "fiber_g": number}

Regras:
- Valores são SEMPRE POR 100ml da bebida pronta (kcal/100ml, proteína g/100ml, etc.).
- Considere açúcar, leite, álcool e outros ingredientes mencionados.
- Para fibra de líquidos, normalmente 0 (apenas sucos integrais com polpa têm fibra relevante).
- Não inclua comentários, unidades textuais ou campos extras — só os 5 campos numéricos.
- Arredonde para 1 casa decimal.`;

const SYSTEM_PROMPT_ACTIVITY = `Você é um fisiologista do exercício que estima gasto calórico de atividades físicas.
Retorne SEMPRE um JSON único, sem markdown nem texto extra, com este formato exato:
{"kcal": number}

Regras:
- Considere peso, altura, idade e sexo do praticante.
- Use METs típicos da atividade descrita (caminhada, corrida, ciclismo, natação, musculação, etc.).
- Se houver distância informada, use-a pra inferir intensidade (pace) junto com a duração.
- Devolva apenas o gasto calórico total da sessão (não por hora).
- O número deve ser inteiro razoável (sem decimal).
- Não inclua comentários, unidades textuais ou campos extras — só o campo "kcal".`;

async function callDeepSeek(systemPrompt: string, userPrompt: string): Promise<any> {
  const key = await getApiKey();
  if (!key) {
    throw new DeepSeekError(
      'Chave DeepSeek não cadastrada. Adicione no perfil.',
      'NO_KEY'
    );
  }
  const trimmed = userPrompt.trim();
  if (!trimmed) {
    throw new DeepSeekError('Descreva antes de pedir a estimativa.', 'EMPTY');
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
          { role: 'system', content: systemPrompt },
          { role: 'user', content: trimmed },
        ],
        temperature: 0.2,
        response_format: { type: 'json_object' },
      }),
    });
  } catch {
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
  try {
    return JSON.parse(content);
  } catch {
    throw new DeepSeekError('A IA não devolveu JSON válido.', 'PARSE');
  }
}

function parseMacros(parsed: any): Macros {
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

/**
 * Estima macros POR 100g de um preparo a partir da descrição em texto livre.
 *
 * Retorna kcal/100g e macros/100g, prontos pra armazenar como um preparo (food) no banco.
 */
export async function estimatePreparoPer100g(description: string): Promise<Macros> {
  const parsed = await callDeepSeek(SYSTEM_PROMPT_PER_100G, description);
  return parseMacros(parsed);
}

/**
 * Estima macros POR 100ml de uma bebida (café, suco, refrigerante, álcool, etc.).
 * Mesmo formato do per100g — o que muda é o prompt e a unidade implícita.
 */
export async function estimateLiquidPer100ml(description: string): Promise<Macros> {
  const parsed = await callDeepSeek(SYSTEM_PROMPT_PER_100ML, description);
  return parseMacros(parsed);
}

/**
 * Estima gasto calórico de uma sessão de atividade física com base no perfil do usuário,
 * nome da atividade, duração e (opcional) distância percorrida.
 */
export async function estimateActivityCalories(
  user: Pick<User, 'sex' | 'current_weight_kg' | 'height_cm' | 'birth_date'>,
  name: string,
  durationMin: number,
  distanceKm: number | null
): Promise<number> {
  const sexLabel = user.sex === 'M' ? 'masculino' : user.sex === 'F' ? 'feminino' : 'outro';
  const age = ageFromBirth(user.birth_date);
  const distLine = distanceKm && distanceKm > 0 ? `\nDistância: ${distanceKm} km` : '';
  const prompt = `Atividade: ${name.trim()}
Duração: ${durationMin} min${distLine}

Praticante:
- Sexo: ${sexLabel}
- Peso: ${user.current_weight_kg} kg
- Altura: ${user.height_cm} cm
- Idade: ${age} anos

Estime o gasto calórico total dessa sessão.`;

  const parsed = await callDeepSeek(SYSTEM_PROMPT_ACTIVITY, prompt);
  const kcal = Math.round(Number(parsed.kcal));
  if (!Number.isFinite(kcal) || kcal < 0) {
    throw new DeepSeekError('A IA devolveu calorias inválidas.', 'INVALID_VALUES');
  }
  return kcal;
}
