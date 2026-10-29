import { useRouter } from 'expo-router';
import { useState } from 'react';

import { getCourse } from '@/content/course';
import { buildReview } from '@/engine/lesson';
import { SessionRunner } from '@/features/session/SessionRunner';
import { dateKey } from '@/lib/dates';
import { dueIds } from '@/srs/sm2';
import { useAppStore } from '@/store/app-store';
import { Button, Screen, T } from '@/ui/components';

export default function ReviewSession() {
  const router = useRouter();
  // Очередь фиксируется при открытии: оценки в ходе сессии не меняют её состав.
  const [queue] = useState(() => {
    const { cards } = useAppStore.getState().progress;
    const ids = dueIds(cards, dateKey(), 20);
    const { content, pools, hasAudio } = getCourse();
    const repsById = Object.fromEntries(ids.map((id) => [id, cards[id].reps]));
    return buildReview(ids, content, pools, { hasAudio, repsById, seed: Date.now() >>> 0 });
  });

  if (queue.length === 0) {
    return (
      <Screen>
        <T v="heading">Сейчас нечего повторять</T>
        <Button title="Назад" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
      </Screen>
    );
  }
  return <SessionRunner queue={queue} kind="review" title="Повторение" />;
}
