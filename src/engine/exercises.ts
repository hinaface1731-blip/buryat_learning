import type { MinimalPair, Sentence, VowelRowId, VowelRows, Word } from '@/content/schema';

import { normalizeAnswer } from './check';
import { shuffle, type Rng } from './rng';
import type { Exercise, Stage, StudyItem } from './types';
import { vowelRowOf } from './vowels';

// Генераторы упражнений. Каждый берёт данные только из пулов курса и возвращает null,
// если для упражнения не хватает данных (нет аудио, нет перевода, мало дистракторов).

const meaningsOverlap = (a: StudyItem, b: StudyItem) => {
  const set = new Set(a.accepted.map(normalizeAnswer));
  return b.accepted.some((m) => set.has(normalizeAnswer(m)));
};

const sameBuryat = (a: StudyItem, b: StudyItem) => normalizeAnswer(a.buryat) === normalizeAnswer(b.buryat);

/** Дистракторы: сначала из юнита, затем из всего курса; без синонимов и омографов цели. */
export function pickDistractors(target: StudyItem, pools: StudyItem[][], n: number, rng: Rng, field: 'buryat' | 'russian'): StudyItem[] {
  const chosen: StudyItem[] = [];
  const used = new Set([normalizeAnswer(target[field])]);
  for (const pool of pools) {
    const candidates = shuffle(
      pool.filter((it) => it.kind === target.kind && it.id !== target.id && !meaningsOverlap(it, target) && !sameBuryat(it, target)),
      rng,
    );
    for (const c of candidates) {
      if (chosen.length >= n) return chosen;
      const k = normalizeAnswer(c[field]);
      if (used.has(k)) continue;
      used.add(k);
      chosen.push(c);
    }
  }
  return chosen;
}

const MIN_DISTRACTORS = 2;

export function multipleChoice(
  item: StudyItem,
  direction: 'bur-ru' | 'ru-bur',
  pools: StudyItem[][],
  rng: Rng,
  stage: Stage,
): Exercise | null {
  const field = direction === 'bur-ru' ? 'russian' : 'buryat';
  const distractors = pickDistractors(item, pools, 3, rng, field);
  if (distractors.length < MIN_DISTRACTORS) return null;
  const answer = item[field];
  return {
    key: `mc-${direction}-${item.id}`,
    stage,
    type: 'multiple_choice',
    item,
    direction,
    prompt: direction === 'bur-ru' ? item.buryat : item.russian,
    options: shuffle([answer, ...distractors.map((d) => d[field])], rng),
    answer,
  };
}

export function matchPairs(items: StudyItem[], rng: Rng, stage: Stage): Exercise | null {
  const picked: StudyItem[] = [];
  for (const it of shuffle(items, rng)) {
    if (picked.length >= 5) break;
    if (picked.some((p) => sameBuryat(p, it) || normalizeAnswer(p.russian) === normalizeAnswer(it.russian))) continue;
    picked.push(it);
  }
  if (picked.length < 3) return null;
  return {
    key: `match-${picked.map((p) => p.id).join('+')}`,
    stage,
    type: 'match_pairs',
    items: picked,
    left: shuffle(picked.map((p) => p.buryat), rng),
    right: shuffle(picked.map((p) => p.russian), rng),
  };
}

export function typeAnswer(item: StudyItem, stage: Stage): Exercise | null {
  if (item.kind !== 'word') return null;
  return { key: `type-${item.id}`, stage, type: 'type_answer', item, prompt: item.russian, answers: [item.buryat] };
}

export function minimalPairChoose(pair: MinimalPair, words: Map<string, Word>, rng: Rng, stage: Stage): Exercise | null {
  if (!pair.usable || !pair.a || !pair.b) return null;
  const a = words.get(pair.a);
  const b = words.get(pair.b);
  if (!a || !b || a.excluded || b.excluded) return null;
  const [target, other] = rng() < 0.5 ? [a, b] : [b, a];
  return {
    key: `mp-${pair.id}-${target.id}`,
    stage,
    type: 'minimal_pair_choose',
    pair,
    target,
    other,
    prompt: target.russian,
    options: shuffle([target.buryat, other.buryat], rng),
    answer: target.buryat,
  };
}

export function listenAndChoose(item: StudyItem, hasAudio: (id: string) => boolean, pools: StudyItem[][], rng: Rng, stage: Stage): Exercise | null {
  if (!hasAudio(item.id)) return null;
  const distractors = pickDistractors(item, pools, 3, rng, 'buryat');
  if (distractors.length < MIN_DISTRACTORS) return null;
  return {
    key: `listen-${item.id}`,
    stage,
    type: 'listen_and_choose',
    item,
    audioId: item.id,
    options: shuffle([item.buryat, ...distractors.map((d) => d.buryat)], rng),
    answer: item.buryat,
  };
}

export function categorize(items: StudyItem[], vowelRows: VowelRows, rng: Rng, stage: Stage): Exercise | null {
  const classified: { item: StudyItem; row: VowelRowId }[] = [];
  for (const item of shuffle(items, rng)) {
    const row = item.kind === 'word' ? vowelRowOf(item.buryat, vowelRows) : null;
    if (row) classified.push({ item, row });
  }
  const picked = classified.slice(0, 6);
  const rows = [...new Set(picked.map((p) => p.row))];
  if (picked.length < 4 || rows.length < 2) return null;
  const order = ['back', 'front', 'neutral'] as const;
  return {
    key: `cat-${picked.map((p) => p.item.id).join('+')}`,
    stage,
    type: 'categorize',
    items: picked,
    rows: order.filter((r) => rows.includes(r)),
  };
}

export function sentenceTokens(text: string): string[] {
  return text
    .split(/\s+/)
    .map((t) => t.replace(/^[«"(—–]+|[.,!?;:»")]+$/g, ''))
    .filter((t) => t && !/^[—–-]$/.test(t));
}

export function buildSentence(sentence: Sentence, rng: Rng, stage: Stage): Exercise | null {
  if (sentence.translation === null || sentence.excluded) return null;
  const answer = sentenceTokens(sentence.buryat);
  if (answer.length < 2) return null;
  let tokens = shuffle(answer, rng);
  if (tokens.join(' ') === answer.join(' ')) tokens = [...answer].reverse();
  return { key: `sent-${sentence.id}`, stage, type: 'build_sentence', sentence, prompt: sentence.translation, tokens, answer };
}
