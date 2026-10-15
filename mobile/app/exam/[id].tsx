import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useCallback, useLayoutEffect, useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Input } from '../../components/Input';
import { OptionPicker } from '../../components/OptionPicker';
import { brDateToISO, isoDateToBR, maskBrDate } from '../../lib/format';
import { useRequireAuth } from '../../lib/guards';
import {
  addResult,
  attachFile,
  CATEGORY_LABEL,
  deleteExam,
  deleteFile,
  deleteResult,
  getExam,
  listFiles,
  listResults,
  updateExam,
} from '../../lib/repos/exams';
import { flagColor, formatResultValue } from '../../lib/examFormat';
import { colors, radius, spacing } from '../../lib/theme';
import { Exam, ExamCategory, ExamFile, ExamFlag, ExamResult } from '../../lib/types';

const FLAGS: { value: ExamFlag; label: string }[] = [
  { value: 'normal', label: 'Normal' },
  { value: 'alto', label: 'Alto' },
  { value: 'baixo', label: 'Baixo' },
  { value: 'alterado', label: 'Alterado' },
];

const CATEGORIES = Object.entries(CATEGORY_LABEL).map(([value, label]) => ({
  value: value as ExamCategory,
  label,
}));

export default function ExamDetailScreen() {
  useRequireAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const examId = Number(id);
  const router = useRouter();
  const navigation = useNavigation();

  const [exam, setExam] = useState<Exam | null>(null);
  const [results, setResults] = useState<ExamResult[]>([]);
  const [files, setFiles] = useState<ExamFile[]>([]);
  const [viewer, setViewer] = useState<ExamFile | null>(null);

  const [resOpen, setResOpen] = useState(false);
  const [marker, setMarker] = useState('');
  const [value, setValue] = useState('');
  const [unit, setUnit] = useState('');
  const [reference, setReference] = useState('');
  const [flag, setFlag] = useState<ExamFlag | null>(null);
  const [resErr, setResErr] = useState<string | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [eTitle, setETitle] = useState('');
  const [eDate, setEDate] = useState('');
  const [eCat, setECat] = useState<ExamCategory>('laboratorio');
  const [ePlace, setEPlace] = useState('');
  const [eNotes, setENotes] = useState('');

  const load = useCallback(async () => {
    if (!examId) return;
    const [e, rs, fs] = await Promise.all([getExam(examId), listResults(examId), listFiles(examId)]);
    setExam(e);
    setResults(rs);
    setFiles(fs);
  }, [examId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  useLayoutEffect(() => {
    navigation.setOptions({ title: exam?.title ?? 'Exame' });
  }, [navigation, exam?.title]);

  if (!exam) return null;

  function openResult() {
    setMarker('');
    setValue('');
    setUnit('');
    setReference('');
    setFlag(null);
    setResErr(null);
    setResOpen(true);
  }

  async function saveResult() {
    if (!marker.trim() || !value.trim()) {
      setResErr('Informe o nome e o valor');
      return;
    }
    // Número vira série no gráfico de evolução; texto ("moderada") fica como está.
    const n = Number(value.replace(',', '.'));
    await addResult(examId, {
      marker,
      value: Number.isFinite(n) ? n : null,
      value_text: Number.isFinite(n) ? null : value,
      unit,
      reference,
      flag,
    });
    setResOpen(false);
    await load();
  }

  function confirmDeleteResult(r: ExamResult) {
    Alert.alert('Apagar valor', `Remover "${r.marker}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Apagar',
        style: 'destructive',
        onPress: async () => {
          await deleteResult(r.id);
          await load();
        },
      },
    ]);
  }

  async function addPhoto(fromCamera: boolean) {
    const perm = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const r = fromCamera
      ? await ImagePicker.launchCameraAsync({ quality: 0.8 })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.8, mediaTypes: ['images'] });
    if (r.canceled || !r.assets[0]) return;
    const a = r.assets[0];
    await attachFile(examId, a.uri, a.fileName ?? `foto-${Date.now()}.jpg`, a.mimeType ?? 'image/jpeg');
    await load();
  }

  async function addDocument() {
    const r = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/*'],
      copyToCacheDirectory: true,
    });
    if (r.canceled || !r.assets[0]) return;
    const a = r.assets[0];
    await attachFile(examId, a.uri, a.name, a.mimeType ?? 'application/pdf');
    await load();
  }

  async function openFile(f: ExamFile) {
    if (f.mime.startsWith('image/')) {
      setViewer(f);
      return;
    }
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(f.uri, { mimeType: f.mime, dialogTitle: f.name });
    }
  }

  function confirmDeleteFile(f: ExamFile) {
    Alert.alert('Remover anexo', `Apagar "${f.name}" deste aparelho?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Apagar',
        style: 'destructive',
        onPress: async () => {
          await deleteFile(f);
          await load();
        },
      },
    ]);
  }

  function openEdit() {
    setETitle(exam!.title);
    setEDate(isoDateToBR(exam!.exam_date));
    setECat(exam!.category);
    setEPlace(exam!.place ?? '');
    setENotes(exam!.notes ?? '');
    setEditOpen(true);
  }

  async function saveEdit() {
    const iso = brDateToISO(eDate);
    if (!eTitle.trim() || !iso) return;
    await updateExam(examId, { exam_date: iso, title: eTitle, category: eCat, place: ePlace, notes: eNotes });
    setEditOpen(false);
    await load();
  }

  function confirmDeleteExam() {
    Alert.alert('Excluir exame', 'Apaga os valores e os anexos deste exame. Não dá pra desfazer.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          await deleteExam(examId);
          router.back();
        },
      },
    ]);
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: spacing.md }}>
      <Card>
        <View style={styles.headRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardLabel}>{(CATEGORY_LABEL[exam.category] ?? exam.category).toUpperCase()}</Text>
            <Text style={styles.headTitle}>{exam.title}</Text>
            <Text style={styles.muted}>
              {isoDateToBR(exam.exam_date)}
              {exam.place ? ` · ${exam.place}` : ''}
            </Text>
          </View>
          <Pressable onPress={openEdit} hitSlop={8}>
            <Ionicons name="create-outline" size={20} color={colors.textMuted} />
          </Pressable>
        </View>
        {exam.notes ? <Text style={styles.notes}>{exam.notes}</Text> : null}
      </Card>

      <View style={styles.sectionRow}>
        <Text style={styles.sectionTitle}>Valores</Text>
        <Pressable onPress={openResult} style={styles.addBtn}>
          <Ionicons name="add" size={18} color={colors.primary} />
          <Text style={styles.addBtnText}>Adicionar</Text>
        </Pressable>
      </View>
      {results.length === 0 ? (
        <Card>
          <Text style={styles.empty}>Nenhum valor. Adicione os resultados importantes do laudo.</Text>
        </Card>
      ) : (
        <Card>
          {results.map((r) => (
            <Pressable key={r.id} onLongPress={() => confirmDeleteResult(r)} style={styles.resRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.resName}>{r.marker}</Text>
                {r.reference ? <Text style={styles.resRef}>Ref.: {r.reference}</Text> : null}
              </View>
              <Text style={[styles.resValue, { color: flagColor(r.flag) }]}>{formatResultValue(r)}</Text>
            </Pressable>
          ))}
          <Text style={styles.hint}>Segure um valor para apagar.</Text>
        </Card>
      )}

      <Text style={[styles.sectionTitle, { marginTop: spacing.sm, marginBottom: spacing.sm }]}>Anexos</Text>
      <View style={styles.attachBtns}>
        <Button title="Galeria" variant="secondary" onPress={() => addPhoto(false)} style={{ flex: 1 }} />
        <Button title="Câmera" variant="secondary" onPress={() => addPhoto(true)} style={{ flex: 1 }} />
        <Button title="PDF" variant="secondary" onPress={addDocument} style={{ flex: 1 }} />
      </View>
      {files.map((f) => (
        <Pressable key={f.id} style={styles.fileRow} onPress={() => openFile(f)} onLongPress={() => confirmDeleteFile(f)}>
          {f.mime.startsWith('image/') ? (
            <Image source={{ uri: f.uri }} style={styles.thumb} />
          ) : (
            <View style={[styles.thumb, styles.pdfThumb]}>
              <Ionicons name="document-text" size={24} color={colors.danger} />
            </View>
          )}
          <Text style={styles.fileName} numberOfLines={2}>
            {f.name}
          </Text>
          <Ionicons name="open-outline" size={18} color={colors.textMuted} />
        </Pressable>
      ))}

      <Button title="Excluir exame" variant="ghost" onPress={confirmDeleteExam} style={{ marginTop: spacing.lg, marginBottom: spacing.xl }} />

      <Modal visible={resOpen} animationType="slide" transparent onRequestClose={() => setResOpen(false)}>
        <View style={styles.backdrop}>
          <ScrollView contentContainerStyle={styles.modal}>
            <Text style={styles.modalTitle}>Novo valor</Text>
            <Input label="Marcador" value={marker} onChangeText={setMarker} placeholder="Ex.: Glicemia de jejum" />
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <View style={{ flex: 1 }}>
                <Input label="Valor" value={value} onChangeText={setValue} placeholder="101 ou texto" />
              </View>
              <View style={{ flex: 1 }}>
                <Input label="Unidade" value={unit} onChangeText={setUnit} placeholder="mg/dL" />
              </View>
            </View>
            <Input label="Referência (opcional)" value={reference} onChangeText={setReference} placeholder="70–99 mg/dL" error={resErr} />
            <OptionPicker label="Avaliação" value={flag} options={FLAGS} onChange={setFlag} />
            <View style={styles.btns}>
              <Button title="Cancelar" variant="secondary" onPress={() => setResOpen(false)} style={{ flex: 1 }} />
              <Button title="Salvar" onPress={saveResult} style={{ flex: 1 }} />
            </View>
          </ScrollView>
        </View>
      </Modal>

      <Modal visible={editOpen} animationType="slide" transparent onRequestClose={() => setEditOpen(false)}>
        <View style={styles.backdrop}>
          <ScrollView contentContainerStyle={styles.modal}>
            <Text style={styles.modalTitle}>Editar exame</Text>
            <Input label="Nome" value={eTitle} onChangeText={setETitle} />
            <Input label="Data" value={eDate} onChangeText={(t) => setEDate(maskBrDate(t))} keyboardType="numeric" />
            <OptionPicker label="Tipo" value={eCat} options={CATEGORIES} onChange={setECat} />
            <Input label="Local" value={ePlace} onChangeText={setEPlace} />
            <Input label="Observações / conclusão" value={eNotes} onChangeText={setENotes} multiline numberOfLines={3} textAlignVertical="top" />
            <View style={styles.btns}>
              <Button title="Cancelar" variant="secondary" onPress={() => setEditOpen(false)} style={{ flex: 1 }} />
              <Button title="Salvar" onPress={saveEdit} style={{ flex: 1 }} />
            </View>
          </ScrollView>
        </View>
      </Modal>

      <Modal visible={!!viewer} transparent animationType="fade" onRequestClose={() => setViewer(null)}>
        <Pressable style={styles.viewer} onPress={() => setViewer(null)}>
          {viewer && <Image source={{ uri: viewer.uri }} style={styles.viewerImg} resizeMode="contain" />}
          <Text style={styles.viewerHint}>Toque para fechar</Text>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  cardLabel: { color: colors.textMuted, fontSize: 11, letterSpacing: 1.5, fontWeight: '600' },
  headRow: { flexDirection: 'row', alignItems: 'flex-start' },
  headTitle: { color: colors.text, fontSize: 20, fontWeight: '800', marginTop: 2 },
  muted: { color: colors.textMuted, fontSize: 13 },
  notes: { color: colors.text, fontSize: 13, marginTop: spacing.sm, lineHeight: 19 },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: spacing.xs },
  addBtnText: { color: colors.primary, fontWeight: '700' },
  empty: { color: colors.textMuted, fontSize: 13, textAlign: 'center' },
  resRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  resName: { color: colors.text, fontWeight: '600', fontSize: 14 },
  resRef: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  resValue: { fontSize: 15, fontWeight: '800', maxWidth: '50%', textAlign: 'right' },
  hint: { color: colors.textMuted, fontSize: 11, marginTop: spacing.sm, textAlign: 'right' },
  attachBtns: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  thumb: { width: 52, height: 52, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt },
  pdfThumb: { alignItems: 'center', justifyContent: 'center' },
  fileName: { flex: 1, color: colors.text, fontSize: 13 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: spacing.md },
  modal: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalTitle: { color: colors.text, fontSize: 18, fontWeight: '700', marginBottom: spacing.md },
  btns: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  viewer: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  viewerImg: { width: '100%', height: '90%' },
  viewerHint: { color: '#94A3B8', fontSize: 12, marginTop: spacing.sm },
});
