import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createTemplate,
  deleteTemplate,
  listTemplates,
  NewTemplateExercise,
  updateTemplate,
  updateTemplateInfo,
} from './workoutTemplates';

/**
 * Treinos pré-carregados por conta (chaveado por e-mail: cada pessoa recebe SÓ o seu plano;
 * contas sem plano aqui começam vazias e criam os seus no editor).
 *
 * v2 (out/2026): divisão Seg–Qui alternando superiores/inferiores, seguindo o protocolo
 * do médico do Gutto — hipertrofia 4x/semana, 8–12 reps com cargas maiores, concêntrica
 * 1–2 s, excêntrica 3–4 s, 40–50 min de musculação + 10–20 min de aeróbico no fim.
 * Julia (13 anos) recebe a mesma divisão em versão leve e protetora do joelho.
 * A v2 substitui os modelos A/B/C da v1; o histórico de sessões fica (é snapshot).
 * v3: sai o afundo, e stiff/elevação pélvica/prancha lateral/exercícios de solo viram
 * máquina (glúteo, abdominal, rotação de tronco). Mesmos dias e grupos pros dois treinarem juntos.
 * v4 (nov/2026): nova ordem — Seg quadríceps, Ter peito, Qua posterior, Qui costas. Os modelos
 * são renomeados no lugar (`nomeAnterior`), preservando exercícios editados no aparelho; só
 * os marcados com `trocarExercicios` têm a lista refeita.
 */

type ModeloExemplo = {
  name: string;
  /** Nome deste modelo na versão anterior do plano, pra reencontrá-lo no aparelho. */
  nomeAnterior: string;
  /** A lista de exercícios mudou nesta versão: refaz em vez de manter a do aparelho. */
  trocarExercicios?: boolean;
  notes: string;
  exercises: NewTemplateExercise[];
};

const PLAN_VERSION = 4;
/** Até a v2 os exercícios eram outros (afundo, stiff etc.): quem vem de lá recebe a lista nova. */
const ULTIMA_VERSAO_COM_OUTROS_EXERCICIOS = 2;
const versionKey = (userId: number) => `@fittracker/workout_plan_version/${userId}`;

const CADENCIA = 'Subida 1–2 s, descida 3–4 s. Solte o ar no esforço — não prenda a respiração.';

const PLANOS: Record<string, ModeloExemplo[]> = {
  // ── Gutto ──
  'webmaster@agathas.com.br': [
    {
      name: 'A — Segunda · Quadríceps, Adutores e Panturrilha',
      nomeAnterior: 'B — Terça · Quadríceps, Adutores e Panturrilha',
      notes: `Inferiores 1. Lombar sempre apoiada. 40–50 min + 10–20 min de aeróbico no fim. ${CADENCIA}`,
      exercises: [
        { name: 'Leg press 45°', target_sets: 3, target_reps: '8–12', notes: 'Não tirar o quadril do banco na descida.' },
        { name: 'Agachamento no Smith', target_sets: 3, target_reps: '8–12', notes: 'Coluna neutra. Alternativa: hack com lombar apoiada.' },
        { name: 'Cadeira extensora', target_sets: 3, target_reps: '10–12', notes: 'Pausa de 1 s com a perna estendida.' },
        { name: 'Cadeira adutora', target_sets: 3, target_reps: '12', notes: '' },
        { name: 'Panturrilha em pé (máquina)', target_sets: 4, target_reps: '10–15', notes: 'Amplitude total, pausa embaixo.' },
        { name: 'Prancha frontal', target_sets: 3, target_reps: '30–40 s', notes: 'Core. Respiração contínua.' },
      ],
    },
    {
      name: 'B — Terça · Peito, Ombro e Tríceps',
      nomeAnterior: 'A — Segunda · Peito, Ombro e Tríceps',
      notes: `Superiores 1 (empurrar). Aquecer 5 min. 40–50 min de musculação + 10–20 min de aeróbico no fim. ${CADENCIA}`,
      exercises: [
        { name: 'Supino reto máquina (chest press)', target_sets: 3, target_reps: '8–12', notes: 'Peito. Escápulas encaixadas no banco.' },
        { name: 'Supino inclinado com halteres', target_sets: 3, target_reps: '8–12', notes: 'Parte superior do peito. Pode ser na máquina inclinada.' },
        { name: 'Voador (peck deck)', target_sets: 3, target_reps: '10–12', notes: 'Isolamento de peito, cotovelos levemente dobrados.' },
        { name: 'Desenvolvimento máquina', target_sets: 3, target_reps: '8–12', notes: 'Ombro. Carga moderada por causa da cervical.' },
        { name: 'Elevação lateral com halteres', target_sets: 3, target_reps: '10–12', notes: 'Ombro lateral. Sem balançar o tronco.' },
        { name: 'Tríceps na polia com corda', target_sets: 3, target_reps: '10–12', notes: 'Cotovelos colados ao corpo.' },
        { name: 'Tríceps francês na polia', target_sets: 2, target_reps: '10–12', notes: 'Segundo estímulo de tríceps.' },
      ],
    },
    {
      name: 'C — Quarta · Posterior de coxa, Glúteo e Panturrilha',
      nomeAnterior: 'D — Quinta · Posterior de coxa, Glúteo e Panturrilha',
      notes: `Inferiores 2 — quadríceps de segunda descansa. 40–50 min + 10–20 min de aeróbico no fim. ${CADENCIA}`,
      exercises: [
        { name: 'Mesa flexora', target_sets: 3, target_reps: '8–12', notes: 'Quadril colado no banco.' },
        { name: 'Cadeira flexora', target_sets: 3, target_reps: '10–12', notes: '' },
        { name: 'Glúteo na máquina (coice)', target_sets: 3, target_reps: '10–12 cada perna', notes: 'Tronco apoiado, sem arquear a lombar.' },
        { name: 'Cadeira abdutora', target_sets: 3, target_reps: '12–15', notes: '' },
        { name: 'Panturrilha sentado (máquina)', target_sets: 4, target_reps: '12–15', notes: '' },
        { name: 'Abdominal na máquina (crunch)', target_sets: 3, target_reps: '12–15', notes: 'Enrolar o tronco, sem puxar com os braços.' },
        { name: 'Rotação de tronco na máquina', target_sets: 2, target_reps: '12 cada lado', notes: 'Oblíquos. Carga leve, giro controlado.' },
      ],
    },
    {
      name: 'D — Quinta · Costas, Bíceps e Posterior de ombro',
      nomeAnterior: 'C — Quarta · Costas, Bíceps e Posterior de ombro',
      notes: `Superiores 2 (puxar) — peito/ombro/tríceps de terça descansam. 40–50 min + 10–20 min de aeróbico no fim. ${CADENCIA}`,
      exercises: [
        { name: 'Puxada alta frente (pulldown)', target_sets: 3, target_reps: '8–12', notes: 'Puxar até o queixo. Nunca atrás da nuca.' },
        { name: 'Remada sentada máquina', target_sets: 3, target_reps: '8–12', notes: 'Tronco firme. Alternativa: triângulo na polia baixa.' },
        { name: 'Remada unilateral com halter', target_sets: 3, target_reps: '8–12 cada lado', notes: 'Joelho e mão apoiados no banco, lombar neutra.' },
        { name: 'Crucifixo inverso (peck deck invertido)', target_sets: 3, target_reps: '10–12', notes: 'Posterior de ombro e postura.' },
        { name: 'Rosca direta barra W', target_sets: 3, target_reps: '8–12', notes: 'Sem jogar o corpo. Pode ser na polia.' },
        { name: 'Rosca martelo com halteres', target_sets: 3, target_reps: '10–12', notes: 'Bíceps e antebraço.' },
      ],
    },
  ],

  // ── Julia — 13 anos: tudo leve, técnica antes de carga, sem ir à falha, proteger o joelho ──
  'juliabonfimgouvea@agathas.com.br': [
    {
      name: 'A — Segunda · Quadríceps, Adutores e Panturrilha (leve)',
      nomeAnterior: 'B — Terça · Pernas e Glúteo (leve)',
      trocarExercicios: true,
      notes: 'Parar na hora se doer o joelho. ~30 min + 10–15 min de bike.',
      exercises: [
        { name: 'Leg press (leve)', target_sets: 2, target_reps: '12–15', notes: 'Amplitude confortável, sem travar o joelho no fim.' },
        { name: 'Cadeira adutora (leve)', target_sets: 2, target_reps: '12–15', notes: '' },
        { name: 'Cadeira extensora (leve)', target_sets: 2, target_reps: '12–15', notes: 'Amplitude confortável. Parar se doer o joelho.' },
        { name: 'Panturrilha no aparelho (leve)', target_sets: 2, target_reps: '15', notes: '' },
      ],
    },
    {
      name: 'B — Terça · Peito, Ombro e Tríceps (leve)',
      nomeAnterior: 'A — Segunda · Peito, Ombro e Tríceps (leve)',
      notes: 'Peso que deixe fazer 15 com folga. ~30 min + 10–15 min de bike ou elíptico. Sempre com o pai ou o professor por perto.',
      exercises: [
        { name: 'Supino máquina (leve)', target_sets: 2, target_reps: '12–15', notes: 'Movimento controlado.' },
        { name: 'Voador (peck deck, leve)', target_sets: 2, target_reps: '12–15', notes: '' },
        { name: 'Desenvolvimento máquina (leve)', target_sets: 2, target_reps: '12–15', notes: 'Sem forçar acima da cabeça.' },
        { name: 'Elevação lateral (halter leve)', target_sets: 2, target_reps: '12–15', notes: '' },
        { name: 'Tríceps na polia com corda (leve)', target_sets: 2, target_reps: '12–15', notes: '' },
        { name: 'Prancha frontal', target_sets: 2, target_reps: '15–20 s', notes: 'Pode apoiar os joelhos.' },
      ],
    },
    {
      name: 'C — Quarta · Posterior, Glúteo e Panturrilha (leve)',
      nomeAnterior: 'D — Quinta · Posterior e Glúteo (leve)',
      trocarExercicios: true,
      notes: 'Parar na hora se doer o joelho. ~30 min + 10–15 min de bike. Glúteo forte protege o joelho.',
      exercises: [
        { name: 'Mesa flexora (leve)', target_sets: 2, target_reps: '12–15', notes: '' },
        { name: 'Cadeira flexora (leve)', target_sets: 2, target_reps: '12–15', notes: '' },
        { name: 'Glúteo no cabo (coice, leve)', target_sets: 2, target_reps: '12 cada perna', notes: '' },
        { name: 'Concha (clamshell) com faixa', target_sets: 2, target_reps: '12 cada lado', notes: 'Estabilidade do joelho.' },
        { name: 'Cadeira abdutora (leve)', target_sets: 2, target_reps: '12–15', notes: 'Glúteo médio — estabiliza o joelho.' },
        { name: 'Panturrilha no aparelho (leve)', target_sets: 2, target_reps: '15', notes: '' },
        { name: 'Rotação de tronco na máquina (leve)', target_sets: 2, target_reps: '10 cada lado', notes: 'Oblíquos, giro lento.' },
      ],
    },
    {
      name: 'D — Quinta · Costas, Bíceps e Posterior de ombro (leve)',
      nomeAnterior: 'C — Quarta · Costas e Bíceps (leve)',
      notes: '~30 min + 10–15 min de elíptico ou dança. Postura em primeiro lugar.',
      exercises: [
        { name: 'Puxada alta (pulldown, leve)', target_sets: 2, target_reps: '12–15', notes: 'Puxar até o queixo.' },
        { name: 'Remada máquina (leve)', target_sets: 2, target_reps: '12–15', notes: 'Costas retas.' },
        { name: 'Crucifixo inverso (leve)', target_sets: 2, target_reps: '12–15', notes: 'Postura.' },
        { name: 'Rosca na polia (leve)', target_sets: 2, target_reps: '12–15', notes: '' },
        { name: 'Abdominal na máquina (leve)', target_sets: 2, target_reps: '12–15', notes: 'Movimento curto e controlado.' },
      ],
    },
  ],
};

/** Nomes dos modelos da v1 (A/B/C) — removidos ao migrar pra v2. */
const PLANOS_V1: Record<string, string[]> = {
  'webmaster@agathas.com.br': [
    'Treino A — Quadríceps + Peito + Tríceps',
    'Treino B — Quadríceps + Costas + Bíceps',
    'Treino C — Quadríceps + Braços + Ombro',
  ],
  'juliabonfimgouvea@agathas.com.br': [
    'Treino A — Pernas (leve) + Costas + Core',
    'Treino B — Glúteo + Peito/Costas + Core',
    'Treino C — Corpo todo leve + diversão',
  ],
};

async function getVersion(userId: number): Promise<number> {
  try {
    return Number((await AsyncStorage.getItem(versionKey(userId))) ?? 0);
  } catch {
    return 0;
  }
}

/**
 * Semeia o plano do dono da conta, uma vez por versão. Modelos já semeados são atualizados
 * no lugar (nome, observação e ordem), mantendo id e exercícios; os da v1 são removidos e
 * os criados pelo próprio usuário ficam. Devolve true se mexeu em algo.
 */
let emAndamento: Promise<boolean> | null = null;

export function seedInitialWorkoutsIfNeeded(userId: number, email: string): Promise<boolean> {
  // A aba chama isto a cada foco; duas chamadas simultâneas duplicariam os modelos.
  if (!emAndamento) {
    emAndamento = semear(userId, email).finally(() => {
      emAndamento = null;
    });
  }
  return emAndamento;
}

async function semear(userId: number, email: string): Promise<boolean> {
  const key = email.trim().toLowerCase();
  const plano = PLANOS[key];
  if (!plano) return false;
  const versao = await getVersion(userId);
  if (versao >= PLAN_VERSION) return false;

  const existentes = await listTemplates(userId);
  const v1 = new Set(PLANOS_V1[key] ?? []);
  for (const t of existentes) {
    if (v1.has(t.name)) await deleteTemplate(t.id);
  }

  for (const [posicao, t] of plano.entries()) {
    // t.name cobre a retomada de uma migração que parou no meio.
    const atual = existentes.find((e) => e.name === t.nomeAnterior || e.name === t.name);
    let id: number;
    if (!atual) {
      id = await createTemplate(userId, t.name, t.exercises, t.notes);
    } else {
      id = atual.id;
      if (t.trocarExercicios || versao <= ULTIMA_VERSAO_COM_OUTROS_EXERCICIOS) {
        await updateTemplate(id, t.name, t.exercises, t.notes);
      }
    }
    await updateTemplateInfo(id, t.name, t.notes, posicao);
  }
  await AsyncStorage.setItem(versionKey(userId), String(PLAN_VERSION));
  return true;
}
