import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { useAppStore } from '@/store/app-store';
import { activeEvent } from '@/store/events';
import { dailyQuests, weeklyChallenge } from '@/store/quests';
import { ART } from '@/ui/art';
import { Button, Card, ProgressBar, Row, T } from '@/ui/components';
import { days } from '@/ui/labels';
import { space, useTheme } from '@/ui/theme';

/** Задания дня и недельное испытание: всё считается из прогресса на лету. */
export function QuestsCard({ today }: { today: string }) {
  const { c } = useTheme();
  const progress = useAppStore((s) => s.progress);
  const goal = useAppStore((s) => s.settings.dailyGoal);
  const quests = dailyQuests(progress, today, goal);
  const week = weeklyChallenge(progress, today);
  const done = quests.filter((q) => q.done).length;
  return (
    <Card>
      <Row style={{ justifyContent: 'space-between' }}>
        <T v="label">Задания дня</T>
        <T v="caption" muted>
          {done} из {quests.length}
        </T>
      </Row>
      {quests.map((q) => (
        <Row key={q.id} gap={space.sm} style={{ alignItems: 'center' }}>
          <Ionicons name={q.done ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={q.done ? c.success : c.textMuted} />
          <View style={{ flex: 1, gap: 2 }}>
            <T>{q.title}</T>
            {!q.done && q.target > 1 && <ProgressBar value={q.value / q.target} color={c.accent} />}
          </View>
          {!q.done && q.target > 1 && (
            <T v="caption" muted>
              {q.value}/{q.target}
            </T>
          )}
        </Row>
      ))}
      <View style={{ gap: space.xs, marginTop: space.sm }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <T v="label">Недельное испытание</T>
          <T v="caption" muted>
            {week.done ? 'выполнено' : `ещё ${days(week.daysLeft)}`}
          </T>
        </Row>
        <ProgressBar value={week.value / week.target} color={week.done ? c.success : c.primary} />
        <T v="caption" muted>
          {week.value} из {week.target} XP за неделю
        </T>
      </View>
    </Card>
  );
}

/** Баннер сезонного события с тематической тренировкой. */
export function EventBanner({ today }: { today: string }) {
  const { c } = useTheme();
  const router = useRouter();
  const joined = useAppStore((s) => s.progress.events);
  const active = activeEvent(today);
  if (!active) return null;
  const { event, season, daysLeft } = active;
  return (
    <Card style={{ borderColor: c.accent, borderWidth: 1.5 }}>
      <Row gap={space.md}>
        <Image source={ART[event.badge]} style={{ width: 56, height: 56 }} contentFit="contain" loading="eager" accessible={false} />
        <View style={{ flex: 1, gap: 2 }}>
          <T v="caption" color={c.accent}>
            Событие · ещё {days(daysLeft)}
          </T>
          <T v="heading">{event.title}</T>
          <T v="caption" muted>
            {event.description}
          </T>
        </View>
      </Row>
      <Button
        kind={joined[season] ? 'secondary' : 'primary'}
        title={joined[season] ? 'Повторить слова праздника' : 'Праздничная тренировка'}
        onPress={() => router.push({ pathname: '/practice/[section]', params: { section: 'event', d: event.id } })}
      />
    </Card>
  );
}
