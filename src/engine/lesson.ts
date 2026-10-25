import type { Content } from '@/content/load';

import { buildSentence, categorize, listenAndChoose, matchPairs, minimalPairChoose, multipleChoice, typeAnswer } from './exercises';
import type { Pools } from './pool';
import { createRng, sample, seedFrom, shuffle } from './rng';
import type { Exercise } from './types';

// Урок по методике «знакомство → тренировка → применение → контроль» (Дареева, 2025):
// карточка «Что нужно знать», знакомство с каждой единицей, выбор и сопоставление,
// ввод, смешанный контроль. При ~8 новых единицах это 25–35 шагов, 5–7 минут.

export type BuildOptions = { seed?: number; hasAudio: (id: string) => boolean };

const notNull = <T>(x: T | null): x is T => x !== null;

export function buildLesson(lessonId: string, content: Content, pools: Pools, opts: BuildOptions): Exercise[] {
  const lesson = content.course.units.flatMap((u) => u.lessons).find((l) => l.id === lessonId);
  if (!lesson) throw new Error(`Нет урока ${lessonId}`);
  const rng = createRng(opts.seed ?? seedFrom(lessonId));
  const items = pools.lessonItems.get(lessonId) ?? [];
  const distractorPools = [pools.unitItemsByLesson.get(lessonId) ?? [], pools.courseItems];
  const pairs = lesson.minimalPairIds.map((id) => content.pairById.get(id)!).filter((p) => p.usable);
  const sentences = lesson.sentenceIds.map((id) => content.sentenceById.get(id)!).filter((s) => s.translation !== null && !s.excluded);

  const notes: Exercise[] = lesson.noteIds.map((id) => ({ key: `note-${id}`, stage: 'intro', type: 'note', note: content.noteById.get(id)! }));
  const intro: Exercise[] = items.map((item) => ({ key: `intro-${item.id}`, stage: 'intro', type: 'intro', item }));

  const training: Exercise[] = [
    ...shuffle(items, rng).map((it) => multipleChoice(it, 'bur-ru', distractorPools, rng, 'training')),
    matchPairs(items, rng, 'training'),
    ...pairs.map((p) => minimalPairChoose(p, content.wordById, rng, 'training')),
  ].filter(notNull);

  const application: Exercise[] = sample(items, 4, rng)
    .map((it) => typeAnswer(it, 'application'))
    .filter(notNull);

  const control: Exercise[] = shuffle(
    [
      ...sample(items, 5, rng).map((it) => multipleChoice(it, 'ru-bur', distractorPools, rng, 'control')),
      ...sample(items, 3, rng).map((it) => listenAndChoose(it, opts.hasAudio, distractorPools, rng, 'control')),
      ...sample(pairs, 2, rng).map((p) => minimalPairChoose(p, content.wordById, rng, 'control')),
      lesson.categorize ? categorize(pools.unitItemsByLesson.get(lessonId) ?? items, content.vowelRows, rng, 'control') : null,
      ...sample(sentences, 2, rng).map((s) => buildSentence(s, rng, 'control')),
    ].filter(notNull),
    rng,
  );

  return dedupeKeys([...notes, ...intro, ...training, ...application, ...control]);
}

/** Повторение: по одному упражнению на единицу; тип зависит от того, насколько единица уже знакома. */
export function buildReview(itemIds: string[], content: Content, pools: Pools, opts: BuildOptions & { repsById: Record<string, number> }): Exercise[] {
  const rng = createRng(opts.seed ?? seedFrom(itemIds.join('|')));
  const out: Exercise[] = [];
  for (const id of itemIds) {
    const item = pools.itemById.get(id);
    if (!item) continue;
    const lessonId = [...pools.lessonItems].find(([, its]) => its.some((it) => it.id === id))?.[0];
    const distractorPools = [lessonId ? (pools.unitItemsByLesson.get(lessonId) ?? []) : [], pools.courseItems];
    const reps = opts.repsById[id] ?? 0;
    const candidates =
      reps >= 2
        ? [typeAnswer(item, 'control'), listenAndChoose(item, opts.hasAudio, distractorPools, rng, 'control'), multipleChoice(item, 'ru-bur', distractorPools, rng, 'control')]
        : [multipleChoice(item, reps === 0 ? 'bur-ru' : 'ru-bur', distractorPools, rng, 'control'), multipleChoice(item, 'bur-ru', distractorPools, rng, 'control')];
    const ex = candidates.find(notNull);
    if (ex) out.push(ex);
  }
  return dedupeKeys(shuffle(out, rng));
}

function dedupeKeys(list: Exercise[]): Exercise[] {
  const seen = new Map<string, number>();
  return list.map((ex) => {
    const n = seen.get(ex.key) ?? 0;
    seen.set(ex.key, n + 1);
    return n === 0 ? ex : { ...ex, key: `${ex.key}#${n}` };
  });
}
