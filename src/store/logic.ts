import { addDays, type DateKey } from '@/lib/dates';
import { newCard, review, type Card, type Grade } from '@/srs/sm2';

// Чистая логика прогресса: XP по дням, серия, дневная цель, сердечки, SRS.
// Стор (zustand) только вызывает эти функции — так всё покрывается тестами.

export type DailyGoal = 10 | 20 | 30 | 50;
export const DAILY_GOALS: DailyGoal[] = [10, 20, 30, 50];
export const HEARTS_PER_DAY = 5;

export type ProgressState = {
  xpByDate: Record<DateKey, number>;
  completedLessons: Record<string, { bestAccuracy: number; lastCompleted: DateKey }>;
  cards: Record<string, Card>;
  hearts: { count: number; date: DateKey };
};

export const initialProgress = (today: DateKey): ProgressState => ({
  xpByDate: {},
  completedLessons: {},
  cards: {},
  hearts: { count: HEARTS_PER_DAY, date: today },
});

export function applySrs(cards: Record<string, Card>, grades: Record<string, Grade>, today: DateKey): Record<string, Card> {
  const next = { ...cards };
  for (const [id, grade] of Object.entries(grades)) {
    next[id] = review(next[id] ?? newCard(today), grade, today);
  }
  return next;
}

export function addXp(state: ProgressState, xp: number, today: DateKey): ProgressState {
  return { ...state, xpByDate: { ...state.xpByDate, [today]: (state.xpByDate[today] ?? 0) + xp } };
}

export function completeLesson(
  state: ProgressState,
  r: { lessonId: string; accuracy: number; xp: number; grades: Record<string, Grade> },
  today: DateKey,
): ProgressState {
  const prev = state.completedLessons[r.lessonId];
  return {
    ...addXp(state, r.xp, today),
    cards: applySrs(state.cards, r.grades, today),
    completedLessons: {
      ...state.completedLessons,
      [r.lessonId]: { bestAccuracy: Math.max(prev?.bestAccuracy ?? 0, r.accuracy), lastCompleted: today },
    },
  };
}

export function completeReview(state: ProgressState, r: { xp: number; grades: Record<string, Grade> }, today: DateKey): ProgressState {
  return { ...addXp(state, r.xp, today), cards: applySrs(state.cards, r.grades, today) };
}

export function goalMet(state: ProgressState, goal: number, day: DateKey): boolean {
  return (state.xpByDate[day] ?? 0) >= goal;
}

/**
 * Серия — подряд идущие дни с выполненной целью. Если сегодня цель ещё не выполнена,
 * серия не обнуляется до конца дня (считаем от вчера).
 */
export function streak(state: ProgressState, goal: number, today: DateKey): number {
  let day = goalMet(state, goal, today) ? today : addDays(today, -1);
  let n = 0;
  while (goalMet(state, goal, day)) {
    n++;
    day = addDays(day, -1);
  }
  return n;
}

export function heartsToday(state: ProgressState, today: DateKey): number {
  return state.hearts.date === today ? state.hearts.count : HEARTS_PER_DAY;
}

export function loseHeart(state: ProgressState, today: DateKey): ProgressState {
  return { ...state, hearts: { count: Math.max(0, heartsToday(state, today) - 1), date: today } };
}
