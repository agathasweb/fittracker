import { Ionicons } from '@expo/vector-icons';
import * as Updates from 'expo-updates';
import { useEffect, useRef, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../lib/theme';
import { checkForOTAUpdate } from '../lib/updates';

const INTERVALO_MS = 1000 * 60 * 30; // no máximo uma checagem a cada 30 min

/**
 * Atualização de conteúdo (OTA) baixada e pronta. Antes o app só procurava atualização ao abrir
 * do zero e só aplicava na abertura seguinte: quem nunca fecha o app (ou acabou de instalar o
 * APK) ficava dias na versão antiga — em 17/11/2026 o Gutto viu o app sob as barras do sistema,
 * defeito corrigido por OTA em 22/10. Agora a checagem também roda quando o app volta para a
 * frente, e o usuário reinicia com um toque. Nunca recarrega sozinho (evita laço e tela cinza).
 */
export function OtaBanner() {
  const [pronta, setPronta] = useState(false);
  const ultima = useRef(0);

  useEffect(() => {
    let vivo = true;
    const checar = () => {
      if (Date.now() - ultima.current < INTERVALO_MS) return;
      ultima.current = Date.now();
      checkForOTAUpdate().then((ok) => {
        if (ok && vivo) setPronta(true);
      });
    };
    checar();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') checar();
    });
    return () => {
      vivo = false;
      sub.remove();
    };
  }, []);

  if (!pronta) return null;

  return (
    <View style={styles.wrap}>
      <Ionicons name="sparkles" size={20} color={colors.bg} />
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>Atualização pronta</Text>
        <Text style={styles.sub}>Reinicie para usar a versão nova</Text>
      </View>
      <Pressable onPress={() => Updates.reloadAsync().catch(() => {})} style={styles.btn}>
        <Text style={styles.btnText}>Reiniciar</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: { color: colors.bg, fontWeight: '800', fontSize: 13 },
  sub: { color: colors.bg, fontSize: 11, opacity: 0.8 },
  btn: {
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  btnText: { color: colors.primary, fontWeight: '800', fontSize: 13 },
});
