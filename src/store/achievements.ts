import { addDays, type DateKey } from '@/lib/dates';

import type { ProgressState } from './logic';

// Достижения выводятся из прогресса и нигде не хранятся: так их не нужно мигрировать,
// а всё уже сделанное засчитывается сразу. Все показатели только растут — полученное не пропадает.

type Stats = { lessons: number; perfect: number; bestStreak: number; xp: number; words: number };
type UnitLike = { id: string; title: string; badge?: string; lessons: { id: string }[] };

export type Achievement = {
  id: string;
  title: string;
  hint: string;
  /** Ключ картинки из src/ui/art.ts. */
  art: string;
  value: number;
  target: number;
  unlocked: boolean;
};

const STATIC: { id: string; title: string; hint: string; art: string; target: number; stat: keyof Stats }[] = [
  { id: 'first-lesson', title: 'Первый шаг', hint: 'Пройдите первый урок', art: 'mascot-scarf', target: 1, stat: 'lessons' },
  { id: 'perfect', title: 'Без единой ошибки', hint: 'Пройдите урок без ошибок', art: 'mascot-star', target: 1, stat: 'perfect' },
  { id: 'streak-3', title: 'Три дня подряд', hint: 'Выполняйте цель 3 дня подряд', art: 'badge-flame', target: 3, stat: 'bestStreak' },
  { id: 'streak-7', title: 'Неделя', hint: 'Выполняйте цель 7 дней подряд', art: 'badge-flame', target: 7, stat: 'bestStreak' },
  { id: 'streak-30', title: 'Месяц', hint: 'Выполняйте цель 30 дней подряд', art: 'badge-flame', target: 30, stat: 'bestStreak' },
  { id: 'xp-100', title: 'Сто очков', hint: 'Наберите 100 XP', art: 'badge-numbers', target: 100, stat: 'xp' },
  { id: 'xp-1000', title: 'Тысяча очков', hint: 'Наберите 1000 XP', art: 'badge-numbers', target: 1000, stat: 'xp' },
  { id: 'words-25', title: 'Первые слова', hint: 'Выучите 25 слов и фраз', art: 'mascot-book', target: 25, stat: 'words' },
  { id: 'words-100', title: 'Сотня слов', hint: 'Выучите 100 слов и фраз', art: 'mascot-book', target: 100, stat: 'words' },
];

/** Самая длинная серия за всё время: серия на сегодня может оборваться, а достижение — нет. */
export function bestStreak(goalMetDays: Record<DateKey, true>): number {
  let best = 0;
  for (const day of Object.keys(goalMetDays)) {
    if (goalMetDays[addDays(day, -1)]) continue; // считаем только от начала каждой серии
    let n = 1;
    while (goalMetDays[addDays(day, n)]) n++;
    best = Math.max(best, n);
  }
  return best;
}

export const totalXp = (state: ProgressState): number => Object.values(state.xpByDate).reduce((a, b) => a + b, 0);

export const isUnitDone = (unit: UnitLike, state: ProgressState): boolean => unit.lessons.length > 0 && unit.lessons.every((l) => state.completedLessons[l.id]);

/** Главы с собственным значком дают своё достижение; фонетические — одно на всех. */
export function achievementsOf(state: ProgressState, units: UnitLike[]): Achievement[] {
  const completed = Object.values(state.completedLessons);
  const stats: Stats = {
    lessons: completed.length,
    perfect: completed.filter((l) => l.bestAccuracy >= 1).length,
    bestStreak: bestStreak(state.goalMetDays),
    xp: totalXp(state),
    words: Object.keys(state.cards).length,
  };
  const count = (list: UnitLike[]) => list.filter((u) => isUnitDone(u, state)).length;
  const open = units.filter((u) => u.lessons.length > 0);
  const phonetics = open.filter((u) => !u.badge);
  const list: Omit<Achievement, 'unlocked'>[] = [
    ...STATIC.map(({ stat, ...a }) => ({ ...a, value: stats[stat] })),
    ...open.filter((u) => u.badge).map((u) => ({ id: `chapter-${u.id}`, title: u.title, hint: `Пройдите главу «${u.title}»`, art: u.badge!, target: 1, value: count([u]) })),
    ...(phonetics.length ? [{ id: 'chapter-sounds', title: 'Знаток звуков', hint: 'Пройдите главы про буквы и звуки', art: 'mascot-graduate', target: phonetics.length, value: count(phonetics) }] : []),
  ];
  return list.map((a) => ({ ...a, value: Math.min(a.value, a.target), unlocked: a.value >= a.target }));
}

export function newlyUnlocked(before: ProgressState, after: ProgressState, units: UnitLike[]): Achievement[] {
  const had = new Set(achievementsOf(before, units).filter((a) => a.unlocked).map((a) => a.id));
  return achievementsOf(after, units).filter((a) => a.unlocked && !had.has(a.id));
}
