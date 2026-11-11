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
 * v5 (nov/2026): upper/lower por evidência — ver o comentário de PLANOS.
 */

type ModeloExemplo = {
  name: string;
  /** Nome deste modelo na versão anterior do plano, pra reencontrá-lo no aparelho. */
  nomeAnterior: string;
  /** Nomes de versões ainda mais antigas, pra quem pulou versões do plano. */
  nomesMaisAntigos?: string[];
  /** A lista de exercícios mudou nesta versão: refaz em vez de manter a do aparelho. */
  trocarExercicios?: boolean;
  notes: string;
  exercises: NewTemplateExercise[];
};

const PLAN_VERSION = 5;
/** Até a v2 os exercícios eram outros (afundo, stiff etc.): quem vem de lá recebe a lista nova. */
const ULTIMA_VERSAO_COM_OUTROS_EXERCICIOS = 2;
const versionKey = (userId: number) => `@fittracker/workout_plan_version/${userId}`;

const CADENCIA = 'Subida 1–2 s, descida 3–4 s. Solte o ar no esforço — não prenda a respiração.';
const PROGRESSAO =
  'Pare 1–3 reps antes da falha. Bateu o topo da faixa em todas as séries? Suba 2,5–5% de carga e volte ao piso.';
const DESCANSO = 'Descanso: 2–3 min nos compostos, 60–90 s nos isolados.';
const CARDIO_GUTTO = 'Cardio 10–15 min no fim (ou 2–3x/semana à parte) + 8–10 mil passos/dia.';
const JULIA =
  'Técnica antes de carga; pare com 2–3 reps sobrando, nunca até a falha. Joelho alinhado com o pé. Dor no joelho acima de 3/10 = tira o exercício. Sempre com o pai ou o professor por perto.';
const AQUECIMENTO_JULIA: NewTemplateExercise = {
  name: 'Aquecimento de joelho (8 min)',
  target_sets: 1,
  target_reps: '8 min',
  notes: '5 min de bike + ponte de glúteo 10x + caminhada lateral com mini-band 10 passos/lado.',
};

/**
 * v5 (nov/2026): upper/lower — cada músculo 2x/semana, volume por evidência (10–20 séries/semana,
 * Schoenfeld 2017/2019, Pelland 2026, ACSM 2026). Mantém as restrições do médico do Gutto (sem
 * afundo, stiff na máquina, lombar apoiada, carga moderada no ombro, cadência). Julia: mesmos dias e
 * grupos, versão leve (AAP/NSCA/UKSCA para adolescentes), glúteo médio 2x/semana pelo joelho.
 */
const PLANOS: Record<string, ModeloExemplo[]> = {
  // ── Gutto ──
  'webmaster@agathas.com.br': [
    {
      name: 'A — Segunda · Inferior A (quadríceps)',
      nomeAnterior: 'A — Segunda · Quadríceps, Adutores e Panturrilha',
      nomesMaisAntigos: ['B — Terça · Quadríceps, Adutores e Panturrilha'],
      trocarExercicios: true,
      notes: `Inferiores 1. Lombar sempre apoiada. ${PROGRESSAO} ${DESCANSO} ${CARDIO_GUTTO} ${CADENCIA}`,
      exercises: [
        { name: 'Leg press 45°', target_sets: 4, target_reps: '8–10', notes: 'Não tirar o quadril do banco na descida.' },
        { name: 'Agachamento no Smith', target_sets: 3, target_reps: '8–10', notes: 'Coluna neutra. Alternativa: hack com lombar apoiada.' },
        { name: 'Cadeira extensora', target_sets: 3, target_reps: '12–15', notes: 'Pausa de 1 s com a perna estendida.' },
        { name: 'Cadeira flexora', target_sets: 3, target_reps: '10–12', notes: 'Sentado: trabalha o posterior alongado.' },
        { name: 'Cadeira adutora', target_sets: 2, target_reps: '12–15', notes: '' },
        { name: 'Panturrilha em pé (máquina)', target_sets: 3, target_reps: '10–15', notes: 'Amplitude total, pausa de 1 s embaixo.' },
        { name: 'Pallof press na polia', target_sets: 2, target_reps: '10 cada lado', notes: 'Core anti-rotação: braços estendidos, tronco não gira.' },
      ],
    },
    {
      name: 'B — Terça · Superior A (peito)',
      nomeAnterior: 'B — Terça · Peito, Ombro e Tríceps',
      nomesMaisAntigos: ['A — Segunda · Peito, Ombro e Tríceps'],
      trocarExercicios: true,
      notes: `Superiores 1 — foco peito. Aquecer 5 min. ${PROGRESSAO} ${DESCANSO} ${CARDIO_GUTTO} ${CADENCIA}`,
      exercises: [
        { name: 'Supino reto com halteres', target_sets: 4, target_reps: '6–10', notes: 'Descer até alongar o peito. Escápulas encaixadas.' },
        { name: 'Supino inclinado com halteres', target_sets: 3, target_reps: '8–12', notes: 'Parte superior do peito. Pode ser na máquina inclinada.' },
        { name: 'Remada sentada máquina', target_sets: 3, target_reps: '8–12', notes: 'Tronco firme, puxar com as costas.' },
        { name: 'Puxada alta frente (pulldown)', target_sets: 3, target_reps: '8–12', notes: 'Puxar até o queixo. Nunca atrás da nuca.' },
        { name: 'Elevação lateral com halteres', target_sets: 3, target_reps: '12–15', notes: 'Ombro lateral. Sem balançar o tronco.' },
        { name: 'Tríceps francês na polia', target_sets: 3, target_reps: '10–12', notes: 'Acima da cabeça: tríceps alongado cresce mais.' },
        { name: 'Rosca inclinada com halteres', target_sets: 3, target_reps: '10–12', notes: 'Banco a 45–60°, braços pendurados atrás do tronco.' },
      ],
    },
    {
      name: 'C — Quarta · Inferior B (posterior e glúteo)',
      nomeAnterior: 'C — Quarta · Posterior de coxa, Glúteo e Panturrilha',
      nomesMaisAntigos: ['D — Quinta · Posterior de coxa, Glúteo e Panturrilha'],
      trocarExercicios: true,
      notes: `Inferiores 2. Lombar sempre apoiada. ${PROGRESSAO} ${DESCANSO} ${CARDIO_GUTTO} ${CADENCIA}`,
      exercises: [
        { name: 'Cadeira flexora', target_sets: 4, target_reps: '8–12', notes: 'Sentado, quadril encaixado.' },
        { name: 'Glúteo na máquina (coice)', target_sets: 3, target_reps: '8–12 cada perna', notes: 'Tronco apoiado, sem arquear a lombar.' },
        { name: 'Leg press 45° — pés altos', target_sets: 3, target_reps: '10–12', notes: 'Pés no alto da plataforma: mais glúteo e posterior.' },
        { name: 'Mesa flexora', target_sets: 2, target_reps: '10–12', notes: 'Quadril colado no banco.' },
        { name: 'Cadeira abdutora', target_sets: 2, target_reps: '15', notes: '' },
        { name: 'Panturrilha sentado (máquina)', target_sets: 3, target_reps: '12–15', notes: '' },
        { name: 'Abdominal na máquina (crunch)', target_sets: 3, target_reps: '10–15', notes: 'Fortalece o core — mas barriga se perde com déficit, proteína e cardio, não com abdominal.' },
      ],
    },
    {
      name: 'D — Quinta · Superior B (costas e braços)',
      nomeAnterior: 'D — Quinta · Costas, Bíceps e Posterior de ombro',
      nomesMaisAntigos: ['C — Quarta · Costas, Bíceps e Posterior de ombro'],
      trocarExercicios: true,
      notes: `Superiores 2 — foco costas e braços. ${PROGRESSAO} ${DESCANSO} ${CARDIO_GUTTO} ${CADENCIA}`,
      exercises: [
        { name: 'Puxada alta frente (pulldown)', target_sets: 4, target_reps: '8–12', notes: 'Puxar até o queixo. Nunca atrás da nuca.' },
        { name: 'Remada unilateral com halter', target_sets: 3, target_reps: '8–12 cada lado', notes: 'Joelho e mão apoiados no banco, lombar neutra.' },
        { name: 'Supino reto máquina (chest press)', target_sets: 3, target_reps: '8–12', notes: 'Segundo estímulo de peito na semana.' },
        { name: 'Voador (peck deck)', target_sets: 3, target_reps: '12–15', notes: 'Abrir até alongar o peito, cotovelos levemente dobrados.' },
        { name: 'Crucifixo inverso (peck deck invertido)', target_sets: 3, target_reps: '12–15', notes: 'Posterior de ombro e postura.' },
        { name: 'Rosca direta barra W', target_sets: 3, target_reps: '8–12', notes: 'Sem jogar o corpo. Pode ser na polia.' },
        { name: 'Tríceps na polia com corda', target_sets: 3, target_reps: '10–12', notes: 'Cotovelos colados ao corpo.' },
        { name: 'Rosca martelo com halteres', target_sets: 2, target_reps: '10–12', notes: 'Bíceps e antebraço.' },
      ],
    },
  ],

  // ── Julia — 13 anos: força, postura e joelho protegido. Leve a moderado, nunca à falha ──
  'juliabonfimgouvea@agathas.com.br': [
    {
      name: 'A — Segunda · Inferior A (leve)',
      nomeAnterior: 'A — Segunda · Quadríceps, Adutores e Panturrilha (leve)',
      nomesMaisAntigos: ['B — Terça · Pernas e Glúteo (leve)'],
      trocarExercicios: true,
      notes: `${JULIA} ~40 min + 10 min de bike.`,
      exercises: [
        AQUECIMENTO_JULIA,
        { name: 'Leg press (leve)', target_sets: 2, target_reps: '12–15', notes: 'Amplitude sem dor, sem travar o joelho no fim.' },
        { name: 'Cadeira extensora (leve)', target_sets: 2, target_reps: '12–15', notes: 'Carga leve e amplitude parcial confortável.' },
        { name: 'Cadeira flexora (leve)', target_sets: 2, target_reps: '12–15', notes: '' },
        { name: 'Cadeira adutora (leve)', target_sets: 2, target_reps: '12–15', notes: '' },
        { name: 'Cadeira abdutora (leve)', target_sets: 2, target_reps: '15', notes: 'Glúteo médio — estabiliza o joelho.' },
        { name: 'Panturrilha no aparelho (leve)', target_sets: 2, target_reps: '15', notes: '' },
        { name: 'Prancha frontal', target_sets: 2, target_reps: '20–30 s', notes: 'Pode apoiar os joelhos.' },
      ],
    },
    {
      name: 'B — Terça · Superior A (leve)',
      nomeAnterior: 'B — Terça · Peito, Ombro e Tríceps (leve)',
      nomesMaisAntigos: ['A — Segunda · Peito, Ombro e Tríceps (leve)'],
      trocarExercicios: true,
      notes: `${JULIA} ~40 min + 10 min de bike ou elíptico.`,
      exercises: [
        { name: 'Supino máquina (leve)', target_sets: 2, target_reps: '12–15', notes: 'Movimento controlado.' },
        { name: 'Remada máquina (leve)', target_sets: 2, target_reps: '12–15', notes: 'Costas retas, ombros longe das orelhas.' },
        { name: 'Puxada alta (pulldown, leve)', target_sets: 2, target_reps: '12–15', notes: 'Puxar até o queixo.' },
        { name: 'Desenvolvimento máquina (leve)', target_sets: 2, target_reps: '12–15', notes: 'Sem forçar acima da cabeça.' },
        { name: 'Elevação lateral (halter leve)', target_sets: 2, target_reps: '15', notes: '' },
        { name: 'Tríceps na polia com corda (leve)', target_sets: 2, target_reps: '12–15', notes: '' },
        { name: 'Prancha frontal', target_sets: 2, target_reps: '20–30 s', notes: 'Pode apoiar os joelhos.' },
      ],
    },
    {
      name: 'C — Quarta · Inferior B (leve)',
      nomeAnterior: 'C — Quarta · Posterior, Glúteo e Panturrilha (leve)',
      nomesMaisAntigos: ['D — Quinta · Posterior e Glúteo (leve)'],
      trocarExercicios: true,
      notes: `${JULIA} Glúteo forte protege o joelho. ~40 min + 10 min de bike.`,
      exercises: [
        AQUECIMENTO_JULIA,
        { name: 'Cadeira flexora (leve)', target_sets: 2, target_reps: '12–15', notes: '' },
        { name: 'Glúteo no cabo (coice, leve)', target_sets: 2, target_reps: '12 cada perna', notes: 'Sem arquear a lombar.' },
        { name: 'Cadeira abdutora (leve)', target_sets: 3, target_reps: '15', notes: 'Glúteo médio — estabiliza o joelho.' },
        { name: 'Concha (clamshell) com faixa', target_sets: 2, target_reps: '12 cada lado', notes: 'Estabilidade do joelho.' },
        { name: 'Panturrilha no aparelho (leve)', target_sets: 2, target_reps: '15', notes: '' },
        { name: 'Pallof press na polia (leve)', target_sets: 2, target_reps: '10 cada lado', notes: 'Core anti-rotação: tronco não gira.' },
      ],
    },
    {
      name: 'D — Quinta · Superior B (leve)',
      nomeAnterior: 'D — Quinta · Costas, Bíceps e Posterior de ombro (leve)',
      nomesMaisAntigos: ['C — Quarta · Costas e Bíceps (leve)'],
      trocarExercicios: true,
      notes: `${JULIA} Postura em primeiro lugar. ~40 min + 10 min de elíptico ou dança.`,
      exercises: [
        { name: 'Puxada alta (pulldown, leve)', target_sets: 2, target_reps: '12–15', notes: 'Puxar até o queixo.' },
        { name: 'Remada unilateral (halter leve)', target_sets: 2, target_reps: '12 cada lado', notes: 'Joelho e mão apoiados no banco.' },
        { name: 'Supino máquina (leve)', target_sets: 2, target_reps: '12–15', notes: '' },
        { name: 'Crucifixo inverso (leve)', target_sets: 3, target_reps: '15', notes: 'Postura e posterior de ombro.' },
        { name: 'Rosca na polia (leve)', target_sets: 2, target_reps: '12–15', notes: '' },
        { name: 'Tríceps na polia (leve)', target_sets: 2, target_reps: '12–15', notes: '' },
        { name: 'Dead bug', target_sets: 2, target_reps: '8 cada lado', notes: 'Lombar colada no chão, movimento lento.' },
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

  // Arquivados entram: senão uma versão nova do plano recriaria o modelo que o usuário arquivou.
  const existentes = await listTemplates(userId, { incluirArquivados: true });
  const v1 = new Set(PLANOS_V1[key] ?? []);
  for (const t of existentes) {
    if (v1.has(t.name)) await deleteTemplate(t.id);
  }

  for (const [posicao, t] of plano.entries()) {
    // t.name cobre a retomada de uma migração que parou no meio.
    const nomes = [t.name, t.nomeAnterior, ...(t.nomesMaisAntigos ?? [])];
    const atual = existentes.find((e) => nomes.includes(e.name));
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
