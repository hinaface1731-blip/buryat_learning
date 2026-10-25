import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { getCourse } from '@/content/course';
import type { Unit } from '@/content/schema';
import { lessonStatus, nextLessonId, type LessonStatus } from '@/features/path/lesson-status';
import { dateKey } from '@/lib/dates';
import { dueIds } from '@/srs/sm2';
import { useAppStore } from '@/store/app-store';
import { heartsToday, streak } from '@/store/logic';
import { Button, Card, ProgressBar, Row, Screen, T } from '@/ui/components';
import { days, words } from '@/ui/labels';
import { fonts, radius, space, useTheme } from '@/ui/theme';

export default function PathScreen() {
  const router = useRouter();
  const { c } = useTheme();
  const { content } = getCourse();
  const progress = useAppStore((s) => s.progress);
  const goal = useAppStore((s) => s.settings.dailyGoal);
  const heartsEnabled = useAppStore((s) => s.settings.heartsEnabled);
  const today = dateKey();
  const xpToday = progress.xpByDate[today] ?? 0;
  const due = dueIds(progress.cards, today).length;
  const next = nextLessonId(content.course.units, progress.completedLessons);

  return (
    <Screen scroll>
      <Row style={{ justifyContent: 'space-between' }}>
        <T v="title">Путь</T>
        <Row gap={space.md}>
          <T v="label" color={c.accent}>
            Серия: {days(streak(progress, goal, today))}
          </T>
          {heartsEnabled && <T v="label" color={c.error}>♥ {heartsToday(progress, today)}</T>}
        </Row>
      </Row>

      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <T v="label">Цель на сегодня</T>
          <T v="label" muted>
            {Math.min(xpToday, goal)} / {goal} XP
          </T>
        </Row>
        <ProgressBar value={xpToday / goal} color={xpToday >= goal ? c.success : c.primary} />
        {next && <Button title="Продолжить" onPress={() => router.push(`/lesson/${next}`)} style={{ marginTop: space.sm }} />}
        {due > 0 && <Button kind="secondary" title={`Повторить: ${words(due)}`} onPress={() => router.push('/review-session')} />}
      </Card>

      {content.course.units.map((unit) => (
        <UnitBlock key={unit.id} unit={unit} completed={progress.completedLessons} onOpen={(id) => router.push(`/lesson/${id}`)} />
      ))}
    </Screen>
  );
}

function UnitBlock({ unit, completed, onOpen }: { unit: Unit; completed: Record<string, unknown>; onOpen: (id: string) => void }) {
  const { c } = useTheme();
  const done = unit.lessons.filter((l) => completed[l.id]).length;
  return (
    <View style={{ gap: space.sm }}>
      <View style={{ gap: 2 }}>
        <T v="heading">{unit.title}</T>
        <T v="caption" muted>
          {unit.description}
        </T>
      </View>
      {unit.locked ? (
        <View style={[styles.locked, { borderColor: c.border }]}>
          <T v="caption" muted>
            Скоро: ждём слова от носителя языка
          </T>
        </View>
      ) : (
        <>
          <ProgressBar value={unit.lessons.length ? done / unit.lessons.length : 0} color={c.accent} />
          <View style={styles.grid}>
            {unit.lessons.map((lesson, i) => (
              <LessonNode key={lesson.id} title={lesson.title} status={lessonStatus(unit, i, completed)} onPress={() => onOpen(lesson.id)} />
            ))}
          </View>
        </>
      )}
    </View>
  );
}

function LessonNode({ title, status, onPress }: { title: string; status: LessonStatus; onPress: () => void }) {
  const { c } = useTheme();
  const bg = { done: c.successBg, available: c.primary, locked: c.surfaceAlt }[status];
  const fg = { done: c.success, available: c.onPrimary, locked: c.textMuted }[status];
  const mark = { done: '✓', available: '›', locked: '·' }[status];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}${status === 'done' ? ', пройден' : status === 'locked' ? ', закрыт' : ''}`}
      accessibilityState={{ disabled: status === 'locked' }}
      disabled={status === 'locked'}
      onPress={onPress}
      style={({ pressed }) => [styles.node, { backgroundColor: bg, opacity: pressed ? 0.85 : 1 }]}>
      <Text style={{ color: fg, fontFamily: fonts.semibold, fontSize: 14 }} numberOfLines={1}>
        {mark} {title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  node: { borderRadius: radius.md, paddingVertical: 12, paddingHorizontal: space.md, minWidth: 104 },
  locked: { borderWidth: 1, borderStyle: 'dashed', borderRadius: radius.md, padding: space.md },
});
