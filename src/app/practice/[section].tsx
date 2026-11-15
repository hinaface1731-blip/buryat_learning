import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';

import { getConversations } from '@/content/conversations';
import { getCourse } from '@/content/course';
import { buildWords, buildDialogue, buildGrammar, buildListening, buildMistakes, buildSpeaking, buildTalk, buildEvent, SECTION_TITLES } from '@/engine/practice';
import type { Exercise } from '@/engine/types';
import { SessionGate } from '@/features/session/SessionGate';
import { dateKey } from '@/lib/dates';
import { useAppStore } from '@/store/app-store';
import { activeEvent, EVENTS } from '@/store/events';
import { Button, Screen, T } from '@/ui/components';

/** Веб (output: static): страница на каждый раздел. */
export async function generateStaticParams(): Promise<{ section: string }[]> {
  return Object.keys(SECTION_TITLES).map((section) => ({ section }));
}

function build(section: string, dialogueId?: string, selection: { collection?: string; query?: string; learnedOnly?: boolean } = {}): Exercise[] {
  const { content, pools, hasAudio } = getCourse();
  const opts = { hasAudio, cards: useAppStore.getState().progress.cards, seed: Date.now() >>> 0 };
  switch (section) {
    case 'words':
      return buildWords(content, pools, opts, selection);
    case 'listening':
      return buildListening(pools, opts);
    case 'speaking':
      return buildSpeaking(pools, opts);
    case 'grammar':
      return buildGrammar(content, pools, opts);
    case 'mistakes':
      return buildMistakes(content, pools, opts);
    case 'dialogues':
      return dialogueId ? buildDialogue(dialogueId, content, pools, opts) : [];
    case 'event':
      return buildEvent(EVENTS.find((e) => e.id === dialogueId)?.wordIds ?? [], content, pools, opts);
    case 'talk':
      return buildTalk(getConversations().find((c) => c.id === dialogueId));
    default:
      return [];
  }
}

export default function PracticeSession() {
  const router = useRouter();
  const { section, d, collection, q, learned } = useLocalSearchParams<{ section: string; d?: string; collection?: string; q?: string; learned?: string }>();
  const [queue] = useState(() => build(section, d, { collection, query: q, learnedOnly: learned === '1' }));
  const title = SECTION_TITLES[section as keyof typeof SECTION_TITLES] ?? 'Практикум';

  if (queue.length === 0) {
    return (
      <Screen>
        <T v="heading">Пока не из чего собрать тренировку</T>
        <T muted>{section === 'words' ? 'В этой подборке пока нет доступных слов. Измените поиск или фильтры в словаре.' : section === 'mistakes' ? 'Ошибок в истории нет — так держать.' : 'Пройдите несколько уроков, и здесь появятся задания.'}</T>
        <Button title="Назад" onPress={() => (router.canGoBack() ? router.back() : router.replace('/practice'))} />
      </Screen>
    );
  }
  // Тренировка короткая и не сохраняется: открыли — прошли.
  // Участие в событии засчитывается, только пока событие идёт.
  const active = section === 'event' ? activeEvent(dateKey()) : null;
  const onComplete = active && active.event.id === d ? () => useAppStore.getState().finishEvent(active.season) : undefined;
  return <SessionGate key={`${section}-${d ?? ''}`} sessionKey={`practice-${section}`} kind="review" title={title} build={() => queue} onComplete={onComplete} />;
}
