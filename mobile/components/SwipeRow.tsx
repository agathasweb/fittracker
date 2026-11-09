import { Ionicons } from '@expo/vector-icons';
import React, { useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import ReanimatedSwipeable, { SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import { colors, radius, spacing } from '../lib/theme';

type Acao = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  onPress: () => void;
};

type Props = {
  /** Ação revelada ao puxar a linha para a esquerda. */
  action: Acao;
  children: React.ReactNode;
};

/**
 * Linha que, puxada para a esquerda, mostra um botão de ação (ex.: Arquivar).
 * O conteúdo (um Card) vai como children; o botão acompanha a margem do Card.
 */
export function SwipeRow({ action, children }: Props) {
  const ref = useRef<SwipeableMethods>(null);

  return (
    <ReanimatedSwipeable
      ref={ref}
      friction={2}
      rightThreshold={40}
      overshootRight={false}
      renderRightActions={() => (
        <Pressable
          style={[styles.action, { backgroundColor: action.color }]}
          onPress={() => {
            ref.current?.close();
            action.onPress();
          }}
        >
          <Ionicons name={action.icon} size={22} color={colors.bg} />
          <Text style={styles.label}>{action.label}</Text>
        </Pressable>
      )}
    >
      <View>{children}</View>
    </ReanimatedSwipeable>
  );
}

const styles = StyleSheet.create({
  action: {
    width: 96,
    marginBottom: spacing.md, // mesma margem do Card
    marginLeft: spacing.sm,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { color: colors.bg, fontSize: 12, fontWeight: '800', marginTop: 4 },
});
