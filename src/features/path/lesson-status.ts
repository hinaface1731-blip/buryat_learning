import type { Unit } from '@/content/schema';
import { MASTERY_THRESHOLD } from '@/store/logic';

export type LessonStatus = 'mastered' | 'weak' | 'available' | 'locked';

type Completed = Record<string, { bestAccuracy: number }>;

/**
 * Юниты открыты сразу (взрослый может начать с любого), уроки внутри юнита — по порядку.
 * Пройденный с низкой точностью урок открывает следующий, но отмечается как незакреплённый.
 */
export function lessonStatus(unit: Unit, index: number, completed: Completed): LessonStatus {
  const lesson = unit.lessons[index];
  const done = completed[lesson.id];
  if (done) return done.bestAccuracy >= MASTERY_THRESHOLD ? 'mastered' : 'weak';
  if (unit.locked) return 'locked';
  if (index === 0 || completed[unit.lessons[index - 1].id]) return 'available';
  return 'locked';
}

export function nextLessonId(units: Unit[], completed: Completed): string | null {
  for (const unit of units) {
    for (let i = 0; i < unit.lessons.length; i++) {
      if (lessonStatus(unit, i, completed) === 'available') return unit.lessons[i].id;
    }
  }
  return null;
}
