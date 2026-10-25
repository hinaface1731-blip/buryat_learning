import type { Course, Lesson, Letter, MinimalPair, Sentence, Unit, Word } from '../../src/content/schema';

// Раскладка единиц по юнитам и урокам. Порядок — как в книге; размер урока ~8 новых слов.

const WORDS_PER_LESSON = 8;

/** Слово годится для уроков: не исключено, не подозревается в опечатке, не служебная помета. */
export function isTeachable(w: Word): boolean {
  if (w.excluded) return false;
  if (w.verified) return true;
  if (w.possible_typo) return false;
  return !w.review_reasons.some((r) => r === 'помета в переводе' || r === 'перевод не на русском' || r.startsWith('символы вне алфавита'));
}

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  // Хвост меньше половины урока присоединяем к предыдущему.
  if (out.length > 1 && out[out.length - 1].length < size / 2) {
    const tail = out.pop()!;
    out[out.length - 1].push(...tail);
  }
  return out;
}

const emptyLesson = (id: string, title: string): Lesson => ({
  id,
  title,
  noteIds: [],
  wordIds: [],
  minimalPairIds: [],
  letterIds: [],
  sentenceIds: [],
  categorize: false,
});

type WordUnitSpec = { id: string; title: string; description: string; noteIds: string[]; words: Word[]; pairs: MinimalPair[]; sentences: Sentence[] };

function wordUnit(spec: WordUnitSpec): Unit {
  const chunks = chunk(spec.words, WORDS_PER_LESSON);
  const lessons = chunks.map((ws, i) => ({
    ...emptyLesson(`${spec.id}-l${i + 1}`, `Урок ${i + 1}`),
    noteIds: i === 0 ? spec.noteIds : [],
    wordIds: ws.map((w) => w.id),
  }));
  spec.pairs.forEach((p, i) => lessons[i % lessons.length]?.minimalPairIds.push(p.id));
  for (const s of spec.sentences) lessons[lessons.length - 1]?.sentenceIds.push(s.id);
  const last = lessons[lessons.length - 1];
  if (last) {
    last.categorize = true;
    last.noteIds = [...new Set([...last.noteIds, 'note-vowel-harmony'])];
  }
  return { id: spec.id, title: spec.title, description: spec.description, locked: false, lessons };
}

export const THEMATIC_UNITS: [string, string][] = [
  ['znakomstvo', 'Знакомство'],
  ['semya', 'Семья'],
  ['chisla', 'Числа'],
  ['tsveta', 'Цвета'],
  ['eda', 'Еда'],
  ['odezhda', 'Одежда'],
  ['zhivotnye', 'Животные'],
  ['chasti-tela', 'Части тела'],
  ['dom', 'Дом'],
];

export function buildCourse(input: { words: Word[]; pairs: MinimalPair[]; sentences: Sentence[]; letters: Letter[] }): Course {
  const teachable = input.words.filter(isTeachable);
  const byLesson = (n: number) => teachable.filter((w) => w.source.book === 'bxr-textbook' && w.source.lesson === n);
  const introWords = teachable.filter((w) => w.source.book === 'bxr-textbook' && w.source.lesson === undefined);
  const usable = input.pairs.filter((p) => p.usable);
  const softPairs = usable.filter((p) => p.contrast === 'soft');
  const otherPairs = usable.filter((p) => p.contrast !== 'soft');
  const softWordIds = new Set(softPairs.flatMap((p) => [p.a, p.b]));
  const sentencesOf = (n: number) => input.sentences.filter((s) => s.source.lesson === n && !s.excluded);
  const uniq = (ws: Word[]) => [...new Map(ws.map((w) => [w.id, w])).values()];

  const letterChunks = chunk(input.letters.filter((l) => !l.special), 11);
  const alphabet: Unit = {
    id: 'u1',
    title: 'Алфавит и особые буквы Ү Ө Һ',
    description: '36 букв и их названия; три буквы, которых нет в русском.',
    locked: false,
    lessons: [
      ...letterChunks.map((ls, i) => ({
        ...emptyLesson(`u1-l${i + 1}`, `Буквы ${ls[0].upper || ls[0].lower}–${ls[ls.length - 1].upper || ls[ls.length - 1].lower}`),
        noteIds: i === 0 ? ['note-alphabet'] : [],
        letterIds: ls.map((l) => l.id),
      })),
      {
        ...emptyLesson(`u1-l${letterChunks.length + 1}`, 'Ү, Ө, Һ'),
        noteIds: ['note-special-sounds'],
        letterIds: input.letters.filter((l) => l.special).map((l) => l.id),
      },
    ],
  };

  const units: Unit[] = [
    alphabet,
    wordUnit({
      id: 'u2',
      title: 'Звуки һ, ү, өө, н',
      description: 'Урок 1 учебника: особые звуки и два звука н.',
      noteIds: ['note-special-sounds', 'note-n'],
      words: byLesson(1),
      pairs: [],
      sentences: sentencesOf(1),
    }),
    wordUnit({
      id: 'u3',
      title: 'Йотированные гласные',
      description: 'Урок 2 учебника: я, е, ю, ё и долгие яа, ёо, еэ, юу.',
      noteIds: ['note-iotated'],
      words: uniq([...byLesson(2), ...introWords.filter((w) => softWordIds.has(w.id))]),
      pairs: softPairs,
      sentences: sentencesOf(2),
    }),
    wordUnit({
      id: 'u4',
      title: 'Краткие и долгие гласные',
      description: 'Урок 3 учебника и §7–8 введения: минимальные пары.',
      noteIds: ['note-short-long'],
      words: uniq([...byLesson(3), ...introWords.filter((w) => !softWordIds.has(w.id))]),
      pairs: otherPairs,
      sentences: sentencesOf(3),
    }),
    wordUnit({
      id: 'u5',
      title: 'Дифтонги',
      description: 'Урок 4 учебника: ай, ой, уй, эй, үй.',
      noteIds: ['note-diphthongs'],
      words: byLesson(4),
      pairs: [],
      sentences: sentencesOf(4),
    }),
    ...THEMATIC_UNITS.map(([id, title]): Unit => {
      const words = teachable.filter((w) => w.source.book === 'native-speaker' && w.tags.includes(`unit:${id}`));
      if (words.length === 0) {
        return {
          id: `t-${id}`,
          title,
          description: 'Слова добавит носитель языка.',
          locked: true,
          lessons: [],
        };
      }
      return wordUnit({ id: `t-${id}`, title, description: 'Слова от носителя языка.', noteIds: [], words, pairs: [], sentences: [] });
    }),
  ];

  return { id: 'buryat-mvp', title: 'Бурятский язык с нуля', units };
}
