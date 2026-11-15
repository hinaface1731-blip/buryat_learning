import { normalizeAnswer } from '../../src/engine/check';
import { translit } from '../../src/lib/buryat';
import type { BookId, Word } from '../../src/content/schema';

// Слова аудиокурса из content/templates/audio-words.csv: бурятское написание — по словарю,
// место в записи найдено распознаванием речи и проверено повторным распознаванием клипа.

/** Темы радиоуроков «Буряад FM» по номерам. */
export const AUDIO_THEMES: Record<number, string> = {
  1: 'Знакомство',
  2: 'Откуда вы родом',
  3: 'Числа',
  4: 'Возраст и внешность',
  5: 'Семья',
  6: 'Цвета и действия',
  7: 'Части тела',
  8: 'Одежда',
  9: 'Еда',
  10: 'На кухне',
  11: 'Дом',
  12: 'Домашние животные',
  13: 'Растения',
  14: 'Время',
  15: 'Природа',
  16: 'Погода',
  17: 'Дикие животные',
  18: 'Город и село',
  19: 'Рынок и день',
  20: 'Праздники',
};

export const audioTag = (n: number) => `audio:${n}`;

export type ClipRow = { id: string; file: string; start: string; end: string; status: string; comment: string };

const sameWord = (w: Word, buryat: string, russian: string) =>
  normalizeAnswer(w.buryat) === normalizeAnswer(buryat) && [w.russian, ...w.alternatives].some((r) => normalizeAnswer(r) === normalizeAnswer(russian));

export function importAudioWords(rows: Record<string, string>[], existing: Word[]): { words: Word[]; clips: ClipRow[]; added: number; reused: number; errors: string[] } {
  const words = existing.map((w) => ({ ...w, tags: w.tags.filter((t) => !t.startsWith('audio:')) }));
  const taken = new Set(words.map((w) => w.id));
  const clips: ClipRow[] = [];
  const errors: string[] = [];
  let added = 0;
  let reused = 0;
  rows.forEach((row, i) => {
    if (row.status === 'skip') return;
    const n = Number(row.lesson);
    const { buryat, russian, file } = row;
    if (!AUDIO_THEMES[n] || !buryat || !russian || !file) {
      errors.push(`строка ${i + 2}: нужны lesson (1–20), buryat, russian, file`);
      return;
    }
    let word = words.find((w) => sameWord(w, buryat, russian));
    if (word) {
      reused++;
    } else {
      const base = translit(buryat).slice(0, 48).replace(/-$/, '');
      let id = base;
      for (let k = 2; taken.has(id); k++) id = `${base}-${k}`;
      taken.add(id);
      const book: BookId = file.includes('mixdown') ? 'burfm-audio' : 'kids-audio';
      word = {
        id,
        kind: 'word',
        buryat,
        russian,
        alternatives: [],
        source: { book, section: `${file.replace(/\.mp3$/, '')}, ${row.start} с` },
        tags: buryat.includes(' ') ? ['phrase'] : [],
        verified: false,
        needs_review: false,
        review_reasons: [],
        possible_typo: false,
        typo_candidates: [],
        form: null,
        excluded: false,
        comment: 'написание по словарю, звучание — из аудиоурока',
        origin: { buryat, russian },
      };
      words.push(word);
      added++;
    }
    if (!word.tags.includes(audioTag(n))) word.tags.push(audioTag(n));
    clips.push({ id: word.id, file, start: row.start, end: row.end, status: '', comment: `аудиокурс: ${buryat} — ${russian}; ${row.comment}` });
  });
  return { words, clips, added, reused, errors };
}
