import { useRouter } from 'expo-router';
import { useState } from 'react';

import { getCourse, reviewableDueIds } from '@/content/course';
import { buildReview } from '@/engine/lesson';
import { SessionGate } from '@/features/session/SessionGate';
import { dateKey } from '@/lib/dates';
import { useAppStore } from '@/store/app-store';
import { REVIEW_SESSION_KEY, useSessionStore } from '@/store/session-store';
import { Button, Screen, T } from '@/ui/components';

function buildDueQueue() {
  const { cards } = useAppStore.getState().progress;
  const ids = reviewableDueIds(cards, dateKey(), 20);
  const { content, pools, hasAudio } = getCourse();
  const repsById = Object.fromEntries(ids.map((id) => [id, cards[id].reps]));
  return buildReview(ids, content, pools, { hasAudio, repsById, seed: Date.now() >>> 0 });
}

export default function ReviewSession() {
  const router = useRouter();
  // Проверка при открытии: оценки в ходе сессии не должны её закрывать.
  const [hasWork] = useState(() => buildDueQueue().length > 0 || !!useSessionStore.getState().saved[REVIEW_SESSION_KEY]);

  if (!hasWork) {
    return (
      <Screen>
        <T v="heading">Сейчас нечего повторять</T>
        <Button title="Назад" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
      </Screen>
    );
  }
  return <SessionGate sessionKey={REVIEW_SESSION_KEY} kind="review" title="Повторение" build={buildDueQueue} />;
}
