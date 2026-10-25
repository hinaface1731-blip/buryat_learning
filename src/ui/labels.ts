import type { DailyGoal } from '@/store/logic';

export const GOAL_LABELS: Record<DailyGoal, string> = {
  10: '10 XP — спокойно, ~5 минут',
  20: '20 XP — обычно, ~10 минут',
  30: '30 XP — серьёзно, ~15 минут',
  50: '50 XP — интенсивно, ~25 минут',
};

export function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

export const days = (n: number) => `${n} ${plural(n, 'день', 'дня', 'дней')}`;
export const words = (n: number) => `${n} ${plural(n, 'слово', 'слова', 'слов')}`;
