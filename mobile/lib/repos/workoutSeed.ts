import { countTemplates, createTemplate, NewTemplateExercise } from './workoutTemplates';

/**
 * Treinos A/B/C do plano do Gutto (treino_gutto.md). Pré-carregados na conta dele
 * no primeiro acesso à aba de treino, se ainda não houver nenhum modelo.
 *
 * Só semeia para o e-mail do dono do plano — outras contas (Julia, assinantes)
 * começam vazias e criam os seus na tela de modelos.
 */
const DONO = 'webmaster@agathas.com.br';

type ModeloExemplo = { name: string; notes: string; exercises: NewTemplateExercise[] };

const TREINOS: ModeloExemplo[] = [
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
];

/** Semeia os treinos do dono, uma vez, se a conta ainda não tem modelos. */
export async function seedGuttoWorkoutsIfNeeded(
  userId: number,
  email: string
): Promise<boolean> {
  if (email.trim().toLowerCase() !== DONO) return false;
  if ((await countTemplates(userId)) > 0) return false;

  for (const t of TREINOS) {
    await createTemplate(userId, t.name, t.exercises, t.notes);
  }
  return true;
}
