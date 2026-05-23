import { StyleSheet, View } from 'react-native';
import { colors, radius } from '../lib/theme';

type Props = {
  value: number;
  max: number;
  color?: string;
  height?: number;
};

export function ProgressBar({ value, max, color = colors.primary, height = 10 }: Props) {
  const pct = Math.max(0, Math.min(1, max > 0 ? value / max : 0));
  return (
    <View style={[styles.track, { height }]}>
      <View
        style={[
          styles.fill,
          {
            width: `${pct * 100}%`,
            backgroundColor: color,
            height,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  fill: {
    borderRadius: radius.pill,
  },
});
