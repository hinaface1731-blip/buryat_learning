import { addDays, diffDays, type DateKey } from '@/lib/dates';
import { seedFrom } from '@/engine/rng';

import type { ProgressState } from './logic';

// Задания дня и недельное испытание. Всё считается из прогресса — хранить нечего, кроме
// отметки «все задания дня выполнены» (questDays) для достижения.

export type Quest = { id: string; title: string; value: number; target: number; done: boolean };

type QuestSpec = { id: string; title: (n: number) => string; target: (goal: number) => number; measure: (p: ProgressState, today: DateKey) => number };

const today = <T extends { lastCompleted?: DateKey; lastReviewed?: DateKey | null }>(list: T[], day: DateKey, key: 'lastCompleted' | 'lastReviewed') => list.filter((x) => x[key] === day).length;

const POOL: QuestSpec[] = [
  { id: 'xp', title: (n) => `Наберите ${n} XP`, target: (goal) => goal + 10, measure: (p, d) => p.xpByDate[d] ?? 0 },
  { id: 'lessons', title: (n) => `Пройдите ${n} урока`, target: () => 2, measure: (p, d) => today(Object.values(p.completedLessons), d, 'lastCompleted') },
  { id: 'review', title: (n) => `Повторите ${n} слов`, target: () => 10, measure: (p, d) => today(Object.values(p.cards), d, 'lastReviewed') },
  { id: 'listen', title: () => 'Дослушайте аудиоурок', target: () => 1, measure: (p, d) => Object.values(p.listened).filter((x) => x === d).length },
  { id: 'new', title: (n) => `Узнайте ${n} новых слов`, target: () => 5, measure: (p, d) => Object.values(p.cards).filter((c) => c.lastReviewed === d && c.reps <= 1).length },
  { id: 'lesson', title: () => 'Пройдите урок', target: () => 1, measure: (p, d) => today(Object.values(p.completedLessons), d, 'lastCompleted') },
];

/** Три задания на день: набор выбирается по дате, у всех один и тот же. Набрать XP — всегда первое. */
export function dailyQuests(p: ProgressState, day: DateKey, goal: number): Quest[] {
  const rest = POOL.slice(1);
  const seed = seedFrom(day);
  const a = rest[seed % rest.length];
  let b = rest[Math.floor(seed / 7) % rest.length];
  // «Пройдите урок» и «Пройдите 2 урока» вместе не даём.
  if (b === a || (a.id.startsWith('lesson') && b.id.startsWith('lesson'))) b = rest.find((q) => q !== a && !(a.id.startsWith('lesson') && q.id.startsWith('lesson')))!;
  return [POOL[0], a, b].map((q) => {
    const target = q.target(goal);
    const value = Math.min(q.measure(p, day), target);
    return { id: q.id, title: q.title(target), value, target, done: value >= target };
  });
}

export const allQuestsDone = (p: ProgressState, day: DateKey, goal: number) => dailyQuests(p, day, goal).every((q) => q.done);

export const WEEKLY_XP = 150;

/** Неделя с понедельника. */
export function weekStart(day: DateKey): DateKey {
  const [y, m, d] = day.split('-').map(Number);
  const wd = (new Date(y, m - 1, d, 12).getDay() + 6) % 7;
  return addDays(day, -wd);
}

export function weeklyChallenge(p: ProgressState, day: DateKey): { value: number; target: number; daysLeft: number; done: boolean } {
  const start = weekStart(day);
  let value = 0;
  for (let i = 0; i < 7; i++) value += p.xpByDate[addDays(start, i)] ?? 0;
  return { value: Math.min(value, WEEKLY_XP), target: WEEKLY_XP, daysLeft: 7 - diffDays(day, start), done: value >= WEEKLY_XP };
}

/** Сколько недель за всю историю испытание выполнено — из XP по дням, без отдельного хранения. */
export function weeksWon(p: ProgressState): number {
  const sums = new Map<DateKey, number>();
  for (const [day, xp] of Object.entries(p.xpByDate)) sums.set(weekStart(day), (sums.get(weekStart(day)) ?? 0) + xp);
  return [...sums.values()].filter((x) => x >= WEEKLY_XP).length;
}
