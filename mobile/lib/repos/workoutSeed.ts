import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  countTemplates,
  createTemplate,
  deleteTemplate,
  listTemplates,
  NewTemplateExercise,
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
 */

type ModeloExemplo = { name: string; notes: string; exercises: NewTemplateExercise[] };

const PLAN_VERSION = 2;
const versionKey = (userId: number) => `@fittracker/workout_plan_version/${userId}`;

const CADENCIA = 'Subida 1–2 s, descida 3–4 s. Solte o ar no esforço — não prenda a respiração.';

const PLANOS: Record<string, ModeloExemplo[]> = {
  // ── Gutto ──
  'webmaster@agathas.com.br': [
    {
      name: 'A — Segunda · Peito, Ombro e Tríceps',
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
      name: 'B — Terça · Quadríceps, Adutores e Panturrilha',
      notes: `Inferiores 1. Lombar sempre apoiada. 40–50 min + 10–20 min de aeróbico no fim. ${CADENCIA}`,
      exercises: [
        { name: 'Leg press 45°', target_sets: 3, target_reps: '8–12', notes: 'Não tirar o quadril do banco na descida.' },
        { name: 'Agachamento no Smith', target_sets: 3, target_reps: '8–12', notes: 'Coluna neutra. Alternativa: hack com lombar apoiada.' },
        { name: 'Cadeira extensora', target_sets: 3, target_reps: '10–12', notes: 'Pausa de 1 s com a perna estendida.' },
        { name: 'Afundo no Smith (passada)', target_sets: 2, target_reps: '10 cada perna', notes: 'Tronco ereto, joelho alinhado com o pé.' },
        { name: 'Cadeira adutora', target_sets: 3, target_reps: '12', notes: '' },
        { name: 'Panturrilha em pé (máquina)', target_sets: 4, target_reps: '10–15', notes: 'Amplitude total, pausa embaixo.' },
        { name: 'Prancha frontal', target_sets: 3, target_reps: '30–40 s', notes: 'Core. Respiração contínua.' },
      ],
    },
    {
      name: 'C — Quarta · Costas, Bíceps e Posterior de ombro',
      notes: `Superiores 2 (puxar) — peito/ombro/tríceps de segunda descansam. 40–50 min + 10–20 min de aeróbico no fim. ${CADENCIA}`,
      exercises: [
        { name: 'Puxada alta frente (pulldown)', target_sets: 3, target_reps: '8–12', notes: 'Puxar até o queixo. Nunca atrás da nuca.' },
        { name: 'Remada sentada máquina', target_sets: 3, target_reps: '8–12', notes: 'Tronco firme. Alternativa: triângulo na polia baixa.' },
        { name: 'Remada unilateral com halter', target_sets: 3, target_reps: '8–12 cada lado', notes: 'Joelho e mão apoiados no banco, lombar neutra.' },
        { name: 'Crucifixo inverso (peck deck invertido)', target_sets: 3, target_reps: '10–12', notes: 'Posterior de ombro e postura.' },
        { name: 'Rosca direta barra W', target_sets: 3, target_reps: '8–12', notes: 'Sem jogar o corpo. Pode ser na polia.' },
        { name: 'Rosca martelo com halteres', target_sets: 3, target_reps: '10–12', notes: 'Bíceps e antebraço.' },
      ],
    },
    {
      name: 'D — Quinta · Posterior de coxa, Glúteo e Panturrilha',
      notes: `Inferiores 2 — quadríceps de terça descansa. 40–50 min + 10–20 min de aeróbico no fim. ${CADENCIA}`,
      exercises: [
        { name: 'Mesa flexora', target_sets: 3, target_reps: '8–12', notes: 'Quadril colado no banco.' },
        { name: 'Cadeira flexora', target_sets: 3, target_reps: '10–12', notes: '' },
        { name: 'Elevação pélvica (hip thrust)', target_sets: 3, target_reps: '8–12', notes: 'Glúteo, amigo da lombar. Máquina ou barra com apoio.' },
        { name: 'Stiff com halteres (leve)', target_sets: 3, target_reps: '10–12', notes: 'Coluna neutra. Se a lombar reclamar, troque por glúteo no cabo.' },
        { name: 'Cadeira abdutora', target_sets: 3, target_reps: '12–15', notes: '' },
        { name: 'Panturrilha sentado (máquina)', target_sets: 4, target_reps: '12–15', notes: '' },
        { name: 'Prancha lateral', target_sets: 3, target_reps: '20–30 s cada lado', notes: 'Core. Respiração contínua.' },
      ],
    },
  ],

  // ── Julia — 13 anos: tudo leve, técnica antes de carga, sem ir à falha, proteger o joelho ──
  'juliabonfimgouvea@agathas.com.br': [
    {
      name: 'A — Segunda · Peito, Ombro e Tríceps (leve)',
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
      name: 'B — Terça · Pernas e Glúteo (leve)',
      notes: 'Parar na hora se doer o joelho. ~30 min + 10–15 min de bike. Glúteo forte protege o joelho.',
      exercises: [
        { name: 'Leg press (leve)', target_sets: 2, target_reps: '12–15', notes: 'Amplitude confortável, sem travar o joelho no fim.' },
        { name: 'Ponte de glúteo (solo)', target_sets: 2, target_reps: '12–15', notes: '' },
        { name: 'Cadeira abdutora (leve)', target_sets: 2, target_reps: '12–15', notes: 'Glúteo médio — estabiliza o joelho.' },
        { name: 'Cadeira adutora (leve)', target_sets: 2, target_reps: '12–15', notes: '' },
        { name: 'Step-up em degrau baixo', target_sets: 2, target_reps: '8 cada perna', notes: 'Joelho apontando para o pé.' },
        { name: 'Panturrilha no aparelho (leve)', target_sets: 2, target_reps: '15', notes: '' },
      ],
    },
    {
      name: 'C — Quarta · Costas e Bíceps (leve)',
      notes: '~30 min + 10–15 min de elíptico ou dança. Postura em primeiro lugar.',
      exercises: [
        { name: 'Puxada alta (pulldown, leve)', target_sets: 2, target_reps: '12–15', notes: 'Puxar até o queixo.' },
        { name: 'Remada máquina (leve)', target_sets: 2, target_reps: '12–15', notes: 'Costas retas.' },
        { name: 'Crucifixo inverso (leve)', target_sets: 2, target_reps: '12–15', notes: 'Postura.' },
        { name: 'Rosca na polia (leve)', target_sets: 2, target_reps: '12–15', notes: '' },
        { name: 'Prancha lateral', target_sets: 2, target_reps: '10–15 s cada lado', notes: '' },
      ],
    },
    {
      name: 'D — Quinta · Posterior e Glúteo (leve)',
      notes: 'Parar na hora se doer o joelho. ~30 min + 10–15 min de bike.',
      exercises: [
        { name: 'Mesa flexora (leve)', target_sets: 2, target_reps: '12–15', notes: '' },
        { name: 'Elevação pélvica / máquina de glúteo (leve)', target_sets: 2, target_reps: '12–15', notes: '' },
        { name: 'Glúteo no cabo (coice, leve)', target_sets: 2, target_reps: '12 cada perna', notes: '' },
        { name: 'Concha (clamshell) com faixa', target_sets: 2, target_reps: '12 cada lado', notes: 'Estabilidade do joelho.' },
        { name: 'Cadeira abdutora (leve)', target_sets: 2, target_reps: '12–15', notes: '' },
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
 * Semeia o plano do dono da conta, uma vez. Conta nova: cria a v2. Conta que tinha a
 * v1: troca os modelos A/B/C antigos pelos A–D novos (modelos criados pelo próprio
 * usuário ficam). Devolve true se mexeu em algo.
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
  if ((await getVersion(userId)) >= PLAN_VERSION) return false;

  if ((await countTemplates(userId)) > 0) {
    const antigos = new Set(PLANOS_V1[key] ?? []);
    for (const t of await listTemplates(userId)) {
      if (antigos.has(t.name)) await deleteTemplate(t.id);
    }
  }
  const existentes = new Set((await listTemplates(userId)).map((t) => t.name));
  for (const t of plano) {
    if (!existentes.has(t.name)) await createTemplate(userId, t.name, t.exercises, t.notes);
  }
  await AsyncStorage.setItem(versionKey(userId), String(PLAN_VERSION));
  return true;
}
