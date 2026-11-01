import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { getCourse, reviewableDueIds } from '@/content/course';
import type { Unit } from '@/content/schema';
import { lessonStatus, nextLessonId, type LessonStatus } from '@/features/path/lesson-status';
import { addDays, dateKey } from '@/lib/dates';
import { useAppStore } from '@/store/app-store';
import { heartsToday, streak, type ProgressState } from '@/store/logic';
import { latestSavedLesson, useSessionStore } from '@/store/session-store';
import { Button, Card, ProgressBar, Row, Screen, T } from '@/ui/components';
import { days, words } from '@/ui/labels';
import { Mascot, type MascotMood } from '@/ui/Mascot';
import { fonts, radius, space, useTheme } from '@/ui/theme';

// Сдвиг узлов дорожки: путь извивается, а не лежит сеткой.
const WAVE = [0, 44, 66, 44, 0, -44, -66, -44];

function greeting(progress: ProgressState, goal: number, today: string): { mood: MascotMood; text: string } {
  const xp = progress.xpByDate[today] ?? 0;
  if (xp >= goal) return { mood: 'happy', text: 'Цель на сегодня выполнена. Отлично!' };
  if (Object.keys(progress.xpByDate).length === 0) return { mood: 'explain', text: 'Привет! Я нерпёнок. Давайте научимся здороваться по-бурятски.' };
  if (xp > 0) return { mood: 'explain', text: 'Хорошо идём. До цели совсем немного.' };
  if (progress.xpByDate[addDays(today, -1)]) return { mood: 'happy', text: 'С возвращением! Продолжаем серию.' };
  return { mood: 'think', text: 'Давно не виделись. Начнём с небольшого шага?' };
}

export default function PathScreen() {
  const router = useRouter();
  const { c } = useTheme();
  const { content, stamp } = getCourse();
  const progress = useAppStore((s) => s.progress);
  const goal = useAppStore((s) => s.settings.dailyGoal);
  const heartsEnabled = useAppStore((s) => s.settings.heartsEnabled);
  const saved = useSessionStore((s) => s.saved);
  const today = dateKey();
  const xpToday = progress.xpByDate[today] ?? 0;
  const due = reviewableDueIds(progress.cards, today).length;
  const units = content.course.units;
  const open = units.filter((u) => !u.locked);
  const later = units.filter((u) => u.locked);
  const resumeId = latestSavedLesson(saved, stamp);
  const next = resumeId ?? nextLessonId(units, progress.completedLessons);
  const currentUnit = open.find((u) => u.lessons.some((l) => l.id === next))?.id ?? null;
  const [expanded, setExpanded] = useState<string | null>(null);
  const shownUnit = expanded ?? currentUnit;
  const hello = greeting(progress, goal, today);

  return (
    <Screen scroll>
      <Row style={{ justifyContent: 'flex-end' }} gap={space.md}>
        <T v="label" color={c.accent}>
          Серия: {days(streak(progress, goal, today))}
        </T>
        {heartsEnabled && <T v="label" color={c.error}>♥ {heartsToday(progress, today)}</T>}
      </Row>

      <Row gap={space.md}>
        <Mascot mood={hello.mood} size={84} />
        <T v="heading" style={{ flex: 1 }}>
          {hello.text}
        </T>
      </Row>

      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <T v="label">Цель на сегодня</T>
          <T v="label" muted>
            {Math.min(xpToday, goal)} / {goal} XP
          </T>
        </Row>
        <ProgressBar value={xpToday / goal} color={xpToday >= goal ? c.success : c.primary} />
        {next && <Button title={resumeId ? 'Продолжить урок' : 'Следующий шаг'} onPress={() => router.push(`/lesson/${next}`)} style={{ marginTop: space.sm }} />}
        {due > 0 && <Button kind="secondary" title={`Повторить: ${words(due)}`} onPress={() => router.push('/review-session')} />}
      </Card>

      {open.map((unit, i) => (
        <Chapter
          key={unit.id}
          number={i + 1}
          unit={unit}
          nextId={next}
          progress={progress}
          isOpen={shownUnit === unit.id}
          onToggle={() => setExpanded(shownUnit === unit.id ? '' : unit.id)}
          onOpen={(id) => router.push(`/lesson/${id}`)}
        />
      ))}

      {later.length > 0 && (
        <View style={[styles.later, { borderColor: c.border }]}>
          <T v="label">Дальше в путешествии</T>
          <T v="caption" muted>
            {later.map((u) => u.title).join(' · ')}
          </T>
          <T v="caption" muted>
            Эти главы откроются, когда носитель языка подготовит фразы.
          </T>
        </View>
      )}
    </Screen>
  );
}

function Chapter({ number, unit, nextId, progress, isOpen, onToggle, onOpen }: { number: number; unit: Unit; nextId: string | null; progress: ProgressState; isOpen: boolean; onToggle: () => void; onOpen: (id: string) => void }) {
  const { c } = useTheme();
  const done = unit.lessons.filter((l) => progress.completedLessons[l.id]).length;
  return (
    <View style={{ gap: space.sm }}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: isOpen }} accessibilityLabel={`Глава ${number}. ${unit.title}. Пройдено ${done} из ${unit.lessons.length}`} onPress={onToggle}>
        <Card>
          <Row style={{ justifyContent: 'space-between' }}>
            <T v="caption" muted>
              Глава {number}
            </T>
            <T v="caption" muted>
              {done} / {unit.lessons.length}
            </T>
          </Row>
          <T v="heading">{unit.title}</T>
          <T v="caption" muted>
            {unit.description}
          </T>
          <ProgressBar value={unit.lessons.length ? done / unit.lessons.length : 0} color={c.accent} />
        </Card>
      </Pressable>
      {isOpen && (
        <View style={styles.trail}>
          {unit.lessons.map((lesson, i) => (
            <PathNode key={lesson.id} number={i + 1} title={lesson.title} offset={WAVE[i % WAVE.length]} status={lessonStatus(unit, i, progress.completedLessons)} isNext={lesson.id === nextId} onPress={() => onOpen(lesson.id)} />
          ))}
        </View>
      )}
    </View>
  );
}

function PathNode({ number, title, offset, status, isNext, onPress }: { number: number; title: string; offset: number; status: LessonStatus; isNext: boolean; onPress: () => void }) {
  const { c } = useTheme();
  const bg = { mastered: c.success, weak: c.accent, available: c.surfaceAlt, locked: c.surfaceAlt }[status];
  const fg = { mastered: c.onPrimary, weak: c.onPrimary, available: c.text, locked: c.textMuted }[status];
  const mark = status === 'mastered' ? '✓' : status === 'weak' ? '↻' : String(number);
  const size = isNext ? 76 : 58;
  const state = { mastered: 'освоен', weak: 'пройден, стоит закрепить', available: 'доступен', locked: 'закрыт' }[status];
  return (
    <View style={[styles.nodeRow, { transform: [{ translateX: offset }] }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${title}, ${state}${isNext ? ', следующий шаг' : ''}`}
        accessibilityState={{ disabled: status === 'locked' }}
        disabled={status === 'locked'}
        onPress={onPress}
        style={({ pressed }) => [
          styles.node,
          { width: size, height: size, borderRadius: size / 2, backgroundColor: isNext ? c.primary : bg, opacity: pressed ? 0.85 : status === 'locked' ? 0.55 : 1 },
          isNext && { borderWidth: 4, borderColor: c.accent },
        ]}>
        <Text style={{ color: isNext ? c.onPrimary : fg, fontFamily: fonts.bold, fontSize: isNext ? 24 : 18 }}>{mark}</Text>
      </Pressable>
      {!/^Урок \d+$/.test(title) && (
        <Text numberOfLines={1} style={{ color: status === 'locked' ? c.textMuted : c.text, fontFamily: isNext ? fonts.semibold : fonts.regular, fontSize: 13, marginTop: 4, maxWidth: 200 }}>
          {title}
        </Text>
      )}
      {isNext && (
        <View style={[styles.nextTag, offset > 0 ? { right: size + space.sm } : { left: size + space.sm }]}>
          <Mascot mood="explain" size={56} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  later: { borderWidth: 1, borderStyle: 'dashed', borderRadius: radius.md, padding: space.md, gap: space.xs },
  trail: { alignItems: 'center', gap: space.md, paddingVertical: space.sm },
  nodeRow: { alignItems: 'center', justifyContent: 'center' },
  node: { alignItems: 'center', justifyContent: 'center' },
  nextTag: { position: 'absolute' },
});
