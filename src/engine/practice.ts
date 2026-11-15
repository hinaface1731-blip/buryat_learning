import { normalizeAnswer } from './check';
import { degrade } from '@/lib/buryat';
import type { Content } from '@/content/load';
import type { Conversation } from '@/content/schema';
import type { Card } from '@/srs/sm2';

import { buildReview } from './lesson';
import { categorize, dialogueScene, listenAndChoose, matchPairs, minimalPairChoose, multipleChoice, speakRepeat } from './exercises';
import { itemFromWord } from './pool';
import type { Pools } from './pool';
import { createRng, sample, shuffle, type Rng } from './rng';
import type { Exercise, StudyItem } from './types';

// Практикум: отдельные тренировки по направлениям. Каждая собирает короткую сессию
// из уже существующих упражнений; урок не засчитывается, ответы идут в повторение.

export type PracticeSection = 'words' | 'listening' | 'speaking' | 'grammar' | 'mistakes' | 'dialogues' | 'talk' | 'event';

export const SECTION_TITLES: Record<PracticeSection, string> = {
  words: 'Тренировка слов',
  listening: 'Аудирование',
  speaking: 'Произношение',
  grammar: 'Грамматика',
  mistakes: 'Работа над ошибками',
  dialogues: 'Диалог',
  talk: 'Разговор',
  event: 'Праздничная тренировка',
};

export const PRACTICE_SIZE = 10;

export type PracticeOptions = { hasAudio: (id: string) => boolean; cards: Record<string, Card>; seed: number };

const notNull = <T>(x: T | null): x is T => x !== null;

/** Сначала то, что человек уже видел в уроках, потом остальное — чтобы тренировка не превращалась в экзамен по новому. */
function learnedFirst(items: StudyItem[], cards: Record<string, Card>, rng: Rng): StudyItem[] {
  const seen = shuffle(items.filter((it) => it.id in cards), rng);
  const fresh = shuffle(items.filter((it) => !(it.id in cards)), rng);
  return [...seen, ...fresh];
}

function withAudio(pools: Pools, hasAudio: (id: string) => boolean): StudyItem[] {
  return [...pools.itemById.values()].filter((it) => it.kind === 'word' && hasAudio(it.id));
}

export function buildListening(pools: Pools, opts: PracticeOptions): Exercise[] {
  const rng = createRng(opts.seed);
  const pool = [pools.courseItems];
  return learnedFirst(withAudio(pools, opts.hasAudio), opts.cards, rng)
    .map((it) => listenAndChoose(it, opts.hasAudio, pool, rng, 'control'))
    .filter(notNull)
    .slice(0, PRACTICE_SIZE);
}

export function buildSpeaking(pools: Pools, opts: PracticeOptions): Exercise[] {
  const rng = createRng(opts.seed);
  return learnedFirst(withAudio(pools, opts.hasAudio), opts.cards, rng)
    .map((it) => speakRepeat(it, opts.hasAudio, 'control'))
    .filter(notNull)
    .slice(0, 6);
}

/** Грамматика и фонетика: правило, затем пары и ряды гласных на словах из уроков. */
export function buildGrammar(content: Content, pools: Pools, opts: PracticeOptions): Exercise[] {
  const rng = createRng(opts.seed);
  const notes = sample(content.notes, 1, rng).map((note): Exercise => ({ key: `note-${note.id}`, stage: 'intro', type: 'note', note }));
  const pairs = sample(
    content.minimalPairs.filter((p) => p.usable),
    5,
    rng,
  )
    .map((p) => minimalPairChoose(p, content.wordById, rng, 'control'))
    .filter(notNull);
  const words = learnedFirst(pools.courseItems, opts.cards, rng).slice(0, 30);
  const rows = [categorize(words, content.vowelRows, rng, 'control'), categorize(words.slice(6), content.vowelRows, rng, 'control')].filter(notNull);
  return [...notes, ...shuffle([...pairs, ...rows], rng)];
}

/** Слабые места: слова с ошибками в истории, сначала самые трудные. */
export function weakIds(cards: Record<string, Card>, limit = 15): string[] {
  return Object.entries(cards)
    .filter(([, c]) => c.lapses > 0 || c.ease < 2.3)
    .sort(([, a], [, b]) => b.lapses - a.lapses || a.ease - b.ease)
    .slice(0, limit)
    .map(([id]) => id);
}

export function buildMistakes(content: Content, pools: Pools, opts: PracticeOptions): Exercise[] {
  const ids = weakIds(opts.cards).filter((id) => pools.itemById.has(id) || content.sentenceById.has(id));
  const repsById = Object.fromEntries(ids.map((id) => [id, opts.cards[id].reps]));
  return buildReview(ids, content, pools, { hasAudio: opts.hasAudio, repsById, seed: opts.seed });
}

/** Сцена разговора отдельно от урока: те же реплики, другие варианты ответа. */
export function buildDialogue(dialogueId: string, content: Content, pools: Pools, opts: PracticeOptions): Exercise[] {
  const dialogue = content.dialogueById.get(dialogueId);
  if (!dialogue) return [];
  const rng = createRng(opts.seed);
  // Неверные варианты — реплики той же главы, как в уроке, а не отдельные слова.
  const lesson = content.course.units.flatMap((u) => u.lessons).find((l) => l.dialogueId === dialogueId);
  const phrases = [...pools.itemById.values()].filter((it) => it.kind === 'word' && it.word.tags.includes('phrase'));
  const scene = dialogueScene(dialogue, pools.itemById, [lesson ? (pools.sceneItemsByLesson.get(lesson.id) ?? []) : [], phrases], rng);
  return scene ? [scene] : [];
}

/** Разговор целиком — одно задание: шаги идут внутри него. */
export function buildTalk(conv: Conversation | undefined): Exercise[] {
  return conv ? [{ key: `talk-${conv.id}`, stage: 'control', type: 'conversation', conv }] : [];
}

/** Тренировка события: слова праздника — пары, затем выбор или «на слух», где есть запись. */
export function buildEvent(wordIds: string[], content: Content, pools: Pools, opts: PracticeOptions): Exercise[] {
  const rng = createRng(opts.seed);
  const items = wordIds.flatMap((id) => {
    const w = content.wordById.get(id);
    return w && !w.excluded ? [itemFromWord(w)] : [];
  });
  const pool = [items, pools.courseItems];
  const match = matchPairs(sample(items, 5, rng), rng, 'training');
  const rest = items.map((it) => listenAndChoose(it, opts.hasAudio, pool, rng, 'control') ?? multipleChoice(it, 'ru-bur', pool, rng, 'control')).filter(notNull);
  return [...(match ? [match] : []), ...shuffle(rest, rng).slice(0, PRACTICE_SIZE - 1)];
}

/** Тренировка словаря учитывает подборку, поиск и фильтр освоенных слов. */
export function buildWords(content: Content, pools: Pools, opts: PracticeOptions, selection: { collection?: string; query?: string; learnedOnly?: boolean } = {}): Exercise[] {
  const q = normalizeAnswer(selection.query ?? '');
  const dq = degrade(q);
  const unit = content.course.units.find((u) => u.id === selection.collection && !u.locked);
  if (selection.collection && selection.collection !== 'audio' && !unit) return [];
  const ids = unit ? new Set(unit.lessons.flatMap((l) => l.wordIds)) : null;
  const candidates = content.words.filter((w) => {
    if (w.excluded || !pools.itemById.has(w.id)) return false;
    if (ids && !ids.has(w.id)) return false;
    if (selection.collection === 'audio' && !opts.hasAudio(w.id)) return false;
    if (selection.learnedOnly && (opts.cards[w.id]?.reps ?? 0) < 2) return false;
    return !q || [w.buryat, w.russian, ...w.alternatives].some((s) => normalizeAnswer(s).includes(q) || degrade(normalizeAnswer(s)).includes(dq));
  });
  const chosen = sample(candidates, PRACTICE_SIZE, createRng(opts.seed)).map((w) => w.id);
  return buildReview(chosen, content, pools, { ...opts, repsById: Object.fromEntries(chosen.map((id) => [id, opts.cards[id]?.reps ?? 0])) });
}
