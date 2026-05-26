import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActionSheetIOS,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Input } from '../../components/Input';
import { logout, useAuth } from '../../lib/auth';
import { ageFromBirth } from '../../lib/format';
import * as deepseek from '../../lib/ai/deepseek';
import { updateUser } from '../../lib/repos/users';
import { colors, radius, spacing } from '../../lib/theme';
import { ACTIVITY_LABEL, SEX_LABEL } from '../../lib/types';

const AVATAR_DIR = (FileSystem.documentDirectory ?? '') + 'avatars/';

async function persistAvatar(sourceUri: string): Promise<string> {
  const info = await FileSystem.getInfoAsync(AVATAR_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(AVATAR_DIR, { intermediates: true });
  }
  const ext = sourceUri.split('.').pop()?.split('?')[0] || 'jpg';
  const dest = `${AVATAR_DIR}avatar-${Date.now()}.${ext}`;
  await FileSystem.copyAsync({ from: sourceUri, to: dest });
  return dest;
}

async function deleteAvatarFile(uri: string | null) {
  if (!uri || !uri.startsWith(AVATAR_DIR)) return;
  try {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch {
    // arquivo já pode não existir — ignora
  }
}

export default function ProfileScreen() {
  const auth = useAuth();
  const router = useRouter();

  if (auth.status !== 'authed') return null;
  const u = auth.user;
  const age = ageFromBirth(u.birth_date);
  const initial = u.name.trim().charAt(0).toUpperCase();
  const diff = u.current_weight_kg - u.goal_weight_kg;
  const objective =
    Math.abs(diff) < 0.5 ? 'Manter peso' : diff > 0 ? 'Emagrecer' : 'Ganhar peso';

  async function onLogout() {
    await logout();
    router.replace('/auth/login');
  }

  async function pickFromSource(source: 'camera' | 'library') {
    const perm =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        'Permissão necessária',
        source === 'camera'
          ? 'Habilite a câmera nas configurações do app.'
          : 'Habilite o acesso à galeria nas configurações do app.'
      );
      return;
    }
    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
          });
    if (result.canceled || !result.assets[0]) return;
    try {
      const dest = await persistAvatar(result.assets[0].uri);
      await deleteAvatarFile(u.avatar_uri);
      await updateUser(u.id, { avatar_uri: dest });
      await auth.reload();
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível salvar a foto.');
    }
  }

  async function removeAvatar() {
    await deleteAvatarFile(u.avatar_uri);
    await updateUser(u.id, { avatar_uri: null });
    await auth.reload();
  }

  function openAvatarMenu() {
    const hasAvatar = !!u.avatar_uri;
    if (Platform.OS === 'ios') {
      const options = hasAvatar
        ? ['Tirar foto', 'Escolher da galeria', 'Remover foto', 'Cancelar']
        : ['Tirar foto', 'Escolher da galeria', 'Cancelar'];
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options,
          cancelButtonIndex: options.length - 1,
          destructiveButtonIndex: hasAvatar ? 2 : undefined,
        },
        (i) => {
          if (i === 0) pickFromSource('camera');
          else if (i === 1) pickFromSource('library');
          else if (i === 2 && hasAvatar) removeAvatar();
        }
      );
      return;
    }
    const buttons: any[] = [
      { text: 'Tirar foto', onPress: () => pickFromSource('camera') },
      { text: 'Escolher da galeria', onPress: () => pickFromSource('library') },
    ];
    if (hasAvatar) {
      buttons.push({ text: 'Remover foto', style: 'destructive', onPress: removeAvatar });
    }
    buttons.push({ text: 'Cancelar', style: 'cancel' });
    Alert.alert('Foto de perfil', undefined, buttons);
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Pressable onPress={openAvatarMenu} style={styles.avatarWrapper}>
          {u.avatar_uri ? (
            <Image source={{ uri: u.avatar_uri }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initial}</Text>
            </View>
          )}
          <View style={styles.avatarEdit}>
            <Ionicons name="camera" size={14} color={colors.bg} />
          </View>
        </Pressable>
        <Text style={styles.name}>{u.name}</Text>
        <Text style={styles.email}>{u.email}</Text>
      </View>

      <Card title="Dados pessoais">
        <Row label="Sexo" value={SEX_LABEL[u.sex]} />
        <Row label="Idade" value={`${age} anos`} />
        <Row label="Altura" value={`${u.height_cm} cm`} />
        <Row label="Peso atual" value={`${u.current_weight_kg} kg`} />
        <Row
          label="Nível de atividade"
          value={ACTIVITY_LABEL[u.activity_level].split(' (')[0]}
        />
      </Card>

      <Card title="Meta">
        <Row label="Objetivo" value={objective} />
        <Row label="Peso meta" value={`${u.goal_weight_kg} kg`} />
        <Row label="Meta de água" value={`${u.daily_water_goal_ml} ml/dia`} />
        {u.daily_calorie_goal && (
          <Row label="Meta calórica" value={`${u.daily_calorie_goal} kcal`} />
        )}
      </Card>

      <DeepSeekCard />

      <Card title="Conta">
        <MenuRow icon="log-out-outline" text="Sair" danger onPress={onLogout} />
      </Card>
    </ScrollView>
  );
}

function DeepSeekCard() {
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    deepseek.hasApiKey().then(setHasKey);
  }, []);

  function openEditor() {
    setValue('');
    setOpen(true);
  }

  async function save() {
    if (!value.trim()) {
      Alert.alert('Cole sua chave DeepSeek antes de salvar.');
      return;
    }
    setSaving(true);
    try {
      await deepseek.setApiKey(value);
      setHasKey(true);
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  function confirmRemove() {
    Alert.alert('Remover chave', 'A IA vai parar de funcionar até cadastrar outra.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: async () => {
          await deepseek.clearApiKey();
          setHasKey(false);
        },
      },
    ]);
  }

  return (
    <Card title="Integrações">
      <View style={styles.row}>
        <Text style={styles.rowLabel}>DeepSeek (IA)</Text>
        <Text style={[styles.rowValue, { color: hasKey ? colors.success : colors.textMuted }]}>
          {hasKey === null ? '…' : hasKey ? 'Configurada' : 'Não configurada'}
        </Text>
      </View>
      <Text style={styles.helperText}>
        Usada pra estimar calorias e macros de preparos pela descrição. Sua chave fica só
        neste dispositivo (armazenamento seguro).
      </Text>
      <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
        <Button
          title={hasKey ? 'Trocar chave' : 'Cadastrar chave'}
          onPress={openEditor}
          style={{ flex: 1 }}
        />
        {hasKey && (
          <Button
            title="Remover"
            variant="secondary"
            onPress={confirmRemove}
            style={{ flex: 1 }}
          />
        )}
      </View>

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalBackdrop}
        >
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Chave DeepSeek</Text>
            <Text style={styles.modalSub}>
              Pegue em platform.deepseek.com → API Keys. Começa com "sk-".
            </Text>
            <Input
              label="API key"
              value={value}
              onChangeText={setValue}
              placeholder="sk-..."
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
            />
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
              <Button
                title="Cancelar"
                variant="secondary"
                onPress={() => setOpen(false)}
                style={{ flex: 1 }}
              />
              <Button title="Salvar" onPress={save} loading={saving} style={{ flex: 1 }} />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </Card>
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

function MenuRow({
  icon,
  text,
  danger,
  onPress,
}: {
  icon: any;
  text: string;
  danger?: boolean;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity style={styles.menuRow} onPress={onPress}>
      <Ionicons name={icon} size={20} color={danger ? colors.danger : colors.textMuted} />
      <Text style={[styles.menuText, danger && { color: colors.danger }]}>{text}</Text>
      <Ionicons
        name="chevron-forward"
        size={18}
        color={colors.textMuted}
        style={{ marginLeft: 'auto' }}
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.md },
  header: { alignItems: 'center', marginVertical: spacing.lg },
  avatarWrapper: {
    width: 90,
    height: 90,
    marginBottom: spacing.sm,
    position: 'relative',
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImage: {
    width: 90,
    height: 90,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  avatarText: { color: colors.bg, fontSize: 36, fontWeight: '800' },
  avatarEdit: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.bg,
  },
  name: { color: colors.text, fontSize: 22, fontWeight: '700' },
  email: { color: colors.textMuted, marginTop: 2 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowLabel: { color: colors.textMuted },
  rowValue: { color: colors.text, fontWeight: '600' },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 12 },
  menuText: { color: colors.text },
  helperText: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: spacing.xs,
    lineHeight: 16,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  modalSub: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 4,
    marginBottom: spacing.md,
  },
});
