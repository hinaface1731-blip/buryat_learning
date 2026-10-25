import { audioIndex } from '@/audio/audioIndex';
import { buildPools, type Pools } from '@/engine/pool';

import { getContent, type Content } from './load';

// Курс загружается и проверяется схемами один раз за запуск.

type Course = { content: Content; pools: Pools; hasAudio: (id: string) => boolean };

let course: Course | null = null;

export function getCourse(): Course {
  if (!course) {
    const content = getContent();
    course = { content, pools: buildPools(content), hasAudio: (id) => id in audioIndex };
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
