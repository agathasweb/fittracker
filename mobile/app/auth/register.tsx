import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Input } from '../../components/Input';
import { Logo } from '../../components/Logo';
import { OptionPicker } from '../../components/OptionPicker';
import { register } from '../../lib/auth';
import { colors, spacing } from '../../lib/theme';
import {
  ACTIVITY_LABEL,
  ActivityLevel,
  Sex,
  SEX_LABEL,
} from '../../lib/types';

type Errors = Partial<Record<string, string>>;

const ACTIVITY_OPTIONS: { value: ActivityLevel; label: string }[] = (
  Object.keys(ACTIVITY_LABEL) as ActivityLevel[]
).map((v) => ({ value: v, label: ACTIVITY_LABEL[v].split(' (')[0] }));

const SEX_OPTIONS: { value: Sex; label: string }[] = (
  Object.keys(SEX_LABEL) as Sex[]
).map((v) => ({ value: v, label: SEX_LABEL[v] }));

const ML_PER_KG = 35;

function suggestWater(weightKg: number): number {
  return Math.round(weightKg * ML_PER_KG);
}

export default function Register() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Errors>({});

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [name, setName] = useState('');
  const [sex, setSex] = useState<Sex | null>(null);
  const [birthDate, setBirthDate] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [currentWeight, setCurrentWeight] = useState('');
  const [goalWeight, setGoalWeight] = useState('');
  const [activity, setActivity] = useState<ActivityLevel | null>(null);
  const [waterGoal, setWaterGoal] = useState('');
  const [waterTouched, setWaterTouched] = useState(false);

  function onWeightChange(v: string) {
    setCurrentWeight(v);
    if (!waterTouched) {
      const kg = Number(v);
      if (kg > 0) setWaterGoal(String(suggestWater(kg)));
      else setWaterGoal('');
    }
  }

  function onWaterChange(v: string) {
    setWaterGoal(v);
    setWaterTouched(true);
  }

  function resetWaterToAuto() {
    setWaterTouched(false);
    const kg = Number(currentWeight);
    setWaterGoal(kg > 0 ? String(suggestWater(kg)) : '');
  }

  function validate(): Errors {
    const e: Errors = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) e.email = 'E-mail inválido';
    if (password.length < 6) e.password = 'Mínimo 6 caracteres';
    if (passwordConfirm !== password) e.passwordConfirm = 'Senhas não coincidem';
    if (!name.trim()) e.name = 'Informe seu nome';
    if (!sex) e.sex = 'Selecione';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) e.birthDate = 'Use AAAA-MM-DD';
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

  async function onSubmit() {
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) return;
    setSubmitting(true);
    try {
      await register({
        email,
        password,
        name,
        sex: sex!,
        birth_date: birthDate,
        height_cm: Number(heightCm),
        current_weight_kg: Number(currentWeight),
        goal_weight_kg: Number(goalWeight),
        activity_level: activity!,
        daily_water_goal_ml: Number(waterGoal),
      });
      router.replace('/(tabs)');
    } catch (err: any) {
      setErrors({ form: err?.message ?? 'Erro ao criar conta' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={{ alignItems: 'center', marginBottom: spacing.sm }}>
          <Logo size={72} />
        </View>
        <Text style={styles.title}>Vamos te conhecer</Text>
        <Text style={styles.subtitle}>
          Esses dados ficam só no seu aparelho e são usados pros cálculos de meta e progresso.
        </Text>

        <Card title="Acesso">
          <Input
            label="E-mail"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            error={errors.email}
            placeholder="voce@exemplo.com"
          />
          <Input
            label="Senha"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            error={errors.password}
            placeholder="Mínimo 6 caracteres"
          />
          <Input
            label="Repetir senha"
            value={passwordConfirm}
            onChangeText={setPasswordConfirm}
            secureTextEntry
            error={errors.passwordConfirm}
            placeholder="Digite novamente"
          />
        </Card>

        <Card title="Perfil">
          <Input
            label="Nome"
            value={name}
            onChangeText={setName}
            error={errors.name}
            placeholder="Como prefere ser chamado"
          />
          <OptionPicker<Sex>
            label="Sexo"
            value={sex}
            options={SEX_OPTIONS}
            onChange={setSex}
            error={errors.sex}
          />
          <Input
            label="Data de nascimento"
            value={birthDate}
            onChangeText={setBirthDate}
            placeholder="AAAA-MM-DD"
            error={errors.birthDate}
            autoCapitalize="none"
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
            onChangeText={onWaterChange}
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

        {errors.form && <Text style={styles.formError}>{errors.form}</Text>}

        <Button title="Criar conta" onPress={onSubmit} loading={submitting} />

        <View style={styles.loginRow}>
          <Text style={styles.loginHint}>Já tem conta?</Text>
          <Link href="/auth/login" replace style={styles.loginLink}>
            Entrar
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800',
    marginTop: spacing.sm,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 14,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  formError: {
    color: colors.danger,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  loginRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  loginHint: {
    color: colors.textMuted,
    fontSize: 14,
  },
  loginLink: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  recalc: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 13,
    marginTop: -spacing.sm,
    marginBottom: spacing.md,
    textAlign: 'right',
  },
});
