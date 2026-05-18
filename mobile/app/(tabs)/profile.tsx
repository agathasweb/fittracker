import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../../components/Card';
import { colors, spacing, radius } from '../../lib/theme';

export default function ProfileScreen() {
  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>G</Text>
        </View>
        <Text style={styles.name}>Gutto</Text>
        <Text style={styles.email}>webmaster@agathas.com.br</Text>
      </View>

      <Card title="Dados pessoais">
        <Row label="Sexo" value="Masculino" />
        <Row label="Idade" value="36 anos" />
        <Row label="Altura" value="175 cm" />
        <Row label="Peso atual" value="76.4 kg" />
        <Row label="Nível de atividade" value="Moderado" />
      </Card>

      <Card title="Meta">
        <Row label="Objetivo" value="Emagrecer" />
        <Row label="Peso alvo" value="72 kg" />
        <Row label="Déficit diário" value="500 kcal" />
        <Row label="Estimativa" value="≈ 11 semanas" />
      </Card>

      <Card title="Configurações">
        <MenuRow icon="notifications-outline" text="Notificações" />
        <MenuRow icon="cloud-upload-outline" text="Sincronizar com servidor" />
        <MenuRow icon="bar-chart-outline" text="Exportar dados (CSV/JSON)" />
        <MenuRow icon="moon-outline" text="Tema" />
        <MenuRow icon="log-out-outline" text="Sair" danger />
      </Card>
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function MenuRow({ icon, text, danger }: { icon: any; text: string; danger?: boolean }) {
  return (
    <TouchableOpacity style={styles.menuRow}>
      <Ionicons name={icon} size={20} color={danger ? colors.danger : colors.textMuted} />
      <Text style={[styles.menuText, danger && { color: colors.danger }]}>{text}</Text>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} style={{ marginLeft: 'auto' }} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.md },
  header: { alignItems: 'center', marginVertical: spacing.lg },
  avatar: {
    width: 90, height: 90, borderRadius: radius.pill,
    backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center',
    marginBottom: spacing.sm,
  },
  avatarText: { color: colors.bg, fontSize: 36, fontWeight: '800' },
  name: { color: colors.text, fontSize: 22, fontWeight: '700' },
  email: { color: colors.textMuted, marginTop: 2 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  rowLabel: { color: colors.textMuted },
  rowValue: { color: colors.text, fontWeight: '600' },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 12 },
  menuText: { color: colors.text },
});
