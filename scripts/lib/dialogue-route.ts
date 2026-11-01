import { translit } from '../../src/lib/buryat';
import type { BookId, Dialogue, Word } from '../../src/content/schema';

// Разговорный маршрут из content/templates/dialogue-route.csv: реплики становятся словами курса
// (их можно править через общий CSV сверки), сцены — записями dialogues.json.

export type RouteLesson = { n: number; title: string; skill: string; dialogue: Dialogue; wordIds: string[] };

const SOURCES: Record<string, BookId> = { zugaa: 'zugaa', translator: 'translator', textbook: 'bxr-textbook' };

// Иллюстрация сцены по номеру урока маршрута.
const SCENE_ART: Record<number, string> = { 1: 'scene-baikal', 2: 'scene-baikal', 3: 'scene-baikal', 4: 'scene-baikal', 5: 'scene-baikal', 6: 'scene-road', 7: 'scene-family', 8: 'scene-family', 9: 'scene-cafe', 10: 'scene-cafe' };

const originKey = (buryat: string, russian: string) => `${buryat}|${russian}`.toLowerCase();

type RouteOptions = { dialogueId: (n: number) => string; art: (n: number, row: Record<string, string>) => string | undefined; tags: (n: number) => string[]; section: string };

const ROUTE_OPTIONS: RouteOptions = {
  dialogueId: (n) => `d-route-${n}`,
  art: (n) => SCENE_ART[n],
  tags: (n) => ['route', 'phrase', `route-lesson-${n}`],
  section: 'разговорный маршрут',
};

export function buildRoute(rows: Record<string, string>[], existing: Word[], opts: RouteOptions = ROUTE_OPTIONS): { words: Word[]; lessons: RouteLesson[]; added: number; errors: string[] } {
  const words = [...existing];
  const byOrigin = new Map(existing.map((w) => [originKey(w.origin.buryat, w.origin.russian), w]));
  const taken = new Set(existing.map((w) => w.id));
  const lessons = new Map<number, RouteLesson>();
  const seen = new Set<string>();
  const errors: string[] = [];
  let added = 0;

  rows.forEach((row, i) => {
    const line = i + 2;
    const n = Number(row.lesson);
    const { role, russian, buryat } = row;
    if (!n || !russian || !buryat || !['partner', 'learner', 'extra'].includes(role)) {
      errors.push(`строка ${line}: нужны lesson, role, russian и buryat`);
      return;
    }
    const book = SOURCES[row.source];
    if (!book) {
      errors.push(`строка ${line}: неизвестный source «${row.source}»`);
      return;
    }
    let lesson = lessons.get(n);
    if (!lesson) {
      lesson = { n, title: row.title, skill: row.skill, wordIds: [], dialogue: { id: opts.dialogueId(n), title: row.title, scene: row.scene, art: opts.art(n, row), lines: [] } };
      lessons.set(n, lesson);
    }
    let word = byOrigin.get(originKey(buryat, russian));
    if (!word) {
      const base = translit(buryat).slice(0, 48).replace(/-$/, '');
      let id = base;
      for (let k = 2; taken.has(id); k++) id = `${base}-${k}`;
      taken.add(id);
      word = {
        id,
        kind: 'word',
        buryat,
        russian,
        alternatives: [],
        source: { book, section: opts.section },
        tags: opts.tags(n),
        verified: false,
        needs_review: book === 'translator',
        review_reasons: book === 'translator' ? ['машинный перевод'] : [],
        possible_typo: false,
        typo_candidates: [],
        form: null,
        excluded: false,
        comment: [row.comment, row.back_translation ? `обратный перевод: ${row.back_translation}` : ''].filter(Boolean).join('; '),
        origin: { buryat, russian },
      };
      byOrigin.set(originKey(buryat, russian), word);
      words.push(word);
      added++;
    }
    if (role !== 'extra') lesson.dialogue.lines.push({ role: role as 'partner' | 'learner', wordId: word.id });
    // Новая в маршруте реплика вводится в первом уроке, где встретилась.
    if (!seen.has(word.id)) {
      seen.add(word.id);
      lesson.wordIds.push(word.id);
    }
  });

  return { words, lessons: [...lessons.values()].sort((a, b) => a.n - b.n), added, errors };
}

/** Сцены тематических глав из content/templates/thematic-scenes.csv: урок главы получает название-результат и итоговую сцену. */
export type ThematicScenes = Record<string, { n: number; title: string; skill: string; dialogueId: string }[]>;

export function buildThematicScenes(rows: Record<string, string>[], existing: Word[]): { words: Word[]; dialogues: Dialogue[]; scenes: ThematicScenes; added: number; errors: string[] } {
  const scenes: ThematicScenes = {};
  const dialogues: Dialogue[] = [];
  const errors: string[] = [];
  let words = existing;
  let added = 0;
  for (const unit of new Set(rows.map((r) => r.unit))) {
    const built = buildRoute(
      rows.filter((r) => r.unit === unit),
      words,
      {
        dialogueId: (n) => `d-${unit}-${n}`,
        art: (_, row) => row.art || undefined,
        tags: (n) => ['scene', 'phrase', `scene-${unit}-${n}`],
        section: `сцена главы, ${unit}`,
      },
    );
    words = built.words;
    added += built.added;
    errors.push(...built.errors.map((e) => `${unit}: ${e}`));
    dialogues.push(...built.lessons.map((l) => l.dialogue));
    scenes[unit] = built.lessons.map(({ n, title, skill, dialogue }) => ({ n, title, skill, dialogueId: dialogue.id }));
  }
  return { words, dialogues, scenes, added, errors };
}
