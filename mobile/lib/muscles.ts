/**
 * Quais músculos cada exercício trabalha — pra silhueta do `components/MuscleMap`.
 * Casamento por palavra-chave no nome (sem acento, minúsculo), então funciona com as
 * variações "(leve)", nomes digitados à mão etc. A PRIMEIRA regra que casar vale:
 * as mais específicas ("supino inclinado", "crucifixo inverso") vêm antes das gerais.
 *
 * Os slugs são os do react-native-body-highlighter.
 */
export type MuscleSlug =
  | 'abs'
  | 'adductors'
  | 'abductors'
  | 'biceps'
  | 'calves'
  | 'chest'
  | 'deltoids'
  | 'forearm'
  | 'gluteal'
  | 'hamstring'
  | 'lower-back'
  | 'obliques'
  | 'quadriceps'
  | 'tibialis'
  | 'trapezius'
  | 'triceps'
  | 'upper-back';

export const MUSCLE_LABEL: Record<MuscleSlug, string> = {
  abs: 'Abdômen',
  adductors: 'Adutores',
  abductors: 'Abdutores',
  biceps: 'Bíceps',
  calves: 'Panturrilha',
  chest: 'Peitoral',
  deltoids: 'Ombros (deltoide)',
  forearm: 'Antebraço',
  gluteal: 'Glúteos',
  hamstring: 'Posterior de coxa',
  'lower-back': 'Lombar',
  obliques: 'Oblíquos',
  quadriceps: 'Quadríceps',
  tibialis: 'Tibial',
  trapezius: 'Trapézio',
  triceps: 'Tríceps',
  'upper-back': 'Costas (dorsal)',
};

export type MuscleTargets = { primary: MuscleSlug[]; secondary: MuscleSlug[] };

type Rule = { match: string[]; primary: MuscleSlug[]; secondary?: MuscleSlug[] };

const RULES: Rule[] = [
  // Peito
  { match: ['supino inclinado'], primary: ['chest', 'deltoids'], secondary: ['triceps'] },
  { match: ['supino', 'chest press', 'flexao de braco'], primary: ['chest'], secondary: ['triceps', 'deltoids'] },
  // Ombro posterior antes de "voador"/"crucifixo" (peito)
  {
    match: ['crucifixo inverso', 'voador inverso', 'peck deck invertido', 'face pull'],
    primary: ['deltoids'],
    secondary: ['upper-back', 'trapezius'],
  },
  { match: ['voador', 'peck deck', 'crucifixo', 'crossover', 'cross over'], primary: ['chest'], secondary: ['deltoids'] },
  // Ombro
  { match: ['desenvolvimento', 'shoulder press'], primary: ['deltoids'], secondary: ['triceps', 'trapezius'] },
  { match: ['elevacao lateral', 'elevacao frontal'], primary: ['deltoids'], secondary: ['trapezius'] },
  { match: ['encolhimento'], primary: ['trapezius'], secondary: ['forearm'] },
  // Braços
  { match: ['triceps', 'mergulho', 'paralela'], primary: ['triceps'], secondary: ['deltoids'] },
  { match: ['rosca martelo'], primary: ['biceps', 'forearm'] },
  { match: ['rosca', 'biceps'], primary: ['biceps'], secondary: ['forearm'] },
  // Costas (pullover antes de "pulldown")
  { match: ['pullover', 'pulldown braco', 'pulldown com braco'], primary: ['upper-back'], secondary: ['chest', 'triceps'] },
  {
    match: ['puxada', 'pulldown', 'barra fixa', 'pull down'],
    primary: ['upper-back'],
    secondary: ['biceps', 'deltoids', 'forearm'],
  },
  { match: ['remada'], primary: ['upper-back', 'trapezius'], secondary: ['biceps', 'deltoids', 'lower-back'] },
  { match: ['hiperextensao', 'extensao lombar', 'lombar'], primary: ['lower-back'], secondary: ['gluteal', 'hamstring'] },
  // Pernas
  { match: ['stiff', 'levantamento terra', 'terra romeno'], primary: ['hamstring', 'gluteal'], secondary: ['lower-back'] },
  { match: ['leg press'], primary: ['quadriceps', 'gluteal'], secondary: ['hamstring', 'adductors'] },
  { match: ['agachamento', 'hack', 'afundo', 'avanco', 'passada', 'bulgaro', 'step'], primary: ['quadriceps', 'gluteal'], secondary: ['hamstring', 'adductors'] },
  { match: ['extensora'], primary: ['quadriceps'] },
  { match: ['flexora'], primary: ['hamstring'], secondary: ['calves'] },
  { match: ['adutora', 'adutor'], primary: ['adductors'] },
  { match: ['abdutora', 'abdutor', 'concha', 'clamshell'], primary: ['abductors', 'gluteal'] },
  { match: ['gluteo', 'coice', 'elevacao pelvica', 'ponte'], primary: ['gluteal'], secondary: ['hamstring'] },
  { match: ['panturrilha', 'gemeos'], primary: ['calves'] },
  // Core
  { match: ['prancha'], primary: ['abs'], secondary: ['obliques', 'deltoids'] },
  { match: ['rotacao de tronco', 'obliquo', 'russian twist'], primary: ['obliques'], secondary: ['abs'] },
  { match: ['abdominal', 'crunch', 'abdomen'], primary: ['abs'], secondary: ['obliques'] },
];

function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/** null = exercício que não sabemos mapear (cardio, nome livre muito diferente…). */
export function musclesFor(exerciseName: string): MuscleTargets | null {
  const n = normalize(exerciseName);
  const rule = RULES.find((r) => r.match.some((m) => n.includes(m)));
  if (!rule) return null;
  return { primary: rule.primary, secondary: rule.secondary ?? [] };
}
