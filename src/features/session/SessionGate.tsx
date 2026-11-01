import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { getCourse, reviewableDueIds } from '@/content/course';
import { startSession } from '@/engine/session';
import type { Exercise } from '@/engine/types';
import { dateKey } from '@/lib/dates';
import { useAppStore } from '@/store/app-store';
import { heartsToday } from '@/store/logic';
import { useSessionStore } from '@/store/session-store';
import { Button, Screen, T } from '@/ui/components';
import { Mascot } from '@/ui/Mascot';
import { space } from '@/ui/theme';

import { SessionRunner } from './SessionRunner';

type Mode = 'ask' | 'resume' | 'fresh' | 'no-hearts' | 'practice';

type Props = { sessionKey: string; kind: 'lesson' | 'review'; lessonId?: string; title: string; build: () => Exercise[] };

/** Вход в занятие: продолжить сохранённое, начать заново или, без сердечек, свободная практика. */
export function SessionGate({ sessionKey, kind, lessonId, title, build }: Props) {
  const router = useRouter();
  const [saved] = useState(() => {
    const s = useSessionStore.getState().saved[sessionKey];
    return s && s.stamp === getCourse().stamp ? s : null;
  });
  const [mode, setMode] = useState<Mode>(() => {
    const { settings, progress } = useAppStore.getState();
    if (kind === 'lesson' && settings.heartsEnabled && heartsToday(progress, dateKey()) === 0) return 'no-hearts';
    return saved ? 'ask' : 'fresh';
  });
  const [queue] = useState(build);

  if (mode === 'resume' && saved) return <SessionRunner queue={saved.session.queue} initial={saved.session} kind={kind} lessonId={lessonId} title={title} sessionKey={sessionKey} />;
  if (mode === 'fresh') return <SessionRunner queue={queue} kind={kind} lessonId={lessonId} title={title} sessionKey={sessionKey} />;
  if (mode === 'practice') return <SessionRunner queue={queue} kind={kind} lessonId={lessonId} title={`Практика · ${title}`} practice />;

  const home = () => (router.canGoBack() ? router.back() : router.replace('/'));

  if (mode === 'no-hearts') {
    const due = reviewableDueIds(useAppStore.getState().progress.cards, dateKey()).length;
    return (
      <Screen>
        <View style={{ gap: space.md, marginTop: space.xl }}>
          <Mascot mood="support" size={132} />
          <T v="title">Сердечки закончились</T>
          <T muted>Новые появятся завтра. А пока можно заниматься без них: практика не засчитает урок, но слова пойдут в повторение.</T>
          <Button title="Свободная практика" onPress={() => setMode('practice')} />
          {due > 0 && <Button kind="secondary" title="Повторение" onPress={() => router.replace('/review-session')} />}
          <Button kind="ghost" title="На главную" onPress={home} />
        </View>
      </Screen>
    );
  }

  const step = (saved?.session.index ?? 0) + 1;
  const total = saved?.session.queue.length ?? startSession(queue).queue.length;
  return (
    <Screen>
      <View style={{ gap: space.md, marginTop: space.xl }}>
        <Mascot mood="explain" size={132} />
        <T v="title">Продолжим?</T>
        <T muted>
          {title}. Вы остановились на шаге {step} из {total}.
        </T>
        <Button title="Продолжить" onPress={() => setMode('resume')} />
        <Button
          kind="secondary"
          title="Начать заново"
          onPress={() => {
            useSessionStore.getState().clear(sessionKey);
            setMode('fresh');
          }}
        />
      </View>
    </Screen>
  );
}
