import type { Content } from '@/content/load';

import { buildSentence, categorize, listenAndChoose, matchPairs, minimalPairChoose, multipleChoice, typeAnswer } from './exercises';
import type { Pools } from './pool';
import { createRng, sample, seedFrom, shuffle, type Rng } from './rng';
import type { Exercise } from './types';

// Короткое занятие на 2–4 минуты: каждая новая единица сразу закрепляется вопросом,
// затем чередуются сопоставление, пары, ввод и контроль. Заданий — не больше MAX_TASKS.

export const MAX_TASKS = 12;

export type BuildOptions = { seed?: number; hasAudio: (id: string) => boolean };

const notNull = <T>(x: T | null): x is T => x !== null;

export function buildLesson(lessonId: string, content: Content, pools: Pools, opts: BuildOptions): Exercise[] {
  const lesson = content.course.units.flatMap((u) => u.lessons).find((l) => l.id === lessonId);
  if (!lesson) throw new Error(`Нет урока ${lessonId}`);
  const rng = createRng(opts.seed ?? seedFrom(lessonId));
  const items = pools.lessonItems.get(lessonId) ?? [];
  const pool = [pools.unitItemsByLesson.get(lessonId) ?? [], pools.courseItems];
  const pairs = lesson.minimalPairIds.map((id) => content.pairById.get(id)!).filter((p) => p.usable);
  const sentences = lesson.sentenceIds.map((id) => content.sentenceById.get(id)!).filter((s) => s.translation !== null && !s.excluded);

  const notes: Exercise[] = lesson.noteIds.map((id) => ({ key: `note-${id}`, stage: 'intro', type: 'note', note: content.noteById.get(id)! }));

  const match = matchPairs(items, rng, 'training');
  const rest = [
    ...sample(pairs, 2, rng).map((p) => minimalPairChoose(p, content.wordById, rng, 'training')),
    ...sample(items, 2, rng).map((it) => typeAnswer(it, 'application')),
    ...sample(items, 1, rng).map((it) => listenAndChoose(it, opts.hasAudio, pool, rng, 'control')),
    lesson.categorize ? categorize(pools.unitItemsByLesson.get(lessonId) ?? items, content.vowelRows, rng, 'control') : null,
    ...sample(sentences, 1, rng).map((s) => buildSentence(s, rng, 'control')),
  ].filter(notNull);

  // На первый вопрос по новым единицам остаётся то, что не заняли остальные задания.
  const room = MAX_TASKS - rest.length - (match ? 1 : 0);
  const asked = items.slice(0, Math.max(0, room));
  const stream: Exercise[] = items.flatMap((item): Exercise[] => {
    const q = asked.includes(item) ? multipleChoice(item, 'bur-ru', pool, rng, 'training') : null;
    return [{ key: `intro-${item.id}`, stage: 'intro', type: 'intro', item }, ...(q ? [q] : [])];
  });

  const left = MAX_TASKS - rest.length - (match ? 1 : 0) - stream.filter((e) => e.type === 'multiple_choice').length;
  const control = sample(items, Math.max(0, left), rng)
    .map((it) => multipleChoice(it, 'ru-bur', pool, rng, 'control'))
    .filter(notNull);

  return dedupeKeys([...notes, ...stream, ...(match ? [match] : []), ...shuffle([...rest, ...control], rng)]);
}

function reviewCandidates(id: string, reps: number, content: Content, pools: Pools, opts: BuildOptions, rng: Rng): Exercise[] {
  const sentence = content.sentenceById.get(id);
  if (sentence) return [buildSentence(sentence, rng, 'control')].filter(notNull);
  const item = pools.itemById.get(id);
  if (!item) return [];
  const lessonId = [...pools.lessonItems].find(([, its]) => its.some((it) => it.id === id))?.[0];
  const pool = [lessonId ? (pools.unitItemsByLesson.get(lessonId) ?? []) : [], pools.courseItems];
  const list =
    reps >= 2
      ? [typeAnswer(item, 'control'), listenAndChoose(item, opts.hasAudio, pool, rng, 'control'), multipleChoice(item, 'ru-bur', pool, rng, 'control')]
      : [multipleChoice(item, reps === 0 ? 'bur-ru' : 'ru-bur', pool, rng, 'control'), listenAndChoose(item, opts.hasAudio, pool, rng, 'control')];
  return list.filter(notNull);
}

/** Повторение: по одному заданию на единицу. Сложность растёт с опытом, тип не повторяется подряд. */
export function buildReview(itemIds: string[], content: Content, pools: Pools, opts: BuildOptions & { repsById: Record<string, number> }): Exercise[] {
  const rng = createRng(opts.seed ?? seedFrom(itemIds.join('|')));
  const out: Exercise[] = [];
  for (const id of shuffle(itemIds, rng)) {
    const options = shuffle(reviewCandidates(id, opts.repsById[id] ?? 0, content, pools, opts, rng), rng);
    const prev = out[out.length - 1]?.type;
    const ex = options.find((o) => o.type !== prev) ?? options[0];
    if (ex) out.push(ex);
  }
  return dedupeKeys(out);
}

function dedupeKeys(list: Exercise[]): Exercise[] {
  const seen = new Map<string, number>();
  return list.map((ex) => {
    const n = seen.get(ex.key) ?? 0;
    seen.set(ex.key, n + 1);
    return n === 0 ? ex : { ...ex, key: `${ex.key}#${n}` };
  });
}
