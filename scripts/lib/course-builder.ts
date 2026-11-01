import type { Course, Lesson, Letter, MinimalPair, Sentence, Unit, Word } from '../../src/content/schema';

// Раскладка единиц по юнитам и урокам. Порядок — как в книге; размер урока ~8 новых слов.

const WORDS_PER_LESSON = 5;
const LETTERS_PER_LESSON = 6;

/** Слово годится для уроков: не исключено, не подозревается в опечатке, не служебная помета. */
export function isTeachable(w: Word): boolean {
  if (w.excluded) return false;
  if (w.verified || w.tags.includes('route')) return true; // реплики маршрута отобраны вручную
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

type WordUnitSpec = { id: string; title: string; description: string; noteIds: string[]; words: Word[]; pairs: MinimalPair[]; sentences: Sentence[]; thematic?: boolean; badge?: string };

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
  if (last && !spec.thematic) {
    last.categorize = true;
    last.noteIds = [...new Set([...last.noteIds, 'note-vowel-harmony'])];
  }
  return { id: spec.id, title: spec.title, description: spec.description, locked: false, lessons, ...(spec.badge ? { badge: spec.badge } : {}) };
}

export const THEMATIC_UNITS: [string, string][] = [
  ['semya', 'Семья'],
  ['eda', 'Еда'],
  ['dom', 'Дом'],
  ['zhivotnye', 'Животные'],
  ['priroda', 'Природа'],
  ['shkola', 'Школа'],
  ['chisla', 'Числа'],
  ['tsveta', 'Цвета'],
  ['odezhda', 'Одежда'],
  ['chasti-tela', 'Части тела'],
];

const THEMATIC_INFO: Record<string, { description: string; badge?: string }> = {
  semya: { description: 'Отец, мать, братья и сёстры.', badge: 'badge-family' },
  eda: { description: 'Позы, чай, хлеб и молоко.', badge: 'badge-tea' },
  dom: { description: 'Что вокруг вас дома.', badge: 'badge-family' },
  zhivotnye: { description: 'Домашние животные.', badge: 'badge-journey' },
  priroda: { description: 'Солнце, лес и озеро.', badge: 'badge-journey' },
  shkola: { description: 'Книга, тетрадь, учитель.', badge: 'badge-speech' },
};

export type RouteMeta = { n: number; title: string; skill: string; wordIds: string[]; dialogueId: string };

/** Глава-разговор идёт первой: человек сразу получает понятные фразы, а фонетика — следом. */
function routeUnit(route: RouteMeta[], words: Word[]): Unit {
  const usable = new Set(words.filter(isTeachable).map((w) => w.id));
  return {
    id: 'route',
    title: 'Первые разговоры',
    description: 'Поздороваться, представиться, рассказать о семье, заказать чай.',
    locked: false,
    badge: 'badge-speech',
    lessons: route.map((r) => ({
      ...emptyLesson(`route-l${r.n}`, r.title),
      wordIds: r.wordIds.filter((id) => usable.has(id)),
      skill: r.skill,
      dialogueId: r.dialogueId,
    })),
  };
}

export function buildCourse(input: { words: Word[]; pairs: MinimalPair[]; sentences: Sentence[]; letters: Letter[]; route: RouteMeta[] }): Course {
  const teachable = input.words.filter(isTeachable);
  const byLesson = (n: number) => teachable.filter((w) => w.source.book === 'bxr-textbook' && w.source.lesson === n);
  const introWords = teachable.filter((w) => w.source.book === 'bxr-textbook' && w.source.lesson === undefined && !w.tags.includes('route'));
  const usable = input.pairs.filter((p) => p.usable);
  const softPairs = usable.filter((p) => p.contrast === 'soft');
  const otherPairs = usable.filter((p) => p.contrast !== 'soft');
  const softWordIds = new Set(softPairs.flatMap((p) => [p.a, p.b]));
  const sentencesOf = (n: number) => input.sentences.filter((s) => s.source.lesson === n && !s.excluded);
  const uniq = (ws: Word[]) => [...new Map(ws.map((w) => [w.id, w])).values()];

  const letterChunks = chunk(input.letters.filter((l) => !l.special), LETTERS_PER_LESSON);
  const alphabet: Unit = {
    id: 'u1',
    title: 'Алфавит и особые буквы Ү Ө Һ',
    description: '36 букв и их названия; три буквы, которых нет в русском.',
    locked: false,
    lessons: [
      // Первое занятие короткое: три буквы, которых нет в русском. Весь алфавит — после него.
      {
        ...emptyLesson('u1-l1', 'Ү, Ө, Һ'),
        noteIds: ['note-special-sounds'],
        letterIds: input.letters.filter((l) => l.special).map((l) => l.id),
      },
      ...letterChunks.map((ls, i) => ({
        ...emptyLesson(`u1-l${i + 2}`, `Буквы ${ls[0].upper || ls[0].lower}–${ls[ls.length - 1].upper || ls[ls.length - 1].lower}`),
        noteIds: i === 0 ? ['note-alphabet'] : [],
        letterIds: ls.map((l) => l.id),
      })),
    ],
  };

  const thematic = THEMATIC_UNITS.map(([id, title]): Unit => {
    const info = THEMATIC_INFO[id];
    const words = teachable.filter((w) => w.tags.includes(`unit:${id}`));
    if (words.length === 0) {
      return { id: `t-${id}`, title, description: 'Скоро.', locked: true, lessons: [] };
    }
    return wordUnit({ id: `t-${id}`, title, description: info?.description ?? '', noteIds: [], words, pairs: [], sentences: [], thematic: true, badge: info?.badge });
  });

  const units: Unit[] = [
    ...(input.route.length ? [routeUnit(input.route, input.words)] : []),
    // Сначала живая лексика с картинками, затем системная фонетика; закрытые темы — в конце.
    ...thematic.filter((u) => !u.locked),
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
    ...thematic.filter((u) => u.locked),
  ];

  return { id: 'buryat-mvp', title: 'Бурятский язык с нуля', units };
}
