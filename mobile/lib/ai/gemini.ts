import * as SecureStore from 'expo-secure-store';

/**
 * Cliente mínimo do Google Gemini (generateContent), usado pra estimar calorias
 * de cardio e musculação. A chave é do usuário e fica só no aparelho (SecureStore),
 * como a do DeepSeek.
 */
const KEY_STORE_NAME = 'fittracker_gemini_api_key';
const MODEL = 'gemini-2.5-flash';
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

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

export class GeminiError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
  }
}

/** Chama o Gemini pedindo JSON e devolve o objeto já parseado. */
export async function callGemini(systemPrompt: string, userPrompt: string): Promise<any> {
  const key = await getApiKey();
  if (!key) throw new GeminiError('Chave do Gemini não cadastrada. Adicione no Perfil.', 'NO_KEY');

  let res: Response;
  try {
    res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: userPrompt.trim() }] }],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: 'application/json',
          // Resposta é um JSON curto; sem "pensamento" fica mais rápido e barato.
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    });
  } catch {
    throw new GeminiError('Falha de rede ao consultar o Gemini. Verifique sua conexão.', 'NETWORK');
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    if (res.status === 400 && body.includes('API_KEY_INVALID')) {
      throw new GeminiError('Chave do Gemini inválida.', 'INVALID_KEY');
    }
    if (res.status === 401 || res.status === 403) {
      throw new GeminiError('Chave do Gemini sem permissão.', 'INVALID_KEY');
    }
    if (res.status === 429) {
      throw new GeminiError('Limite de uso do Gemini atingido. Tente mais tarde.', 'RATE_LIMIT');
    }
    throw new GeminiError(`Erro do Gemini (${res.status}): ${body.slice(0, 200)}`, 'HTTP');
  }

  let data: any;
  try {
    data = await res.json();
  } catch {
    throw new GeminiError('Resposta inválida do Gemini.', 'BAD_JSON');
  }
  const text: unknown = data?.candidates?.[0]?.content?.parts
    ?.map((p: any) => p?.text ?? '')
    .join('');
  if (typeof text !== 'string' || !text.trim()) {
    throw new GeminiError('Resposta inesperada do Gemini.', 'BAD_SHAPE');
  }
  try {
    return JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, ''));
  } catch {
    throw new GeminiError('O Gemini não devolveu JSON válido.', 'PARSE');
  }
}
