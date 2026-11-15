import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { getCourse } from '@/content/course';
import { lessonStatus } from '@/features/path/lesson-status';
import { PLACES, placeStates } from '@/features/world/world';
import { useAppStore } from '@/store/app-store';
import { ART } from '@/ui/art';
import { Button, Card, ProgressBar, Row, Screen, T, UnverifiedBadge } from '@/ui/components';
import { fonts, radius, space, useTheme } from '@/ui/theme';

/** Веб (output: static): страница на каждое место карты. */
export async function generateStaticParams(): Promise<{ id: string }[]> {
  return PLACES.map((p) => ({ id: p.id }));
}

const STATUS_ICON = { mastered: 'checkmark-circle', weak: 'refresh-circle', available: 'play-circle', locked: 'lock-closed' } as const;

export default function PlaceScreen() {
  const { c } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const completed = useAppStore((s) => s.progress.completedLessons);
  const state = placeStates(getCourse().content.course.units, completed).find((s) => s.place.id === id);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));
  if (!state) {
    return (
      <Screen>
        <T>Место не найдено.</T>
        <Button kind="ghost" title="Назад" onPress={back} />
      </Screen>
    );
  }
  const { place, units, done, total, mastered, nextLesson } = state;
  return (
    <Screen scroll>
      <Row style={{ justifyContent: 'space-between' }}>
        <Button kind="ghost" title="← Маршрут" onPress={back} />
      </Row>
      {ART[place.art] && <Image source={ART[place.art]} style={styles.art} contentFit="cover" loading="eager" accessible={false} />}
      <View style={{ gap: 2 }}>
        <T v="title">{place.title}</T>
        <Row gap={space.sm} style={{ alignItems: 'center' }}>
          <T v="buryat" muted>
            {place.buryat}
          </T>
          <UnverifiedBadge verified={false} />
        </Row>
      </View>
      <T>{place.intro}</T>
      {nextLesson && <Button title={done === total ? mastered === total ? 'Повторить урок' : 'Закрепить материал' : done ? 'Продолжить обучение' : 'Начать обучение'} onPress={() => router.push({ pathname: '/lesson/[id]', params: { id: nextLesson } })} />}
      <Card>
        <T v="label">Это интересно</T>
        {place.facts.map((f) => (
          <Row key={f} gap={space.sm} style={{ alignItems: 'flex-start' }}>
            <T color={c.accent}>•</T>
            <T style={{ flex: 1 }}>{f}</T>
          </Row>
        ))}
      </Card>
      <Row style={{ justifyContent: 'space-between' }}>
        <T v="heading">Задания места</T>
        <T v="label" muted>
          {done} / {total}
        </T>
      </Row>
      <T v="caption" muted>Освоено: {mastered} из {total}. Для освоения нужно не менее 70% верных ответов.</T>
      <ProgressBar value={total ? mastered / total : 0} color={c.accent} />
      {units.map((unit) => (
        <Card key={unit.id} style={{ gap: 0, paddingVertical: space.xs }}>
          <T v="label" style={{ paddingVertical: space.sm }}>
            {unit.title}
          </T>
          {unit.lessons.map((lesson, i) => {
            const status = lessonStatus(unit, i, completed);
            return (
              <Pressable
                key={lesson.id}
                accessibilityRole="button"
                accessibilityState={{ disabled: status === 'locked' }}
                disabled={status === 'locked'}
                onPress={() => router.push(`/lesson/${lesson.id}`)}
                style={({ pressed }) => [styles.row, { borderColor: c.border, opacity: status === 'locked' ? 0.5 : pressed ? 0.7 : 1 }]}>
                <Ionicons name={STATUS_ICON[status]} size={22} color={status === 'mastered' ? c.success : status === 'weak' ? c.accent : c.primary} />
                <T style={{ flex: 1, fontFamily: status === 'available' ? fonts.semibold : fonts.regular }}>{lesson.title}</T>
              </Pressable>
            );
          })}
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  art: { width: '100%', aspectRatio: 2, borderRadius: radius.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm, borderTopWidth: StyleSheet.hairlineWidth },
});
