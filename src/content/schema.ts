import { z } from 'zod';

// Схемы контента курса. Бурятский текст попадает сюда только из источников
// (content/SOURCES.md) или от носителя через CSV; всё хранится с verified:false
// до подтверждения.

export const BookId = z.enum(['bxr-textbook', 'buryat-grammar-1962', 'native-speaker', 'manual']);
export type BookId = z.infer<typeof BookId>;

const SourceRef = z.object({
  book: BookId,
  page: z.number().int().positive().optional(),
  lesson: z.number().int().positive().optional(),
  /** Раздел введения («§7») или упражнение («упр. 3»). */
  section: z.string().optional(),
});

export const Source = SourceRef.extend({
  /** Другие места книги, где встречается та же единица. */
  also: z.array(SourceRef).optional(),
});
export type Source = z.infer<typeof Source>;

export const WordForm = z.enum(['lemma', 'form']);

export const Word = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  kind: z.literal('word'),
  buryat: z.string().min(1),
  russian: z.string().min(1),
  alternatives: z.array(z.string()),
  source: Source,
  tags: z.array(z.string()),
  verified: z.boolean(),
  needs_review: z.boolean(),
  review_reasons: z.array(z.string()),
  /** Возможная опечатка ү/у, ө/о, һ/х — решает человек, импорт ничего не правит. */
  possible_typo: z.boolean(),
  typo_candidates: z.array(z.string()),
  /** Словарная форма или форма из текста; заполняет носитель. */
  form: WordForm.nullable(),
  /** Не попадает в уроки (dated/sensitive или решение ревьюера). */
  excluded: z.boolean(),
  comment: z.string(),
});
export type Word = z.infer<typeof Word>;

export const Sentence = z.object({
  id: z.string().regex(/^s-[a-z0-9-]+$/),
  kind: z.literal('sentence'),
  buryat: z.string().min(1),
  translation: z.string().nullable(),
  needs_translation: z.boolean(),
  source: Source,
  tags: z.array(z.string()),
  verified: z.boolean(),
  excluded: z.boolean(),
  comment: z.string(),
});
export type Sentence = z.infer<typeof Sentence>;

export const PairContrast = z.enum(['length', 'quality', 'soft', 'other']);
export type PairContrast = z.infer<typeof PairContrast>;

export const MinimalPair = z.object({
  id: z.string().regex(/^mp-[a-z0-9-]+$/),
  a: z.string().nullable(),
  b: z.string().nullable(),
  a_text: z.string(),
  b_text: z.string(),
  contrast: PairContrast,
  source: Source,
  usable: z.boolean(),
  reasons: z.array(z.string()),
  verified: z.boolean(),
});
export type MinimalPair = z.infer<typeof MinimalPair>;

export const Letter = z.object({
  id: z.string().regex(/^letter-[a-z0-9-]+$/),
  upper: z.string(),
  lower: z.string(),
  name: z.string(),
  type: z.enum(['vowel', 'consonant', 'semivowel', 'sign']),
  special: z.boolean(),
  source: Source,
  verified: z.boolean(),
  needs_image_check: z.boolean(),
});
export type Letter = z.infer<typeof Letter>;

export const VowelRowId = z.enum(['back', 'front', 'neutral']);
export type VowelRowId = z.infer<typeof VowelRowId>;

export const VowelRows = z.object({
  rows: z.array(
    z.object({
      id: VowelRowId,
      label: z.string(),
      buryatTerm: z.string(),
      short: z.array(z.string()),
      long: z.array(z.string()),
      diphthongs: z.array(z.string()),
    }),
  ),
  /** Буквы, которые источник относит к разным рядам — автоподсказка их не использует. */
  ambiguous: z.array(z.string()),
  conflicts: z.array(z.string()),
  source: Source,
  verified: z.boolean(),
});
export type VowelRows = z.infer<typeof VowelRows>;

export const Note = z.object({
  id: z.string().regex(/^note-[a-z0-9-]+$/),
  title: z.string(),
  /** Русский текст; бурятские примеры только из источника. */
  body: z.string(),
  source: Source.nullable(),
  verified: z.boolean(),
});
export type Note = z.infer<typeof Note>;

export const Lesson = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string(),
  noteIds: z.array(z.string()),
  wordIds: z.array(z.string()),
  minimalPairIds: z.array(z.string()),
  letterIds: z.array(z.string()),
  sentenceIds: z.array(z.string()),
  categorize: z.boolean(),
});
export type Lesson = z.infer<typeof Lesson>;

export const Unit = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string(),
  description: z.string(),
  /** Тематический юнит ждёт слов от носителя. */
  locked: z.boolean(),
  lessons: z.array(Lesson),
});
export type Unit = z.infer<typeof Unit>;

export const Course = z.object({
  id: z.string(),
  title: z.string(),
  units: z.array(Unit),
});
export type Course = z.infer<typeof Course>;

export const Words = z.array(Word);
export const Sentences = z.array(Sentence);
export const MinimalPairs = z.array(MinimalPair);
export const Letters = z.array(Letter);
export const Notes = z.array(Note);
