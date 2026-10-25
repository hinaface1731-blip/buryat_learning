import { addDays, type DateKey } from '@/lib/dates';

// Упрощённый SM-2. Оценки: верно → 5, почти верно → 3, неверно → 1.
// При q < 3 карточка начинается заново (интервал 1 день), лёгкость падает.

export type Card = {
  ease: number;
  /** Интервал в днях. */
  interval: number;
  reps: number;
  lapses: number;
  due: DateKey;
  lastReviewed: DateKey | null;
};

export type Grade = 'correct' | 'almost' | 'wrong';

export const QUALITY: Record<Grade, number> = { correct: 5, almost: 3, wrong: 1 };
export const MIN_EASE = 1.3;

export function newCard(today: DateKey): Card {
  return { ease: 2.5, interval: 0, reps: 0, lapses: 0, due: today, lastReviewed: null };
}

export function review(card: Card, grade: Grade, today: DateKey): Card {
  const q = QUALITY[grade];
  const ease = Math.max(MIN_EASE, card.ease + 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  if (q < 3) {
    return { ease, interval: 1, reps: 0, lapses: card.lapses + 1, due: addDays(today, 1), lastReviewed: today };
  }
  const reps = card.reps + 1;
  const interval = reps === 1 ? 1 : reps === 2 ? 6 : Math.round(card.interval * ease);
  return { ease, interval, reps, lapses: card.lapses, due: addDays(today, interval), lastReviewed: today };
}

export function isDue(card: Card, today: DateKey): boolean {
  return card.due <= today;
}

/** Карточки к повторению: сначала самые просроченные, затем с меньшей лёгкостью. */
export function dueIds(cards: Record<string, Card>, today: DateKey, limit = 20): string[] {
  return Object.entries(cards)
    .filter(([, c]) => isDue(c, today))
    .sort(([, a], [, b]) => (a.due === b.due ? a.ease - b.ease : a.due < b.due ? -1 : 1))
    .slice(0, limit)
    .map(([id]) => id);
}
