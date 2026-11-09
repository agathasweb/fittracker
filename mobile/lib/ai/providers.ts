import Anthropic from '@anthropic-ai/sdk';
import * as SecureStore from 'expo-secure-store';

/**
 * Inteligência Artificial: o usuário cadastra a chave de um ou mais provedores e escolhe
 * qual usar. Tudo que o app pede à IA (macros de preparos/bebidas, calorias de cardio e
 * musculação) passa por `callAI`, que devolve o JSON já parseado.
 * As chaves ficam só no aparelho (SecureStore).
 */

export type ProviderId = 'anthropic' | 'openai' | 'gemini' | 'grok' | 'deepseek';

export type ProviderInfo = {
  id: ProviderId;
  label: string;
  /** Modelo usado quando o usuário não informa outro. */
  defaultModel: string;
  /** Onde pegar a chave. */
  keyHint: string;
  placeholder: string;
};

export const PROVIDERS: ProviderInfo[] = [
  {
    id: 'anthropic',
    label: 'Anthropic (Claude)',
    defaultModel: 'claude-opus-5-5',
    keyHint: 'platform.claude.com → API Keys. Começa com "sk-ant-".',
    placeholder: 'sk-ant-...',
  },
  {
    id: 'openai',
    label: 'OpenAI (ChatGPT)',
    defaultModel: 'gpt-5-mini',
    keyHint: 'platform.openai.com → API keys. Começa com "sk-".',
    placeholder: 'sk-...',
  },
  {
    id: 'gemini',
    label: 'Google Gemini',
    // gemini-2.5-* não aceita mais contas novas (404).
    defaultModel: 'gemini-3.8-flash',
    keyHint: 'aistudio.google.com → Get API key. Começa com "AIza" ou "AQ.".',
    placeholder: 'AIza... ou AQ....',
  },
  {
    id: 'grok',
    label: 'Grok (xAI)',
    defaultModel: 'grok-4-fast-non-reasoning',
    keyHint: 'console.x.ai → API Keys. Começa com "xai-".',
    placeholder: 'xai-...',
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    defaultModel: 'deepseek-chat',
    keyHint: 'platform.deepseek.com → API Keys. Começa com "sk-".',
    placeholder: 'sk-...',
  },
];

export const providerInfo = (id: ProviderId) => PROVIDERS.find((p) => p.id === id)!;

// DeepSeek e Gemini mantêm os nomes antigos, pra não perder chaves já cadastradas.
const keyStore = (id: ProviderId) => `fittracker_${id}_api_key`;
const modelStore = (id: ProviderId) => `fittracker_${id}_model`;
const ACTIVE_STORE = 'fittracker_ai_provider';

async function ler(nome: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(nome);
  } catch {
    return null;
  }
}

export const getKey = (id: ProviderId) => ler(keyStore(id));
export async function hasKey(id: ProviderId): Promise<boolean> {
  return !!(await getKey(id));
}
export async function setKey(id: ProviderId, key: string): Promise<void> {
  await SecureStore.setItemAsync(keyStore(id), key.trim());
}
export async function clearKey(id: ProviderId): Promise<void> {
  await SecureStore.deleteItemAsync(keyStore(id));
}

/** Modelo escolhido pelo usuário (vazio = o padrão do provedor). */
export const getCustomModel = (id: ProviderId) => ler(modelStore(id));
export async function setCustomModel(id: ProviderId, model: string): Promise<void> {
  if (model.trim()) await SecureStore.setItemAsync(modelStore(id), model.trim());
  else await SecureStore.deleteItemAsync(modelStore(id));
}
async function modelOf(id: ProviderId): Promise<string> {
  return (await getCustomModel(id)) || providerInfo(id).defaultModel;
}

/**
 * Provedor em uso: o escolhido pelo usuário; se não escolheu (instalações antigas),
 * o primeiro que tiver chave — Gemini antes do DeepSeek, como já funcionava.
 */
export async function getActiveProvider(): Promise<ProviderId | null> {
  const escolhido = (await ler(ACTIVE_STORE)) as ProviderId | null;
  if (escolhido && PROVIDERS.some((p) => p.id === escolhido)) return escolhido;
  for (const id of ['gemini', 'deepseek', 'anthropic', 'openai', 'grok'] as ProviderId[]) {
    if (await hasKey(id)) return id;
  }
  return null;
}
export async function setActiveProvider(id: ProviderId): Promise<void> {
  await SecureStore.setItemAsync(ACTIVE_STORE, id);
}

/** O provedor em uso tem chave cadastrada? */
export async function hasAIKey(): Promise<boolean> {
  const id = await getActiveProvider();
  return !!id && (await hasKey(id));
}

export class AiError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
  }
}

/** Chama o provedor em uso e devolve o objeto JSON da resposta. */
export async function callAI(systemPrompt: string, userPrompt: string): Promise<any> {
  const prompt = userPrompt.trim();
  if (!prompt) throw new AiError('Descreva antes de pedir a estimativa.', 'EMPTY');

  const id = await getActiveProvider();
  const key = id ? await getKey(id) : null;
  if (!id || !key) {
    throw new AiError('Nenhuma IA configurada. Cadastre uma chave em Perfil → Inteligência Artificial.', 'NO_KEY');
  }
  const nome = providerInfo(id).label;
  const model = await modelOf(id);

  let texto: string;
  if (id === 'anthropic') texto = await chamarAnthropic(key, model, systemPrompt, prompt);
  else if (id === 'gemini') texto = await chamarGemini(key, model, systemPrompt, prompt, nome);
  else texto = await chamarCompativelOpenAI(id, key, model, systemPrompt, prompt, nome);

  try {
    // Alguns modelos embrulham o JSON em ```json ... ```.
    return JSON.parse(texto.trim().replace(/^```(?:json)?\s*|\s*```$/g, ''));
  } catch {
    throw new AiError(`${nome} não devolveu JSON válido.`, 'PARSE');
  }
}

// ── Anthropic (SDK oficial) ───────────────────────────────────────────

async function chamarAnthropic(key: string, model: string, system: string, prompt: string): Promise<string> {
  const client = new Anthropic({ apiKey: key, maxRetries: 1 });
  try {
    const res = await client.beta.messages.create({
      model,
      max_tokens: 16000,
      system,
      messages: [{ role: 'user', content: prompt }],
      // Estimativa curta e simples: pouco raciocínio basta.
      output_config: { effort: 'low' },
      // Se o filtro de segurança recusar, o servidor tenta outro modelo sozinho.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
    });
    if (res.stop_reason === 'refusal') {
      throw new AiError('O Claude recusou o pedido. Tente reformular.', 'REFUSAL');
    }
    const texto = res.content
      .map((b) => (b.type === 'text' ? b.text : ''))
      .join('')
      .trim();
    if (!texto) throw new AiError('Resposta vazia do Claude.', 'BAD_SHAPE');
    return texto;
  } catch (e) {
    if (e instanceof AiError) throw e;
    if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) {
      throw new AiError('Chave da Anthropic inválida ou sem permissão.', 'INVALID_KEY');
    }
    if (e instanceof Anthropic.NotFoundError) {
      throw new AiError(`Modelo "${model}" não encontrado na Anthropic.`, 'MODEL');
    }
    if (e instanceof Anthropic.RateLimitError) {
      throw new AiError('Limite de uso da Anthropic atingido. Tente mais tarde.', 'RATE_LIMIT');
    }
    if (e instanceof Anthropic.APIConnectionError) {
      throw new AiError('Falha de rede ao consultar o Claude. Verifique sua conexão.', 'NETWORK');
    }
    if (e instanceof Anthropic.APIError) {
      throw new AiError(`Erro do Claude (${e.status ?? '?'}): ${e.message.slice(0, 200)}`, 'HTTP');
    }
    throw e;
  }
}

// ── Gemini ────────────────────────────────────────────────────────────

async function chamarGemini(key: string, model: string, system: string, prompt: string, nome: string): Promise<string> {
  const res = await enviar(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    { 'x-goog-api-key': key },
    {
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: 'application/json',
        // Resposta é um JSON curto: pouco "pensamento" = mais rápido e barato.
        ...(model.startsWith('gemini-3') ? { thinkingConfig: { thinkingLevel: 'low' } } : {}),
      },
    },
    nome,
    model
  );
  const texto = res?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text ?? '').join('');
  if (typeof texto !== 'string' || !texto.trim()) throw new AiError(`Resposta inesperada do ${nome}.`, 'BAD_SHAPE');
  return texto;
}

// ── OpenAI, Grok e DeepSeek (mesmo formato de chat/completions) ──────

const BASE_URL: Record<'openai' | 'grok' | 'deepseek', string> = {
  openai: 'https://api.openai.com/v1/chat/completions',
  grok: 'https://api.x.ai/v1/chat/completions',
  deepseek: 'https://api.deepseek.com/chat/completions',
};

async function chamarCompativelOpenAI(
  id: 'openai' | 'grok' | 'deepseek',
  key: string,
  model: string,
  system: string,
  prompt: string,
  nome: string
): Promise<string> {
  const res = await enviar(
    BASE_URL[id],
    { Authorization: `Bearer ${key}` },
    {
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      // Os modelos de raciocínio da OpenAI (gpt-5*) recusam temperature diferente de 1.
      ...(id === 'openai' ? {} : { temperature: 0.2 }),
    },
    nome,
    model
  );
  const texto = res?.choices?.[0]?.message?.content;
  if (typeof texto !== 'string' || !texto.trim()) throw new AiError(`Resposta inesperada do ${nome}.`, 'BAD_SHAPE');
  return texto;
}

async function enviar(url: string, headers: Record<string, string>, body: unknown, nome: string, model: string) {
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    });
  } catch {
    throw new AiError(`Falha de rede ao consultar o ${nome}. Verifique sua conexão.`, 'NETWORK');
  }
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    if (res.status === 401 || res.status === 403 || txt.includes('API_KEY_INVALID')) {
      throw new AiError(`Chave do ${nome} inválida ou sem permissão.`, 'INVALID_KEY');
    }
    if (res.status === 404) throw new AiError(`Modelo "${model}" não encontrado no ${nome}.`, 'MODEL');
    if (res.status === 429) throw new AiError(`Limite de uso do ${nome} atingido. Tente mais tarde.`, 'RATE_LIMIT');
    throw new AiError(`Erro do ${nome} (${res.status}): ${txt.slice(0, 200)}`, 'HTTP');
  }
  try {
    return await res.json();
  } catch {
    throw new AiError(`Resposta inválida do ${nome}.`, 'BAD_JSON');
  }
}
