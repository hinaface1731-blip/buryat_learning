import { useLocalSearchParams } from 'expo-router';

import { findLesson, getCourse } from '@/content/course';
import { buildLesson } from '@/engine/lesson';
import { SessionGate } from '@/features/session/SessionGate';
import { Screen, T } from '@/ui/components';

/** Веб (output: static): по HTML-странице на каждый урок курса. */
export async function generateStaticParams(): Promise<{ id: string }[]> {
  return getCourse().content.course.units.flatMap((u) => u.lessons.map((l) => ({ id: l.id })));
}

export default function LessonScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const found = findLesson(id);

  if (!found) {
    return (
      <Screen>
        <T>Урок не найден.</T>
      </Screen>
    );
  }
  const build = () => {
    const { content, pools, hasAudio } = getCourse();
    // Новый seed на каждое открытие: при повторном прохождении порядок другой.
    return buildLesson(found.lesson.id, content, pools, { hasAudio, seed: Date.now() >>> 0 });
  };
  return <SessionGate key={id} sessionKey={found.lesson.id} kind="lesson" lessonId={found.lesson.id} title={`${found.unit.title} · ${found.lesson.title}`} skill={found.lesson.skill} build={build} />;
}
