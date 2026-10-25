import type { Unit } from '@/content/schema';

export type LessonStatus = 'done' | 'available' | 'locked';

/**
 * Юниты открыты сразу (взрослый может начать с любого), уроки внутри юнита — по порядку.
 * Тематические юниты закрыты, пока нет слов от носителя.
 */
export function lessonStatus(unit: Unit, index: number, completed: Record<string, unknown>): LessonStatus {
  const lesson = unit.lessons[index];
  if (completed[lesson.id]) return 'done';
  if (unit.locked) return 'locked';
  if (index === 0 || completed[unit.lessons[index - 1].id]) return 'available';
  return 'locked';
}

export function nextLessonId(units: Unit[], completed: Record<string, unknown>): string | null {
  for (const unit of units) {
    for (let i = 0; i < unit.lessons.length; i++) {
      if (lessonStatus(unit, i, completed) === 'available') return unit.lessons[i].id;
    }
  }
  return null;
}
