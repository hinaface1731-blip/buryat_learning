import type { Exercise, Outcome } from './types';

// Состояние прохождения урока/повторения. Чистые функции — UI только хранит состояние.

export type Grade = 'correct' | 'almost' | 'wrong';

export type SessionState = {
  queue: Exercise[];
  index: number;
  /** Ключи упражнений, уже возвращённых в конец очереди после ошибки (повтор — один раз). */
  requeued: string[];
  answered: number;
  correct: number;
  /** Худший результат по каждой единице за сессию — идёт в SRS. */
  itemGrades: Record<string, Grade>;
  mistakes: string[];
};

const RANK: Record<Grade, number> = { wrong: 0, almost: 1, correct: 2 };

export const isGraded = (ex: Exercise) => ex.type !== 'note' && ex.type !== 'intro';

export function startSession(queue: Exercise[]): SessionState {
  return { queue, index: 0, requeued: [], answered: 0, correct: 0, itemGrades: {}, mistakes: [] };
}

export function currentExercise(s: SessionState): Exercise | null {
  return s.queue[s.index] ?? null;
}

export function isFinished(s: SessionState): boolean {
  return s.index >= s.queue.length;
}

/** Переход дальше. Для карточек (note/intro) outcome не нужен. */
export function advance(s: SessionState, outcome?: Outcome): SessionState {
  const ex = currentExercise(s);
  if (!ex) return s;
  if (!outcome || !isGraded(ex)) return { ...s, index: s.index + 1 };

  const itemGrades = { ...s.itemGrades };
  const mistakes = [...s.mistakes];
  for (const [id, grade] of Object.entries(outcome.perItem)) {
    const prev = itemGrades[id];
    if (!prev || RANK[grade] < RANK[prev]) itemGrades[id] = grade;
    if (grade === 'wrong' && !mistakes.includes(id)) mistakes.push(id);
  }
  const queue = [...s.queue];
  const requeued = [...s.requeued];
  const baseKey = ex.key.replace(/~retry$/, '');
  if (outcome.result === 'wrong' && !requeued.includes(baseKey)) {
    requeued.push(baseKey);
    queue.push({ ...ex, key: `${baseKey}~retry` });
  }
  return {
    ...s,
    queue,
    requeued,
    index: s.index + 1,
    answered: s.answered + 1,
    correct: s.correct + (outcome.result === 'wrong' ? 0 : 1),
    itemGrades,
    mistakes,
  };
}

export function accuracy(s: SessionState): number {
  return s.answered === 0 ? 1 : s.correct / s.answered;
}

export const XP = { lessonComplete: 10, reviewComplete: 5, perCorrect: 1 } as const;

export function sessionXp(s: SessionState, kind: 'lesson' | 'review'): number {
  return (kind === 'lesson' ? XP.lessonComplete : XP.reviewComplete) + s.correct * XP.perCorrect;
}

export function progressOf(s: SessionState): number {
  return s.queue.length === 0 ? 1 : Math.min(1, s.index / s.queue.length);
}
