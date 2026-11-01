import { addDays, type DateKey } from '@/lib/dates';
import { newCard, review, type Card, type Grade } from '@/srs/sm2';

// Чистая логика прогресса: XP по дням, серия, дневная цель, сердечки, SRS.
// Стор (zustand) только вызывает эти функции — так всё покрывается тестами.

export type DailyGoal = 10 | 20 | 30 | 50;
export const DAILY_GOALS: DailyGoal[] = [10, 20, 30, 50];
export const HEARTS_PER_DAY = 5;
/** Ниже этой точности занятие завершено, но материал не считается освоенным. */
export const MASTERY_THRESHOLD = 0.7;

export type ProgressState = {
  xpByDate: Record<DateKey, number>;
  /** Дни, когда цель была выполнена — по цели того дня; смена цели прошлое не меняет. */
  goalMetDays: Record<DateKey, true>;
  completedLessons: Record<string, { bestAccuracy: number; lastCompleted: DateKey }>;
  cards: Record<string, Card>;
  hearts: { count: number; date: DateKey };
};

export const initialProgress = (today: DateKey): ProgressState => ({
  xpByDate: {},
  goalMetDays: {},
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

export function addXp(state: ProgressState, xp: number, today: DateKey, goal: number): ProgressState {
  const total = (state.xpByDate[today] ?? 0) + xp;
  return {
    ...state,
    xpByDate: { ...state.xpByDate, [today]: total },
    goalMetDays: total >= goal ? { ...state.goalMetDays, [today]: true } : state.goalMetDays,
  };
}

export function completeLesson(
  state: ProgressState,
  r: { lessonId: string; accuracy: number; xp: number; grades: Record<string, Grade> },
  today: DateKey,
  goal: number,
): ProgressState {
  const prev = state.completedLessons[r.lessonId];
  return {
    ...addXp(state, r.xp, today, goal),
    cards: applySrs(state.cards, r.grades, today),
    completedLessons: {
      ...state.completedLessons,
      [r.lessonId]: { bestAccuracy: Math.max(prev?.bestAccuracy ?? 0, r.accuracy), lastCompleted: today },
    },
  };
}

export function completeReview(state: ProgressState, r: { xp: number; grades: Record<string, Grade> }, today: DateKey, goal: number): ProgressState {
  return { ...addXp(state, r.xp, today, goal), cards: applySrs(state.cards, r.grades, today) };
}

/** Сегодня цель можно выполнить и понижением цели; прошлые дни зафиксированы. */
export function goalMet(state: ProgressState, goal: number, day: DateKey, today: DateKey = day): boolean {
  if (state.goalMetDays[day]) return true;
  return day === today && (state.xpByDate[day] ?? 0) >= goal;
}

/**
 * Серия — подряд идущие дни с выполненной целью. Если сегодня цель ещё не выполнена,
 * серия не обнуляется до конца дня (считаем от вчера).
 */
export function streak(state: ProgressState, goal: number, today: DateKey): number {
  let day = goalMet(state, goal, today, today) ? today : addDays(today, -1);
  let n = 0;
  while (goalMet(state, goal, day, today)) {
    n++;
    day = addDays(day, -1);
  }
  return n;
}

/** Миграция старого сохранения: дни считаем по цели на момент обновления — истории целей не было. */
export function goalDaysFromXp(xpByDate: Record<DateKey, number>, goal: number): Record<DateKey, true> {
  const out: Record<DateKey, true> = {};
  for (const [day, xp] of Object.entries(xpByDate)) if (xp >= goal) out[day] = true;
  return out;
}

export function heartsToday(state: ProgressState, today: DateKey): number {
  return state.hearts.date === today ? state.hearts.count : HEARTS_PER_DAY;
}

export function loseHeart(state: ProgressState, today: DateKey): ProgressState {
  return { ...state, hearts: { count: Math.max(0, heartsToday(state, today) - 1), date: today } };
}
