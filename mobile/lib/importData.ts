import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { syncMedicationAlarms } from './alarms';
import { getDb } from './db';
import { addResult, attachBase64, createExam, findExam, ResultInput } from './repos/exams';
import { createMedication, listMedications, recordIntake } from './repos/medications';
import { ExamCategory } from './types';

/**
 * Importação de um pacote de dados pessoais (.json) — remédios com horários e exames com
 * valores e anexos. Existe pra levar dados de saúde pro aparelho SEM passar pelo código
 * (o repositório é público). Idempotente: remédio com o mesmo nome e exame com mesma
 * data+título são pulados, então importar duas vezes não duplica.
 */

type ImportMedication = {
  name: string;
  dosage?: string;
  notes?: string;
  color?: string;
  times?: string[];
  /** 0=domingo..6=sábado; ausente = todo dia. */
  weekday?: number;
  /** Tomadas já feitas (yyyy-MM-dd HH:mm:ss, horário local). */
  intakes?: string[];
};

type ImportExam = {
  date: string;
  title: string;
  category: ExamCategory;
  place?: string;
  notes?: string;
  results?: ResultInput[];
  files?: { name: string; mime: string; base64: string }[];
};

type Pacote = { fittracker_import: 1; medications?: ImportMedication[]; exams?: ImportExam[] };

export type ResultadoImport = {
  medsCriados: number;
  medsPulados: string[];
  examesCriados: number;
  examesPulados: number;
  anexos: number;
};

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

/** Abre o seletor de arquivos; null se o usuário cancelar. */
export async function escolherEImportar(userId: number): Promise<ResultadoImport | null> {
  const r = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'text/plain', '*/*'],
    copyToCacheDirectory: true,
  });
  if (r.canceled || !r.assets[0]) return null;
  const texto = await FileSystem.readAsStringAsync(r.assets[0].uri);
  await FileSystem.deleteAsync(r.assets[0].uri, { idempotent: true });
  let pacote: Pacote;
  try {
    pacote = JSON.parse(texto);
  } catch {
    throw new Error('Arquivo inválido: não é um JSON.');
  }
  if (pacote?.fittracker_import !== 1) throw new Error('Este arquivo não é um pacote do FitTracker.');
  return importar(userId, pacote);
}

async function importar(userId: number, p: Pacote): Promise<ResultadoImport> {
  const out: ResultadoImport = { medsCriados: 0, medsPulados: [], examesCriados: 0, examesPulados: 0, anexos: 0 };

  const existentes = new Set((await listMedications(userId)).map((m) => norm(m.name)));
  for (const m of p.medications ?? []) {
    if (existentes.has(norm(m.name))) {
      out.medsPulados.push(m.name);
      continue;
    }
    const criado = await createMedication({
      user_id: userId,
      name: m.name,
      dosage: m.dosage ?? null,
      notes: m.notes ?? null,
      color: m.color ?? null,
      reminder_times: m.times ?? null,
      reminder_weekday: m.weekday ?? null,
    });
    for (const at of m.intakes ?? []) await recordIntake(criado.id, at);
    existentes.add(norm(m.name));
    out.medsCriados++;
  }

  for (const e of p.exams ?? []) {
    if (await findExam(userId, e.date, e.title)) {
      out.examesPulados++;
      continue;
    }
    const id = await createExam(userId, {
      exam_date: e.date,
      title: e.title,
      category: e.category,
      place: e.place,
      notes: e.notes,
    });
    for (const r of e.results ?? []) await addResult(id, r);
    for (const f of e.files ?? []) {
      await attachBase64(id, f.base64, f.name, f.mime);
      out.anexos++;
    }
    out.examesCriados++;
  }

  // Garante o WAL no arquivo antes de um eventual backup e reagenda os alarmes.
  await (await getDb()).execAsync('PRAGMA wal_checkpoint(PASSIVE);').catch(() => {});
  if (out.medsCriados > 0) await syncMedicationAlarms(userId);
  return out;
}
