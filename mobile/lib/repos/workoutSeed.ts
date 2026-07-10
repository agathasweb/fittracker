import { countTemplates, createTemplate, NewTemplateExercise } from './workoutTemplates';

/**
 * Treinos pré-carregados a partir dos planos em
 * ~/Área de trabalho/CONTROLE DE SAÚDE - 2026/. Semeados na conta do dono do
 * plano no primeiro acesso à aba de treino, se ainda não houver nenhum modelo.
 *
 * Chaveado por e-mail: cada pessoa recebe SÓ o seu plano. Contas sem plano
 * cadastrado aqui começam vazias e criam os seus no editor.
 */

type ModeloExemplo = { name: string; notes: string; exercises: NewTemplateExercise[] };

const PLANOS: Record<string, ModeloExemplo[]> = {
  // ── Gutto (treino_gutto.md) ──
  'webmaster@agathas.com.br': [
    {
      name: 'Treino A — Quadríceps + Peito + Tríceps',
      notes: 'Segunda. Cardio zona 2 (25–30 min) ao fim. Core seguro antes da força.',
      exercises: [
        { name: 'Leg press', target_sets: 3, target_reps: '12', notes: 'Quadríceps + glúteo. Amplitude controlada, lombar apoiada.' },
        { name: 'Cadeira extensora', target_sets: 3, target_reps: '12–15', notes: 'Isolamento direto de quadríceps (foco do dia).' },
        { name: 'Mesa flexora', target_sets: 2, target_reps: '12', notes: 'Posterior de coxa (equilíbrio).' },
        { name: 'Supino máquina (chest press)', target_sets: 3, target_reps: '12', notes: 'Peito. Postura neutra.' },
        { name: 'Tríceps na polia (pushdown)', target_sets: 3, target_reps: '12–15', notes: 'Tríceps — foco do dia.' },
        { name: 'Tríceps máquina', target_sets: 2, target_reps: '12', notes: 'Segundo estímulo de tríceps.' },
      ],
    },
    {
      name: 'Treino B — Quadríceps + Costas + Bíceps',
      notes: 'Quarta. Cardio zona 2 (25–30 min) ao fim. Core seguro antes da força.',
      exercises: [
        { name: 'Leg press', target_sets: 3, target_reps: '12', notes: 'Mantém frequência de quadríceps. Hack só com lombar bem apoiada.' },
        { name: 'Elevação de quadril (hip thrust)', target_sets: 3, target_reps: '12', notes: 'Glúteo, amigo da lombar.' },
        { name: 'Puxada alta (pulldown)', target_sets: 3, target_reps: '12', notes: 'Costas. Sem jogar a cabeça/pescoço.' },
        { name: 'Remada máquina (seated row)', target_sets: 3, target_reps: '12', notes: 'Costas + postura. Tronco firme.' },
        { name: 'Rosca direta na polia', target_sets: 3, target_reps: '12', notes: 'Bíceps — foco do dia.' },
        { name: 'Rosca scott / preacher máquina', target_sets: 2, target_reps: '12', notes: 'Segundo estímulo de bíceps.' },
      ],
    },
    {
      name: 'Treino C — Quadríceps + Braços + Ombro',
      notes: 'Sexta. Cardio zona 2 (25–30 min) ao fim. Ombro com carga leve pela cervical.',
      exercises: [
        { name: 'Cadeira extensora', target_sets: 3, target_reps: '12–15', notes: 'Quadríceps.' },
        { name: 'Leg press (pés baixos)', target_sets: 2, target_reps: '12', notes: 'Reforço de quadríceps.' },
        { name: 'Desenvolvimento máquina (leve)', target_sets: 2, target_reps: '12', notes: 'Ombro. Carga leve pela cervical. Sem prender a respiração.' },
        { name: 'Rosca máquina / alternada', target_sets: 3, target_reps: '12', notes: 'Bíceps.' },
        { name: 'Tríceps na polia (pushdown)', target_sets: 3, target_reps: '12', notes: 'Tríceps.' },
        { name: 'Panturrilha no aparelho', target_sets: 3, target_reps: '15', notes: '' },
      ],
    },
  ],

  // ── Julia (treino_julia.md) — 13 anos, tudo leve, atenção ao joelho ──
  'juliabonfimgouvea@agathas.com.br': [
    {
      name: 'Treino A — Pernas (leve) + Costas + Core',
      notes: 'Segunda. Tudo leve, técnica primeiro. Bike ou natação 15 min. Sem dor no joelho.',
      exercises: [
        { name: 'Leg press (leve)', target_sets: 2, target_reps: '12', notes: 'Amplitude confortável, sem dor no joelho.' },
        { name: 'Mesa flexora (leve)', target_sets: 2, target_reps: '12', notes: 'Posterior de coxa.' },
        { name: 'Puxada alta (pulldown, leve)', target_sets: 2, target_reps: '12', notes: 'Costas.' },
        { name: 'Ponte de glúteo (solo)', target_sets: 2, target_reps: '12', notes: 'Protege o joelho.' },
        { name: 'Prancha frontal', target_sets: 2, target_reps: '15–20s', notes: 'Pode apoiar nos joelhos.' },
      ],
    },
    {
      name: 'Treino B — Glúteo + Peito/Costas + Core',
      notes: 'Quarta. Carga leve. Dança ou elíptico 15 min. Glúteo forte protege o joelho.',
      exercises: [
        { name: 'Máquina de glúteo / hip thrust (leve)', target_sets: 2, target_reps: '12', notes: 'Glúteo forte = joelho protegido.' },
        { name: 'Cadeira abdutora', target_sets: 2, target_reps: '12', notes: 'Glúteo médio, estabiliza o joelho.' },
        { name: 'Supino máquina (chest press, leve)', target_sets: 2, target_reps: '12', notes: 'Peito.' },
        { name: 'Remada máquina (leve)', target_sets: 2, target_reps: '12', notes: 'Costas + postura.' },
        { name: 'Concha (clamshell) com faixa', target_sets: 2, target_reps: '12 cada lado', notes: 'Estabilidade do joelho.' },
      ],
    },
    {
      name: 'Treino C — Corpo todo leve + diversão',
      notes: 'Sexta. Leve e divertido. Esporte ou passeio de bike. Wall sit só se não doer o joelho.',
      exercises: [
        { name: 'Step-up em degrau baixo', target_sets: 2, target_reps: '8 cada perna', notes: 'Controle, sem dor.' },
        { name: 'Leg press (leve)', target_sets: 2, target_reps: '10', notes: 'Reforço de pernas.' },
        { name: 'Puxada alta (leve)', target_sets: 2, target_reps: '12', notes: 'Costas.' },
        { name: 'Elevação de panturrilha no aparelho', target_sets: 2, target_reps: '15', notes: '' },
        { name: 'Prancha lateral', target_sets: 2, target_reps: '10–15s cada lado', notes: '' },
      ],
    },
  ],
};

/** Semeia o plano do dono da conta, uma vez, se ela ainda não tem modelos. */
export async function seedInitialWorkoutsIfNeeded(
  userId: number,
  email: string
): Promise<boolean> {
  const plano = PLANOS[email.trim().toLowerCase()];
  if (!plano) return false;
  if ((await countTemplates(userId)) > 0) return false;

  for (const t of plano) {
    await createTemplate(userId, t.name, t.exercises, t.notes);
  }
  return true;
}
