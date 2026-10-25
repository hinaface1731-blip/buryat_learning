import { useRouter } from 'expo-router';

import { dateKey } from '@/lib/dates';
import { dueIds } from '@/srs/sm2';
import { useAppStore } from '@/store/app-store';
import { Button, Card, Screen, T } from '@/ui/components';
import { words } from '@/ui/labels';

export default function ReviewTab() {
  const router = useRouter();
  const cards = useAppStore((s) => s.progress.cards);
  const today = dateKey();
  const due = dueIds(cards, today, 1000).length;
  const total = Object.keys(cards).length;
  const upcoming = Object.values(cards).filter((c) => c.due > today).sort((a, b) => (a.due < b.due ? -1 : 1))[0];

  return (
    <Screen scroll>
      <T v="title">Повторение</T>
      <T muted>Интервальные повторения: слова возвращаются тогда, когда вы начинаете их забывать. Ошибки из уроков попадают сюда же.</T>
      <Card>
        {due > 0 ? (
          <>
            <T v="heading">К повторению: {words(due)}</T>
            <T v="caption" muted>
              За один подход — до 20 карточек.
            </T>
            <Button title="Начать повторение" onPress={() => router.push('/review-session')} />
          </>
        ) : total === 0 ? (
          <T>Пока нечего повторять — пройдите первый урок.</T>
        ) : (
          <>
            <T v="heading">На сегодня всё повторено</T>
            {upcoming && <T muted>Следующее повторение: {upcoming.due}</T>}
          </>
        )}
      </Card>
      <T v="caption" muted>
        Всего в повторении: {words(total)}
      </T>
    </Screen>
  );
}
