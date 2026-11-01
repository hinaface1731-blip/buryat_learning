import alphabetJson from '../../content/alphabet.json';
import courseJson from '../../content/course.json';
import dialoguesJson from '../../content/dialogues.json';
import minimalPairsJson from '../../content/minimal-pairs.json';
import notesJson from '../../content/notes.json';
import sentencesJson from '../../content/sentences.json';
import vowelRowsJson from '../../content/vowel-rows.json';
import wordsJson from '../../content/words.json';

import {
  Course,
  Dialogue,
  Dialogues,
  Letter,
  Letters,
  MinimalPair,
  MinimalPairs,
  Note,
  Notes,
  Sentence,
  Sentences,
  VowelRows,
  Word,
  Words,
} from './schema';

export type Content = {
  course: Course;
  words: Word[];
  sentences: Sentence[];
  minimalPairs: MinimalPair[];
  letters: Letter[];
  notes: Note[];
  vowelRows: VowelRows;
  dialogues: Dialogue[];
  dialogueById: Map<string, Dialogue>;
  wordById: Map<string, Word>;
  sentenceById: Map<string, Sentence>;
  pairById: Map<string, MinimalPair>;
  letterById: Map<string, Letter>;
  noteById: Map<string, Note>;
};

export type RawContent = {
  course: unknown;
  words: unknown;
  sentences: unknown;
  minimalPairs: unknown;
  letters: unknown;
  notes: unknown;
  vowelRows: unknown;
  dialogues: unknown;
};

function indexById<T extends { id: string }>(items: T[], label: string): Map<string, T> {
  const map = new Map<string, T>();
  for (const item of items) {
    if (map.has(item.id)) throw new Error(`Дубликат id в ${label}: ${item.id}`);
    map.set(item.id, item);
  }
  return map;
}

/** Парсит контент схемами и проверяет ссылки между файлами. Бросает ошибку при первой проблеме. */
export function buildContent(raw: RawContent): Content {
  const course = Course.parse(raw.course);
  const words = Words.parse(raw.words);
  const sentences = Sentences.parse(raw.sentences);
  const minimalPairs = MinimalPairs.parse(raw.minimalPairs);
  const letters = Letters.parse(raw.letters);
  const notes = Notes.parse(raw.notes);
  const vowelRows = VowelRows.parse(raw.vowelRows);
  const dialogues = Dialogues.parse(raw.dialogues);

  const content: Content = {
    course,
    words,
    sentences,
    minimalPairs,
    letters,
    notes,
    vowelRows,
    dialogues,
    dialogueById: indexById(dialogues, 'dialogues'),
    wordById: indexById(words, 'words'),
    sentenceById: indexById(sentences, 'sentences'),
    pairById: indexById(minimalPairs, 'minimal-pairs'),
    letterById: indexById(letters, 'alphabet'),
    noteById: indexById(notes, 'notes'),
  };

  const errors = findBrokenRefs(content);
  if (errors.length) throw new Error(`Битые ссылки в контенте:\n${errors.join('\n')}`);
  return content;
}

export function findBrokenRefs(c: Content): string[] {
  const errors: string[] = [];
  const check = (map: Map<string, unknown>, id: string, where: string) => {
    if (!map.has(id)) errors.push(`${where}: нет ${id}`);
  };
  const lessonIds = new Set<string>();
  for (const unit of c.course.units) {
    for (const lesson of unit.lessons) {
      if (lessonIds.has(lesson.id)) errors.push(`повтор id урока ${lesson.id}`);
      lessonIds.add(lesson.id);
      const where = `${unit.id}/${lesson.id}`;
      lesson.wordIds.forEach((id) => check(c.wordById, id, where));
      lesson.noteIds.forEach((id) => check(c.noteById, id, where));
      lesson.minimalPairIds.forEach((id) => check(c.pairById, id, where));
      lesson.letterIds.forEach((id) => check(c.letterById, id, where));
      lesson.sentenceIds.forEach((id) => check(c.sentenceById, id, where));
      if (lesson.dialogueId) check(c.dialogueById, lesson.dialogueId, where);
    }
  }
  for (const d of c.dialogues) d.lines.forEach((l) => check(c.wordById, l.wordId, d.id));
  for (const pair of c.minimalPairs) {
    if (pair.a) check(c.wordById, pair.a, pair.id);
    if (pair.b) check(c.wordById, pair.b, pair.id);
  }
  return errors;
}

export const rawContent: RawContent = {
  course: courseJson,
  words: wordsJson,
  sentences: sentencesJson,
  minimalPairs: minimalPairsJson,
  letters: alphabetJson,
  notes: notesJson,
  vowelRows: vowelRowsJson,
  dialogues: dialoguesJson,
};

let cached: Content | null = null;

export function getContent(): Content {
  cached ??= buildContent(rawContent);
  return cached;
}
