import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getCourse } from '@/content/course';
import { accuracy, advance, currentExercise, isFinished, isGraded, progressOf, sessionXp, startSession } from '@/engine/session';
import type { Exercise, Outcome } from '@/engine/types';
import { dateKey } from '@/lib/dates';
import { useAppStore } from '@/store/app-store';
import { useLastResult } from '@/store/last-result';
import { heartsToday } from '@/store/logic';
import { Button, ProgressBar, T } from '@/ui/components';
import { fonts, space, useTheme } from '@/ui/theme';
import { useWebKeys } from '@/ui/useWebKeys';

import {
  BuildSentenceView,
  CategorizeView,
  IntroView,
  ListenView,
  MatchPairsView,
  MinimalPairView,
  MultipleChoiceView,
  NoteView,
  TypeAnswerView,
  type Feedback,
} from './exercise-views';

type Props = { queue: Exercise[]; kind: 'lesson' | 'review'; lessonId?: string; title: string };

const FEEDBACK_TEXT: Record<Feedback['result'], string> = {
  correct: 'Верно',
  almost: 'Почти верно — обратите внимание на ү, ө, һ',
  wrong: 'Неверно',
};

export function SessionRunner({ queue, kind, lessonId, title }: Props) {
  const { c } = useTheme();
  const router = useRouter();
  const { pools } = getCourse();
  const [session, setSession] = useState(() => startSession(queue));
  const [pending, setPending] = useState<{ outcome: Outcome; feedback: Feedback } | null>(null);
  const heartsEnabled = useAppStore((s) => s.settings.heartsEnabled);
  const hearts = useAppStore((s) => heartsToday(s.progress, dateKey()));
  const { finishLesson, finishReview, spendHeart } = useAppStore.getState();
  const setLastResult = useLastResult((s) => s.set);
  const useHearts = heartsEnabled && kind === 'lesson';

  const ex = currentExercise(session);

  const finish = (s: typeof session, outOfHearts: boolean) => {
    const xp = outOfHearts ? s.correct : sessionXp(s, kind);
    const grades = s.itemGrades;
    if (!outOfHearts) {
      if (kind === 'lesson' && lessonId) finishLesson({ lessonId, accuracy: accuracy(s), xp, grades });
      else finishReview({ xp, grades });
    } else {
      finishReview({ xp, grades }); // ответы всё равно идут в SRS, урок не засчитывается
    }
    setLastResult({ kind, lessonId, title, accuracy: accuracy(s), xp, mistakes: s.mistakes, outOfHearts });
    router.replace('/result');
  };

  const next = () => {
    const after = advance(session, pending?.outcome);
    setPending(null);
    const noHearts = useHearts && pending?.outcome.result === 'wrong' && hearts - 1 <= 0;
    if (pending?.outcome.result === 'wrong' && useHearts) spendHeart();
    if (noHearts) return finish(after, true);
    if (isFinished(after)) return finish(after, false);
    setSession(after);
  };

  const onResult = (outcome: Outcome, feedback: Feedback) => {
    setPending({ outcome, feedback });
    if (Platform.OS === 'web') return; // в браузере вибрации нет
    const type = { correct: Haptics.NotificationFeedbackType.Success, almost: Haptics.NotificationFeedbackType.Warning, wrong: Haptics.NotificationFeedbackType.Error }[feedback.result];
    Haptics.notificationAsync(type).catch(() => {});
  };

  // Урок мог открыться по прямой ссылке (веб) — тогда «назад» некуда, идём на главную.
  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const canContinue = !!ex && (!isGraded(ex) || pending !== null);
  useWebKeys((key) => {
    if (key === 'Enter' && canContinue) next();
    if (key === 'Escape') close();
  });

  if (!ex) return null;
  const answered = pending !== null;
  const viewProps = { answered, onResult, courseForms: pools.courseForms };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" accessibilityLabel="Закрыть урок" onPress={close} hitSlop={12}>
            <Text style={{ fontSize: 22, color: c.textMuted, fontFamily: fonts.regular }}>✕</Text>
          </Pressable>
          <ProgressBar value={progressOf(session)} />
          {useHearts && <T v="label" color={c.error}>♥ {hearts}</T>}
        </View>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <ExerciseView key={ex.key} ex={ex} {...viewProps} />
        </ScrollView>
        <View style={[styles.footer, { borderColor: c.border, backgroundColor: pending ? { correct: c.successBg, almost: c.warningBg, wrong: c.errorBg }[pending.feedback.result] : c.bg }]}>
          {pending && (
            <View style={{ gap: space.xs }}>
              <T v="heading" color={{ correct: c.success, almost: c.warning, wrong: c.error }[pending.feedback.result]}>
                {FEEDBACK_TEXT[pending.feedback.result]}
              </T>
              {pending.feedback.result !== 'correct' && pending.feedback.correctAnswer && <T>Правильно: {pending.feedback.correctAnswer}</T>}
            </View>
          )}
          {canContinue && <Button title="Дальше" onPress={next} />}
          {Platform.OS === 'web' && (
            <T v="caption" muted style={{ textAlign: 'center' }}>
              {canContinue ? 'Enter — дальше' : 'Клавиши 1–4 — выбор ответа'} · Esc — выйти
            </T>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function ExerciseView({ ex, ...p }: { ex: Exercise; answered: boolean; onResult: (o: Outcome, f: Feedback) => void; courseForms: ReadonlySet<string> }) {
  switch (ex.type) {
    case 'note':
      return <NoteView ex={ex} />;
    case 'intro':
      return <IntroView ex={ex} />;
    case 'multiple_choice':
      return <MultipleChoiceView ex={ex} {...p} />;
    case 'match_pairs':
      return <MatchPairsView ex={ex} {...p} />;
    case 'type_answer':
      return <TypeAnswerView ex={ex} {...p} />;
    case 'minimal_pair_choose':
      return <MinimalPairView ex={ex} {...p} />;
    case 'listen_and_choose':
      return <ListenView ex={ex} {...p} />;
    case 'categorize':
      return <CategorizeView ex={ex} {...p} />;
    case 'build_sentence':
      return <BuildSentenceView ex={ex} {...p} />;
  }
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md },
  body: { padding: space.lg, gap: space.lg },
  footer: { padding: space.lg, gap: space.md, borderTopWidth: StyleSheet.hairlineWidth },
});
