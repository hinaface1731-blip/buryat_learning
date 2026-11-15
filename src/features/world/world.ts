import worldJson from '../../../content/world.json';

import type { Unit } from '@/content/schema';
import { nextLessonId } from '@/features/path/lesson-status';
import { MASTERY_THRESHOLD } from '@/store/logic';

// «Бурятский мир»: места на карте Бурятии, каждое объединяет несколько глав курса.
// Названия мест по-бурятски — verified:false, как и весь бурятский текст до сверки.

export type Place = { id: string; title: string; buryat: string; intro: string; facts: string[]; units: string[]; x: number; y: number; art: string };

export const PLACES = worldJson as Place[];

export type PlaceState = { place: Place; units: Unit[]; done: number; total: number; mastered: number; nextLesson: string | null };

/** Места с главами курса; закрытые и неизвестные главы не считаются. */
export function placeStates(units: Unit[], completed: Record<string, { bestAccuracy: number }>): PlaceState[] {
  return PLACES.map((place) => {
    const own = place.units.map((id) => units.find((u) => u.id === id)).filter((u): u is Unit => !!u && !u.locked && u.lessons.length > 0);
    const lessons = own.flatMap((u) => u.lessons);
    const mastered = lessons.filter((l) => (completed[l.id]?.bestAccuracy ?? 0) >= MASTERY_THRESHOLD).length;
    const weak = lessons.find((l) => completed[l.id] && completed[l.id].bestAccuracy < MASTERY_THRESHOLD);
    return { place, units: own, done: lessons.filter((l) => completed[l.id]).length, total: lessons.length, mastered,
      nextLesson: nextLessonId(own, completed) ?? weak?.id ?? lessons[0]?.id ?? null };
  }).filter((s) => s.total > 0);
}

/** Где сейчас нерпёнок: место со следующим уроком, иначе первое незаконченное. */
export function currentPlaceId(states: PlaceState[], nextLessonId: string | null): string | null {
  const byNext = states.find((s) => s.units.some((u) => u.lessons.some((l) => l.id === nextLessonId)));
  return (byNext ?? states.find((s) => s.mastered < s.total) ?? states[0])?.place.id ?? null;
}
