import { View, Text, StyleSheet } from 'react-native';
import Svg, { Line, Rect } from 'react-native-svg';
import { colors, spacing } from '../lib/theme';

export type DayBar = {
  label: string; // S T Q Q S S D
  value: number;
  hasData: boolean;
};

type Props = {
  title: string;
  unit: string;
  days: DayBar[]; // exatamente 7 (seg→dom)
  color: string;
  goal?: number | null;
};

const H = 64;
const GAP = 4;

/**
 * Barras dos 7 dias de uma semana para um domínio (hidratação, refeições…).
 *
 * Dias sem registro (furos) NÃO são barra zero — são um contorno tracejado,
 * pra ficar visível que faltou lançar (e não que o valor foi zero). Essa
 * distinção é o ponto do painel.
 */
export function WeekBarChart({ title, unit, days, color, goal }: Props) {
  const max = Math.max(goal ?? 0, ...days.map((d) => d.value), 1);
  const totalUnits = days.filter((d) => d.hasData).length;

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.sub}>
          {totalUnits}/7 dias{unit ? ` · ${unit}` : ''}
        </Text>
      </View>

      <Svg width="100%" height={H} viewBox={`0 0 100 ${H}`} preserveAspectRatio="none">
        {goal ? (
          <Line
            x1={0}
            x2={100}
            y1={H - (goal / max) * (H - 10)}
            y2={H - (goal / max) * (H - 10)}
            stroke={colors.textMuted}
            strokeWidth={0.5}
            strokeDasharray="2 2"
          />
        ) : null}
        {days.map((d, i) => {
          const bw = (100 - GAP * 6) / 7;
          const x = i * (bw + GAP);
          if (!d.hasData) {
            // furo: contorno tracejado de altura fixa baixa
            return (
              <Rect
                key={i}
                x={x}
                y={H - 12}
                width={bw}
                height={12}
                rx={1.5}
                fill="none"
                stroke={colors.border}
                strokeWidth={0.6}
                strokeDasharray="1.5 1.5"
              />
            );
          }
          const h = Math.max(2, (d.value / max) * (H - 10));
          return <Rect key={i} x={x} y={H - h} width={bw} height={h} rx={1.5} fill={color} opacity={0.9} />;
        })}
      </Svg>

      <View style={styles.labels}>
        {days.map((d, i) => (
          <Text key={i} style={[styles.dayLabel, !d.hasData && styles.dayLabelGap]}>
            {d.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.md },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 },
  title: { color: colors.text, fontSize: 13, fontWeight: '700' },
  sub: { color: colors.textMuted, fontSize: 11 },
  labels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2, paddingHorizontal: 1 },
  dayLabel: { color: colors.textMuted, fontSize: 9, width: `${100 / 7}%`, textAlign: 'center' },
  dayLabelGap: { color: colors.border },
});
