import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from './Button';
import { Card } from './Card';
import { Input } from './Input';
import { OptionPicker } from './OptionPicker';
import { NewUser } from '../lib/repos/users';
import { brDateToISO, maskBrDate } from '../lib/format';
import { colors, spacing } from '../lib/theme';
import { ACTIVITY_LABEL, ActivityLevel, Sex, SEX_LABEL } from '../lib/types';

export type ProfileFormData = Omit<NewUser, 'password_hash' | 'email'> & { email?: string };

type Errors = Partial<Record<string, string>>;

const ACTIVITY_OPTIONS: { value: ActivityLevel; label: string }[] = (
  Object.keys(ACTIVITY_LABEL) as ActivityLevel[]
).map((v) => ({ value: v, label: ACTIVITY_LABEL[v].split(' (')[0] }));

const SEX_OPTIONS: { value: Sex; label: string }[] = (Object.keys(SEX_LABEL) as Sex[]).map((v) => ({
  value: v,
  label: SEX_LABEL[v],
}));

const ML_PER_KG = 35;
const suggestWater = (kg: number) => Math.round(kg * ML_PER_KG);

/**
 * Formulário do perfil local (sexo, nascimento, medidas, metas). Usado ao completar o
 * perfil depois do login e ao adicionar um perfil extra (multi-perfil).
 */
export function ProfileForm({
  initialName = '',
  askEmail = false,
  submitTitle,
  formError,
  onSubmit,
}: {
  initialName?: string;
  /** Perfil extra: e-mail opcional (identifica a pessoa no seed de treinos). */
  askEmail?: boolean;
  submitTitle: string;
  formError?: string | null;
  onSubmit: (data: ProfileFormData) => Promise<void>;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState('');
  const [sex, setSex] = useState<Sex | null>(null);
  const [birthDate, setBirthDate] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [currentWeight, setCurrentWeight] = useState('');
  const [goalWeight, setGoalWeight] = useState('');
  const [activity, setActivity] = useState<ActivityLevel | null>(null);
  const [waterGoal, setWaterGoal] = useState('');
  const [waterTouched, setWaterTouched] = useState(false);

  // O nome do painel chega depois da montagem no "completar perfil".
  useEffect(() => {
    if (initialName) setName((atual) => atual || initialName);
  }, [initialName]);

  function onWeightChange(v: string) {
    setCurrentWeight(v);
    if (!waterTouched) {
      const kg = Number(v);
      setWaterGoal(kg > 0 ? String(suggestWater(kg)) : '');
    }
  }

  function resetWaterToAuto() {
    setWaterTouched(false);
    const kg = Number(currentWeight);
    setWaterGoal(kg > 0 ? String(suggestWater(kg)) : '');
  }

  function validate(): Errors {
    const e: Errors = {};
    if (!name.trim()) e.name = 'Informe o nome';
    if (askEmail && email.trim() && !/^\S+@\S+\.\S+$/.test(email.trim())) e.email = 'E-mail inválido';
    if (!sex) e.sex = 'Selecione';
    if (!brDateToISO(birthDate)) e.birthDate = 'Use dd/mm/aaaa';
    const h = Number(heightCm);
    if (!h || h < 80 || h > 250) e.heightCm = '80–250 cm';
    const cw = Number(currentWeight);
    if (!cw || cw < 20 || cw > 400) e.currentWeight = '20–400 kg';
    const gw = Number(goalWeight);
    if (!gw || gw < 20 || gw > 400) e.goalWeight = '20–400 kg';
    if (!activity) e.activity = 'Selecione';
    const wg = Number(waterGoal);
    if (!wg || wg < 500 || wg > 8000) e.waterGoal = '500–8000 ml';
    return e;
  }

  async function submit() {
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) return;
    setSubmitting(true);
    try {
      await onSubmit({
        email: askEmail ? email.trim() || undefined : undefined,
        name,
        sex: sex!,
        birth_date: brDateToISO(birthDate)!,
        height_cm: Number(heightCm),
        current_weight_kg: Number(currentWeight),
        goal_weight_kg: Number(goalWeight),
        activity_level: activity!,
        daily_water_goal_ml: Number(waterGoal),
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Card title="Perfil">
        <Input label="Nome" value={name} onChangeText={setName} error={errors.name} placeholder="Como prefere ser chamado" />
        {askEmail && (
          <Input
            label="E-mail (opcional)"
            value={email}
            onChangeText={setEmail}
            error={errors.email}
            placeholder="se a pessoa tem conta FitTracker"
            autoCapitalize="none"
            keyboardType="email-address"
            hint="Não é login: só identifica a pessoa (ex.: pra carregar o plano de treino dela)."
          />
        )}
        <OptionPicker<Sex> label="Sexo" value={sex} options={SEX_OPTIONS} onChange={setSex} error={errors.sex} />
        <Input
          label="Data de nascimento"
          value={birthDate}
          onChangeText={(v) => setBirthDate(maskBrDate(v))}
          placeholder="dd/mm/aaaa"
          error={errors.birthDate}
          autoCapitalize="none"
          keyboardType="numeric"
          maxLength={10}
        />
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Input
              label="Altura (cm)"
              value={heightCm}
              onChangeText={setHeightCm}
              keyboardType="numeric"
              error={errors.heightCm}
              placeholder="175"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Input
              label="Peso atual (kg)"
              value={currentWeight}
              onChangeText={onWeightChange}
              keyboardType="numeric"
              error={errors.currentWeight}
              placeholder="80"
            />
          </View>
        </View>
      </Card>

      <Card title="Metas">
        <Input
          label="Peso meta (kg)"
          value={goalWeight}
          onChangeText={setGoalWeight}
          keyboardType="numeric"
          error={errors.goalWeight}
          placeholder="75"
        />
        <OptionPicker<ActivityLevel>
          label="Nível de atividade"
          value={activity}
          options={ACTIVITY_OPTIONS}
          onChange={setActivity}
          horizontal
          error={errors.activity}
        />
        <Input
          label="Meta diária de água (ml)"
          value={waterGoal}
          onChangeText={(v) => {
            setWaterGoal(v);
            setWaterTouched(true);
          }}
          keyboardType="numeric"
          error={errors.waterGoal}
          hint={
            waterTouched
              ? 'Personalizado — toque em "Recalcular" pra voltar ao automático'
              : 'Calculado automaticamente: 35 ml × kg de peso'
          }
          placeholder={currentWeight ? String(suggestWater(Number(currentWeight))) : '2500'}
        />
        {waterTouched && (
          <Text style={styles.recalc} onPress={resetWaterToAuto}>
            Recalcular pelo peso
          </Text>
        )}
      </Card>

      {formError ? <Text style={styles.formError}>{formError}</Text> : null}

      <Button title={submitTitle} onPress={submit} loading={submitting} />
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.md },
  formError: { color: colors.danger, marginBottom: spacing.md, textAlign: 'center' },
  recalc: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 13,
    marginTop: -spacing.sm,
    marginBottom: spacing.md,
    textAlign: 'right',
  },
});
