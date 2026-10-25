import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { findLesson, getCourse } from '@/content/course';
import { buildLesson } from '@/engine/lesson';
import { SessionRunner } from '@/features/session/SessionRunner';
import { Screen, T } from '@/ui/components';

export default function LessonScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  // Очередь собирается один раз при открытии; новый seed — при повторном прохождении порядок другой.
  const [state] = useState(() => {
    const found = findLesson(id);
    if (!found) return null;
    const { content, pools, hasAudio } = getCourse();
    return { found, queue: buildLesson(found.lesson.id, content, pools, { hasAudio, seed: Date.now() >>> 0 }) };
  });

  if (!state || state.queue.length === 0) {
    return (
      <Screen>
        <T>Урок не найден.</T>
      </Screen>
    );
  }
  const { found, queue } = state;
  return <SessionRunner queue={queue} kind="lesson" lessonId={found.lesson.id} title={`${found.unit.title} · ${found.lesson.title}`} />;
}
