import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Input } from '../components/Input';
import { ProgressBar } from '../components/ProgressBar';
import { useAuth } from '../lib/auth';
import { formatTime, todayISO } from '../lib/format';
import { useRequireAuth } from '../lib/guards';
import {
  addEntry,
  createSource,
  deleteEntry,
  deleteSource,
  listEntriesOfDay,
  listSources,
  logSource,
  logSourceQty,
  proteinOf,
  sumProteinOfDay,
  updateSource,
} from '../lib/repos/protein';
import { updateUser } from '../lib/repos/users';
import { colors, radius, spacing } from '../lib/theme';
import { ProteinEntry, ProteinMode, ProteinSource } from '../lib/types';

/** Aceita "24,5" ou "24.5". */
function parseGrams(raw: string): number {
  return Number(raw.replace(',', '.'));
}

function fmtG(g: number): string {
  return Number.isInteger(g) ? String(g) : g.toFixed(1).replace('.', ',');
}

const MODES: { id: ProteinMode; label: string; hint: string }[] = [
  { id: 'porcao', label: 'Porção', hint: 'Um toque registra a porção inteira (ovo, YoPro).' },
  { id: 'gramas', label: 'Gramas', hint: 'O app pergunta o peso e calcula (carnes). Informe a proteína a cada 100 g.' },
  { id: 'unidades', label: 'Unidades', hint: 'O app pergunta quantas (dosadores de whey). Informe a proteína de 1 unidade.' },
];

/** Atalhos de quantidade no lançamento. */
const ATALHOS: Record<'gramas' | 'unidades', number[]> = {
  gramas: [100, 150, 200, 250],
  unidades: [1, 2, 3, 4],
};

/** "1 dosador (15 g)" → "dosador"; usado em "Quantos dosadores?". */
function unidadeDe(portion: string): string {
  return portion.replace(/^\s*1\s+/, '').replace(/\s*\(.*$/, '').trim() || 'unidade';
}

export default function ProteinScreen() {
  const auth = useAuth();
  useRequireAuth();
  const userId = auth.status === 'authed' ? auth.user.id : null;
  const user = auth.status === 'authed' ? auth.user : null;

  const [sources, setSources] = useState<ProteinSource[]>([]);
  const [entries, setEntries] = useState<ProteinEntry[]>([]);
  const [total, setTotal] = useState(0);

  // Modal de fonte: editing=null cria nova; senão edita.
  const [sourceOpen, setSourceOpen] = useState(false);
  const [editing, setEditing] = useState<ProteinSource | null>(null);
  const [srcName, setSrcName] = useState('');
  const [srcPortion, setSrcPortion] = useState('');
  const [srcGrams, setSrcGrams] = useState('');
  const [srcMode, setSrcMode] = useState<ProteinMode>('porcao');
  const [srcErrors, setSrcErrors] = useState<Record<string, string>>({});

  const [freeOpen, setFreeOpen] = useState(false);
  const [freeLabel, setFreeLabel] = useState('');
  const [freeGrams, setFreeGrams] = useState('');
  const [freeError, setFreeError] = useState<string | null>(null);

  // Lançamento por quantidade (carne em gramas, whey em dosadores).
  const [qtySource, setQtySource] = useState<ProteinSource | null>(null);
  const [qtyValue, setQtyValue] = useState('');
  const [qtyError, setQtyError] = useState<string | null>(null);

  // Atalho da tela Hoje: /protein?lancar=<id da fonte> já abre a pergunta da quantidade.
  const router = useRouter();
  const { lancar } = useLocalSearchParams<{ lancar?: string }>();
  useEffect(() => {
    if (!lancar) return;
    const s = sources.find((x) => String(x.id) === lancar);
    if (!s) return;
    router.setParams({ lancar: '' });
    if (s.mode !== 'porcao') openQty(s);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lancar, sources]);

  const [goalOpen, setGoalOpen] = useState(false);
  const [goalDraft, setGoalDraft] = useState('');

  const load = useCallback(async () => {
    if (!userId) return;
    const day = todayISO();
    const [ss, es, sum] = await Promise.all([
      listSources(userId),
      listEntriesOfDay(userId, day),
      sumProteinOfDay(userId, day),
    ]);
    setSources(ss);
    setEntries(es);
    setTotal(sum);
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (!user || !userId) return null;

  function openQty(s: ProteinSource) {
    setQtySource(s);
    setQtyValue('');
    setQtyError(null);
  }

  async function onLog(s: ProteinSource) {
    if (s.mode !== 'porcao') {
      openQty(s);
      return;
    }
    await logSource(userId!, s);
    await load();
  }

  async function saveQty() {
    if (!qtySource) return;
    const q = parseGrams(qtyValue);
    const max = qtySource.mode === 'gramas' ? 2000 : 20;
    if (!q || q <= 0 || q > max) {
      setQtyError(qtySource.mode === 'gramas' ? 'Informe o peso em gramas (até 2000)' : 'Informe quantos (até 20)');
      return;
    }
    await logSourceQty(userId!, qtySource, q);
    setQtySource(null);
    await load();
  }

  function openSource(s: ProteinSource | null) {
    setEditing(s);
    setSrcName(s?.name ?? '');
    setSrcPortion(s?.portion ?? '');
    setSrcGrams(s ? fmtG(s.protein_g) : '');
    setSrcMode(s?.mode ?? 'porcao');
    setSrcErrors({});
    setSourceOpen(true);
  }

  async function saveSource() {
    const errs: Record<string, string> = {};
    if (!srcName.trim()) errs.name = 'Informe um nome';
    if (srcMode !== 'gramas' && !srcPortion.trim()) errs.portion = 'Ex.: 1 unidade, 1 dosador (15 g)';
    const g = parseGrams(srcGrams);
    if (!g || g <= 0 || g > 200) errs.grams = '0–200 g';
    setSrcErrors(errs);
    if (Object.keys(errs).length) return;
    const portion = srcMode === 'gramas' ? srcPortion.trim() || '100 g' : srcPortion;
    if (editing) await updateSource(editing.id, srcName, portion, g, srcMode);
    else await createSource(userId!, srcName, portion, g, srcMode);
    setSourceOpen(false);
    await load();
  }

  function removeSource(src: ProteinSource | null = editing) {
    if (!src) return;
    Alert.alert('Remover fonte', `Excluir "${src.name}"? Os lançamentos já feitos continuam.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          await deleteSource(src.id);
          setSourceOpen(false);
          await load();
        },
      },
    ]);
  }

  function openFree() {
    setFreeLabel('');
    setFreeGrams('');
    setFreeError(null);
    setFreeOpen(true);
  }

  async function saveFree() {
    const g = parseGrams(freeGrams);
    if (!g || g <= 0 || g > 300) {
      setFreeError('0–300 g');
      return;
    }
    await addEntry(userId!, freeLabel.trim() || 'Avulso', g);
    setFreeOpen(false);
    await load();
  }

  async function removeEntry(id: number) {
    await deleteEntry(id);
    await load();
  }

  function openGoalEdit() {
    setGoalDraft(String(user!.daily_protein_goal_g));
    setGoalOpen(true);
  }

  async function saveGoal() {
    const v = Number(goalDraft);
    if (!v || v < 20 || v > 500) return;
    await updateUser(userId!, { daily_protein_goal_g: v });
    await auth.reload();
    setGoalOpen(false);
  }

  const goal = user.daily_protein_goal_g;
  const remaining = Math.max(0, goal - total);
  const pct = goal > 0 ? total / goal : 0;

  return (
    <ScrollView style={{ backgroundColor: colors.bg, flex: 1 }} contentContainerStyle={{ padding: spacing.md }}>
      <Card>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardLabel}>HOJE</Text>
            <Text style={styles.totalValue}>
              {fmtG(Math.round(total * 10) / 10)} <Text style={styles.unit}>g</Text>
            </Text>
            <Text style={styles.goalLine}>
              {remaining > 0
                ? `Meta ${goal} g · faltam ${fmtG(Math.round(remaining * 10) / 10)} g`
                : `Meta ${goal} g batida!`}
            </Text>
          </View>
          <Pressable onPress={openGoalEdit} style={styles.editGoalBtn}>
            <Ionicons name="create-outline" size={20} color={colors.textMuted} />
          </Pressable>
        </View>
        <ProgressBar value={total} max={goal} height={14} />
        <Text style={styles.pctLine}>{Math.round(pct * 100)}% da meta</Text>
      </Card>

      <View style={styles.sectionRow}>
        <Text style={styles.sectionTitle}>Minhas fontes</Text>
        <Pressable onPress={() => openSource(null)} style={styles.addBtn}>
          <Ionicons name="add" size={18} color={colors.primary} />
          <Text style={styles.addBtnText}>Nova</Text>
        </Pressable>
      </View>
      <Text style={styles.helpText}>
        Toque na fonte para lançar. Carnes pedem o peso em gramas (da carne já pronta) e o whey pede quantos dosadores; o app calcula a proteína. ✎ edita os valores conforme o rótulo · 🗑 exclui.
      </Text>

      {sources.map((s) => (
        <Pressable
          key={s.id}
          style={styles.sourceRow}
          onPress={() => onLog(s)}
          onLongPress={() => openSource(s)}
        >
          <View style={styles.sourceIcon}>
            <Ionicons name="nutrition" size={20} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.sourceName}>{s.name}</Text>
            <Text style={styles.sourceSub}>
              {s.mode === 'gramas' ? 'informe o peso em gramas' : s.mode === 'unidades' ? `${s.portion} · informe quantos` : s.portion}
            </Text>
          </View>
          <Text style={styles.sourceGrams}>
            {s.mode === 'gramas' ? `${fmtG(s.protein_g)} g/100 g` : s.mode === 'unidades' ? `${fmtG(s.protein_g)} g cada` : `+${fmtG(s.protein_g)} g`}
          </Text>
          <Pressable onPress={() => openSource(s)} hitSlop={8} style={styles.sourceAction}>
            <Ionicons name="create-outline" size={20} color={colors.textMuted} />
          </Pressable>
          <Pressable onPress={() => removeSource(s)} hitSlop={8} style={styles.sourceAction}>
            <Ionicons name="trash-outline" size={19} color={colors.danger} />
          </Pressable>
        </Pressable>
      ))}

      <Button title="Lançar outra coisa (gramas livres)" variant="secondary" onPress={openFree} />

      <Text style={[styles.sectionTitle, { marginTop: spacing.lg, marginBottom: spacing.sm }]}>
        Lançamentos de hoje
      </Text>
      {entries.length === 0 ? (
        <Card>
          <Text style={styles.emptyText}>Nenhum lançamento ainda hoje.</Text>
        </Card>
      ) : (
        entries.map((e) => (
          <View key={e.id} style={styles.entryRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.entryMain}>
                {e.label} · {fmtG(e.protein_g)} g
              </Text>
              <Text style={styles.entryMeta}>{formatTime(e.consumed_at)}</Text>
            </View>
            <Pressable onPress={() => removeEntry(e.id)} style={styles.removeBtn}>
              <Ionicons name="close" size={18} color={colors.danger} />
            </Pressable>
          </View>
        ))
      )}

      <Modal visible={sourceOpen} animationType="slide" transparent onRequestClose={() => setSourceOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>{editing ? 'Editar fonte' : 'Nova fonte'}</Text>
            <Input label="Nome" value={srcName} onChangeText={setSrcName} placeholder="Ex.: Frango" error={srcErrors.name} />
            <Text style={styles.modeLabel}>Como lançar</Text>
            <View style={styles.chipsRow}>
              {MODES.map((m) => (
                <Pressable
                  key={m.id}
                  onPress={() => setSrcMode(m.id)}
                  style={[styles.chip, srcMode === m.id && styles.chipOn]}
                >
                  <Text style={[styles.chipText, srcMode === m.id && styles.chipTextOn]}>{m.label}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.modeHint}>{MODES.find((m) => m.id === srcMode)!.hint}</Text>
            {srcMode !== 'gramas' && (
              <Input
                label={srcMode === 'unidades' ? 'Unidade' : 'Porção'}
                value={srcPortion}
                onChangeText={setSrcPortion}
                placeholder={srcMode === 'unidades' ? 'Ex.: 1 dosador (15 g)' : 'Ex.: 1 unidade'}
                error={srcErrors.portion}
              />
            )}
            <Input
              label={
                srcMode === 'gramas'
                  ? 'Proteína a cada 100 g (g)'
                  : srcMode === 'unidades'
                    ? 'Proteína por unidade (g)'
                    : 'Proteína por porção (g)'
              }
              value={srcGrams}
              onChangeText={setSrcGrams}
              keyboardType="decimal-pad"
              placeholder="24"
              error={srcErrors.grams}
            />
            <View style={styles.modalBtns}>
              <Button title="Cancelar" variant="secondary" onPress={() => setSourceOpen(false)} style={{ flex: 1 }} />
              <Button title="Salvar" onPress={saveSource} style={{ flex: 1 }} />
            </View>
            {editing && (
              <Button title="Excluir fonte" variant="ghost" onPress={() => removeSource()} style={{ marginTop: spacing.sm }} />
            )}
          </View>
        </View>
      </Modal>

      <Modal visible={!!qtySource} animationType="slide" transparent onRequestClose={() => setQtySource(null)}>
        <View style={styles.modalBackdrop}>
          {qtySource && qtySource.mode !== 'porcao' && (
            <View style={styles.modal}>
              <Text style={styles.modalTitle}>{qtySource.name}</Text>
              <Text style={styles.modeHint}>
                {qtySource.mode === 'gramas'
                  ? `${fmtG(qtySource.protein_g)} g de proteína a cada 100 g. Pese a carne já pronta (cozida, grelhada ou assada).`
                  : `${fmtG(qtySource.protein_g)} g de proteína por ${unidadeDe(qtySource.portion)} · ${qtySource.portion}.`}
              </Text>
              <View style={styles.chipsRow}>
                {ATALHOS[qtySource.mode].map((n) => (
                  <Pressable
                    key={n}
                    onPress={() => {
                      setQtyValue(String(n));
                      setQtyError(null);
                    }}
                    style={[styles.chip, parseGrams(qtyValue) === n && styles.chipOn]}
                  >
                    <Text style={[styles.chipText, parseGrams(qtyValue) === n && styles.chipTextOn]}>
                      {qtySource.mode === 'gramas' ? `${n} g` : String(n)}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Input
                label={qtySource.mode === 'gramas' ? 'Quantos gramas' : `Quantos (${unidadeDe(qtySource.portion)})`}
                value={qtyValue}
                onChangeText={(v) => {
                  setQtyValue(v);
                  setQtyError(null);
                }}
                keyboardType="decimal-pad"
                placeholder={qtySource.mode === 'gramas' ? '150' : '2'}
                error={qtyError}
                autoFocus
              />
              <Text style={styles.qtyResult}>
                {parseGrams(qtyValue) > 0
                  ? `= ${fmtG(proteinOf(qtySource, parseGrams(qtyValue)))} g de proteína`
                  : ' '}
              </Text>
              <View style={styles.modalBtns}>
                <Button title="Cancelar" variant="secondary" onPress={() => setQtySource(null)} style={{ flex: 1 }} />
                <Button title="Lançar" onPress={saveQty} style={{ flex: 1 }} />
              </View>
            </View>
          )}
        </View>
      </Modal>

      <Modal visible={freeOpen} animationType="slide" transparent onRequestClose={() => setFreeOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Lançamento avulso</Text>
            <Input label="O que foi (opcional)" value={freeLabel} onChangeText={setFreeLabel} placeholder="Ex.: Frango grelhado" />
            <Input
              label="Proteína (g)"
              value={freeGrams}
              onChangeText={setFreeGrams}
              keyboardType="decimal-pad"
              placeholder="30"
              error={freeError}
            />
            <View style={styles.modalBtns}>
              <Button title="Cancelar" variant="secondary" onPress={() => setFreeOpen(false)} style={{ flex: 1 }} />
              <Button title="Lançar" onPress={saveFree} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={goalOpen} animationType="fade" transparent onRequestClose={() => setGoalOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Meta proteica diária</Text>
            <Input
              label="Meta (g)"
              value={goalDraft}
              onChangeText={setGoalDraft}
              keyboardType="numeric"
              hint="Use o valor prescrito pelo seu médico/nutricionista"
            />
            <View style={styles.modalBtns}>
              <Button title="Cancelar" variant="secondary" onPress={() => setGoalOpen(false)} style={{ flex: 1 }} />
              <Button title="Salvar" onPress={saveGoal} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  cardLabel: {
    color: colors.textMuted,
    fontSize: 11,
    letterSpacing: 1.5,
    fontWeight: '600',
  },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.sm },
  totalValue: { color: colors.text, fontSize: 36, fontWeight: '800', marginTop: 2 },
  unit: { color: colors.textMuted, fontSize: 18, fontWeight: '600' },
  goalLine: { color: colors.textMuted, fontSize: 13 },
  pctLine: { color: colors.textMuted, fontSize: 12, marginTop: spacing.xs, textAlign: 'right' },
  editGoalBtn: { padding: spacing.xs },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
  helpText: { color: colors.textMuted, fontSize: 12, marginBottom: spacing.sm },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: spacing.xs },
  addBtnText: { color: colors.primary, fontWeight: '700' },
  emptyText: { color: colors.textMuted, fontSize: 13, textAlign: 'center' },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  sourceIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sourceName: { color: colors.text, fontWeight: '700', fontSize: 15 },
  sourceSub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  sourceGrams: { color: colors.primary, fontWeight: '800', fontSize: 15 },
  sourceAction: { paddingLeft: spacing.md },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.xs,
  },
  entryMain: { color: colors.text, fontSize: 15, fontWeight: '700' },
  entryMeta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  removeBtn: { padding: spacing.xs },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: spacing.md,
  },
  modal: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: spacing.md,
  },
  modeLabel: { color: colors.textMuted, fontSize: 13, fontWeight: '600', marginBottom: spacing.xs },
  modeHint: { color: colors.textMuted, fontSize: 12, marginBottom: spacing.md },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text, fontWeight: '700', fontSize: 14 },
  chipTextOn: { color: colors.bg },
  qtyResult: { color: colors.primary, fontWeight: '800', fontSize: 16, marginBottom: spacing.sm },
  modalBtns: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
});
