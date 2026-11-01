import { audioIndex } from '@/audio/audioIndex';
import { buildPools, type Pools } from '@/engine/pool';
import { seedFrom } from '@/engine/rng';
import { dueIds, type Card } from '@/srs/sm2';

import { getContent, type Content } from './load';

// Курс загружается и проверяется схемами один раз за запуск.

type Course = {
  content: Content;
  pools: Pools;
  hasAudio: (id: string) => boolean;
  /** Отпечаток контента: незавершённые занятия из другой версии курса не продолжаем. */
  stamp: string;
};

let course: Course | null = null;

export function getCourse(): Course {
  if (!course) {
    const content = getContent();
    const stamp = String(seedFrom(JSON.stringify([content.course, content.words.map((w) => [w.id, w.buryat, w.russian])])));
    course = { content, pools: buildPools(content), hasAudio: (id) => id in audioIndex, stamp };
  }
  return course;
}

export function findLesson(lessonId: string) {
  const { content } = getCourse();
  for (const unit of content.course.units) {
    const index = unit.lessons.findIndex((l) => l.id === lessonId);
    if (index >= 0) return { unit, lesson: unit.lessons[index], index };
  }
  return null;
}

/** Карточки к повторению, для которых можно собрать задание: слово могли исключить при сверке. */
export function reviewableDueIds(cards: Record<string, Card>, today: string, limit?: number): string[] {
  const { pools, content } = getCourse();
  const known: Record<string, Card> = {};
  for (const [id, card] of Object.entries(cards)) {
    const s = content.sentenceById.get(id);
    if (pools.itemById.has(id) || (s && s.translation !== null && !s.excluded)) known[id] = card;
  }
  return dueIds(known, today, limit);
}
