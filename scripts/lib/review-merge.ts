import { foreignChars, translit } from '../../src/lib/buryat';
import type { Letter, Sentence, Word } from '../../src/content/schema';

import { THEMATIC_UNITS } from './course-builder';
import { parseBool, splitList } from './csv';

// Применение правок из CSV. Сопоставление строго по id; неизвестные id и неверные значения
// не применяются, а попадают в список ошибок.

export type Change = { id: string; field: string; from: string; to: string };
export type ReviewResult = { words: Word[]; sentences: Sentence[]; letters: Letter[]; changes: Change[]; errors: string[] };

const str = (v: unknown) => (Array.isArray(v) ? v.join(' | ') : v === null || v === undefined ? '' : String(v));

export function applyReviewRows(input: { words: Word[]; sentences: Sentence[]; letters: Letter[] }, rows: Record<string, string>[]): ReviewResult {
  const words = input.words.map((w) => ({ ...w }));
  const sentences = input.sentences.map((s) => ({ ...s }));
  const letters = input.letters.map((l) => ({ ...l }));
  const wordById = new Map(words.map((w) => [w.id, w]));
  const sentenceById = new Map(sentences.map((s) => [s.id, s]));
  const letterById = new Map(letters.map((l) => [l.id, l]));
  const changes: Change[] = [];
  const errors: string[] = [];

  const set = <T extends object, K extends keyof T & string>(obj: T, id: string, field: K, value: T[K]) => {
    if (str(obj[field]) === str(value)) return;
    changes.push({ id, field, from: str(obj[field]), to: str(value) });
    obj[field] = value;
  };
  const bool = (row: Record<string, string>, col: string, line: number): boolean | undefined => {
    if (!(col in row)) return undefined;
    const b = parseBool(row[col]);
    if (b === undefined) errors.push(`строка ${line}: ${col}="${row[col]}" — ожидается да/нет`);
    return b;
  };

  rows.forEach((row, i) => {
    const line = i + 2;
    const id = row.id?.trim();
    if (!id) {
      errors.push(`строка ${line}: нет id — строка пропущена (новые слова добавляются через шаблон носителя)`);
      return;
    }
    const word = wordById.get(id);
    const sentence = sentenceById.get(id);
    const letter = letterById.get(id);
    if (!word && !sentence && !letter) {
      errors.push(`строка ${line}: неизвестный id ${id}`);
      return;
    }
    const buryat = row.buryat?.trim();
    // Проверяем только изменённое написание: текст книги может содержать сбои (Γ), их правит человек.
    if ((word || sentence) && buryat !== undefined && buryat !== (word ?? sentence)!.buryat) {
      const foreign = foreignChars(buryat.replace(/[.,!?;:"«»()—–]/g, ''));
      if (!buryat) errors.push(`строка ${line}: пустое поле buryat у ${id}`);
      else if (foreign.length) errors.push(`строка ${line}: в buryat у ${id} символы вне алфавита: ${foreign.join(' ')}`);
    }
    const buryatOk = !!buryat && !errors.some((e) => e.startsWith(`строка ${line}:`));
    const verified = bool(row, 'verified', line);
    const excluded = bool(row, 'excluded', line);

    if (word) {
      if (buryatOk) set(word, id, 'buryat', buryat);
      if (row.russian) set(word, id, 'russian', row.russian.trim());
      if ('alternatives' in row) set(word, id, 'alternatives', splitList(row.alternatives));
      if ('form' in row) {
        const form = row.form.trim();
        if (form === '' || form === 'lemma' || form === 'form') set(word, id, 'form', form === '' ? null : form);
        else errors.push(`строка ${line}: form="${form}" — ожидается lemma, form или пусто`);
      }
      if (excluded !== undefined) set(word, id, 'excluded', excluded);
      if (verified !== undefined) set(word, id, 'verified', verified);
      if ('comment' in row) set(word, id, 'comment', row.comment);
      if (word.verified) {
        set(word, id, 'possible_typo', false);
        set(word, id, 'needs_review', false);
      }
    } else if (sentence) {
      if (buryatOk) set(sentence, id, 'buryat', buryat);
      if ('translation' in row) {
        const t = row.translation.trim();
        set(sentence, id, 'translation', t === '' ? null : t);
        set(sentence, id, 'needs_translation', t === '');
      }
      if (excluded !== undefined) set(sentence, id, 'excluded', excluded);
      if (verified !== undefined) {
        if (verified && sentence.translation === null) errors.push(`строка ${line}: ${id} нельзя подтвердить без перевода`);
        else set(sentence, id, 'verified', verified);
      }
      if ('comment' in row) set(sentence, id, 'comment', row.comment);
    } else if (letter) {
      if (row.russian) set(letter, id, 'name', row.russian.trim());
      if (verified !== undefined) {
        set(letter, id, 'verified', verified);
        if (verified) set(letter, id, 'needs_image_check', false);
      }
    }
  });

  return { words, sentences, letters, changes, errors };
}

export const THEMATIC_HEADER = ['unit', 'buryat', 'russian', 'alternatives', 'comment', 'speaker'];

/** Слова от носителя для тематических юнитов. verified остаётся false до вашего подтверждения. */
export function applyThematicRows(words: Word[], rows: Record<string, string>[]): { words: Word[]; added: Word[]; errors: string[] } {
  const unitByKey = new Map<string, string>();
  for (const [id, title] of THEMATIC_UNITS) {
    unitByKey.set(id, id);
    unitByKey.set(title.toLowerCase(), id);
  }
  const taken = new Set(words.map((w) => w.id));
  const origins = new Set(words.map((w) => `${w.origin.buryat}|${w.origin.russian}`.toLowerCase()));
  const added: Word[] = [];
  const errors: string[] = [];
  rows.forEach((row, i) => {
    const line = i + 2;
    const buryat = (row.buryat ?? '').trim();
    const russianRaw = (row.russian ?? '').trim();
    if (!buryat && !russianRaw) return;
    const unit = unitByKey.get((row.unit ?? '').trim().toLowerCase());
    if (!unit) return void errors.push(`строка ${line}: неизвестный юнит «${row.unit}» (варианты: ${THEMATIC_UNITS.map((u) => u[1]).join(', ')})`);
    if (!buryat || !russianRaw) return void errors.push(`строка ${line}: нужны и buryat, и russian`);
    const foreign = foreignChars(buryat);
    if (foreign.length) return void errors.push(`строка ${line}: символы вне алфавита в «${buryat}»: ${foreign.join(' ')}`);
    const originKey = `${buryat}|${russianRaw}`.toLowerCase();
    if (origins.has(originKey)) return;
    origins.add(originKey);
    let id = translit(buryat);
    for (let n = 2; taken.has(id); n++) id = `${translit(buryat)}-${n}`;
    taken.add(id);
    added.push({
      id,
      kind: 'word',
      buryat,
      russian: russianRaw,
      alternatives: splitList(row.alternatives ?? ''),
      source: { book: 'native-speaker', ...(row.speaker ? { section: row.speaker.trim() } : {}) },
      tags: [`unit:${unit}`],
      verified: false,
      needs_review: false,
      review_reasons: [],
      possible_typo: false,
      typo_candidates: [],
      form: null,
      excluded: false,
      comment: row.comment ?? '',
      origin: { buryat, russian: russianRaw },
    });
  });
  return { words: [...words, ...added], added, errors };
}
