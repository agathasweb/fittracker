import { ageFromBirth } from '../format';
import { Macros, User } from '../types';
import { AiError, callAI, hasAIKey } from './providers';

/**
 * Estimativas por IA (macros de preparos/bebidas, calorias de cardio e musculação).
 * O provedor (Claude, ChatGPT, Gemini, Grok ou DeepSeek) é o escolhido no Perfil.
 */
export { AiError, hasAIKey };

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
      throw new AiError('A IA devolveu valores inválidos.', 'INVALID_VALUES');
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
  const parsed = await callAI(SYSTEM_PROMPT_PER_100G, description);
  return parseMacros(parsed);
}

/**
 * Estima macros POR 100ml de uma bebida (café, suco, refrigerante, álcool, etc.).
 * Mesmo formato do per100g — o que muda é o prompt e a unidade implícita.
 */
export async function estimateLiquidPer100ml(description: string): Promise<Macros> {
  const parsed = await callAI(SYSTEM_PROMPT_PER_100ML, description);
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

  const parsed = await callAI(SYSTEM_PROMPT_ACTIVITY, prompt);
  const kcal = Math.round(Number(parsed.kcal));
  if (!Number.isFinite(kcal) || kcal < 0) {
    throw new AiError('A IA devolveu calorias inválidas.', 'INVALID_VALUES');
  }
  return kcal;
}

export type WorkoutSummary = {
  name: string;
  exercises: { name: string; sets: number; reps: number | null; load_kg: number | null }[];
};

/** Estima o gasto calórico de uma sessão de MUSCULAÇÃO (a IA infere a duração). */
export async function estimateWorkoutCalories(
  user: Pick<User, 'sex' | 'current_weight_kg' | 'height_cm' | 'birth_date'>,
  summary: WorkoutSummary
): Promise<number> {
  const feitos = summary.exercises.filter((e) => e.sets > 0);
  if (feitos.length === 0) {
    throw new AiError('Nenhuma série concluída para estimar.', 'INVALID_VALUES');
  }

  const sexLabel = user.sex === 'M' ? 'masculino' : user.sex === 'F' ? 'feminino' : 'outro';
  const age = ageFromBirth(user.birth_date);
  const linhas = feitos
    .map((e) => {
      const carga = e.load_kg && e.load_kg > 0 ? `, ~${e.load_kg} kg` : '';
      const reps = e.reps && e.reps > 0 ? `×${e.reps}` : '';
      return `- ${e.name}: ${e.sets} série(s)${reps}${carga}`;
    })
    .join('\n');
  const totalSeries = feitos.reduce((acc, e) => acc + e.sets, 0);

  const prompt = `Treino de musculação: ${summary.name.trim()}
Exercícios concluídos (${totalSeries} séries no total):
${linhas}

Praticante:
- Sexo: ${sexLabel}
- Peso: ${user.current_weight_kg} kg
- Altura: ${user.height_cm} cm
- Idade: ${age} anos

Estime a duração típica dessa sessão (incluindo descanso entre séries) e o gasto calórico total.`;

  const parsed = await callAI(SYSTEM_PROMPT_ACTIVITY, prompt);
  const kcal = Math.round(Number(parsed.kcal));
  if (!Number.isFinite(kcal) || kcal < 0) {
    throw new AiError('A IA devolveu calorias inválidas.', 'INVALID_VALUES');
  }
  return kcal;
}
