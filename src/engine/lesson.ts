import type { Content } from '@/content/load';
import type { Dialogue } from '@/content/schema';

import { buildPhrase, buildSentence, categorize, dialogueScene, listenAndChoose, matchPairs, minimalPairChoose, multipleChoice, pictureChoice, typeAnswer } from './exercises';
import type { Pools } from './pool';
import { createRng, sample, seedFrom, shuffle, type Rng } from './rng';
import type { Exercise, SceneOpening } from './types';

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

  const dialogue = lesson.dialogueId ? content.dialogueById.get(lesson.dialogueId) : undefined;
  const scene = dialogue ? dialogueScene(dialogue, pools.itemById, [pools.sceneItemsByLesson.get(lessonId) ?? [], ...pool], rng) : null;

  const match = matchPairs(items, rng, 'training');
  const rest = [
    ...sample(items, items.length, rng).map((it) => pictureChoice(it, pool, rng, 'training')).filter(notNull).slice(0, 3),
    ...sample(pairs, 2, rng).map((p) => minimalPairChoose(p, content.wordById, rng, 'training')),
    // Реплику собирают из слов; вводить целиком — только короткие.
    ...sample(items, 2, rng).map((it) => (dialogue ? (buildPhrase(it, rng, 'application') ?? typeAnswer(it, 'application')) : typeAnswer(it, 'application'))),
    ...sample(items, 1, rng).map((it) => listenAndChoose(it, opts.hasAudio, pool, rng, 'control')),
    lesson.categorize ? categorize(pools.unitItemsByLesson.get(lessonId) ?? items, content.vowelRows, rng, 'control') : null,
    ...sample(sentences, 1, rng).map((s) => buildSentence(s, rng, 'control')),
  ].filter(notNull);

  // На первый вопрос по новым единицам остаётся то, что не заняли остальные задания.
  const reserved = rest.length + (match ? 1 : 0) + (scene ? 1 : 0);
  const room = MAX_TASKS - reserved;
  const asked = items.slice(0, Math.max(0, room));
  const stream: Exercise[] = items.flatMap((item, i): Exercise[] => {
    const q = asked.includes(item) ? multipleChoice(item, 'bur-ru', pool, rng, 'training') : null;
    const opening = dialogue && item.kind === 'word' && item.word.tags.includes('phrase') ? openingOf(item.id, dialogue, i === 0) : undefined;
    return [{ key: `intro-${item.id}`, stage: 'intro', type: 'intro', item, ...(opening ? { opening } : {}) }, ...(q ? [q] : [])];
  });

  const left = MAX_TASKS - reserved - stream.filter((e) => e.type === 'multiple_choice').length;
  const control = sample(items, Math.max(0, left), rng)
    .map((it) => multipleChoice(it, 'ru-bur', pool, rng, 'control'))
    .filter(notNull);

  // Сцена — всегда в конце: в ней пригождается всё, что только что выучили.
  return dedupeKeys([...notes, ...stream, ...(match ? [match] : []), ...shuffle([...rest, ...control], rng), ...(scene ? [scene] : [])]);
}

/** Кто произносит реплику: партнёр — Сэсэг, всё остальное говорит сам ученик. */
function openingOf(id: string, dialogue: Dialogue, first: boolean): SceneOpening {
  const speaker = dialogue.lines.find((l) => l.wordId === id)?.role === 'partner' ? 'seseg' : 'bair';
  return first ? { speaker, art: dialogue.art, scene: dialogue.scene } : { speaker };
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
      ? [buildPhrase(item, rng, 'control') ?? typeAnswer(item, 'control'), listenAndChoose(item, opts.hasAudio, pool, rng, 'control'), multipleChoice(item, 'ru-bur', pool, rng, 'control')]
      : [multipleChoice(item, reps === 0 ? 'bur-ru' : 'ru-bur', pool, rng, 'control'), pictureChoice(item, pool, rng, 'control'), listenAndChoose(item, opts.hasAudio, pool, rng, 'control')];
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
