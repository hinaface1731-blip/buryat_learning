import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getCourse } from '@/content/course';
import { EXPLAIN_RETRY } from '@/engine/feedback';
import { accuracy, advance, currentExercise, isFinished, isGraded, progressOf, sessionXp, startSession, type SessionState } from '@/engine/session';
import type { Exercise, Outcome } from '@/engine/types';
import { dateKey } from '@/lib/dates';
import { useAppStore } from '@/store/app-store';
import { useLastResult } from '@/store/last-result';
import { heartsToday, MASTERY_THRESHOLD } from '@/store/logic';
import { useSessionStore } from '@/store/session-store';
import { Button, ProgressBar, Row, T } from '@/ui/components';
import { Mascot, type MascotMood } from '@/ui/Mascot';
import { fonts, space, useTheme } from '@/ui/theme';
import { useWebKeys } from '@/ui/useWebKeys';

import {
  BuildSentenceView,
  CategorizeView,
  DialogueView,
  IntroView,
  ListenView,
  MatchPairsView,
  MinimalPairView,
  MultipleChoiceView,
  NoteView,
  PictureChoiceView,
  TypeAnswerView,
  type Feedback,
} from './exercise-views';

type Props = {
  queue: Exercise[];
  /** Сохранённое состояние, если занятие продолжается. */
  initial?: SessionState;
  kind: 'lesson' | 'review';
  lessonId?: string;
  title: string;
  /** Ключ сохранения; без него занятие не сохраняется. */
  sessionKey?: string;
  /** Свободная практика: без сердечек, урок не засчитывается. */
  practice?: boolean;
  /** Чему учит урок: показывается в итоге. */
  skill?: string;
};

const FEEDBACK_TEXT: Record<Feedback['result'], string> = { correct: 'Верно', almost: 'Почти верно', wrong: 'Неверно' };

const FEEDBACK_MOOD: Record<Feedback['result'], MascotMood> = { correct: 'happy', almost: 'think', wrong: 'support' };

export function SessionRunner({ queue, initial, kind, lessonId, title, sessionKey, practice, skill }: Props) {
  const { c } = useTheme();
  const router = useRouter();
  const { pools, stamp } = getCourse();
  const [session, setSession] = useState(() => initial ?? startSession(queue));
  const [pending, setPending] = useState<{ outcome: Outcome; feedback: Feedback; combo: number; retry: boolean } | null>(null);
  const [combo, setCombo] = useState(0);
  const heartsEnabled = useAppStore((s) => s.settings.heartsEnabled);
  const hearts = useAppStore((s) => heartsToday(s.progress, dateKey()));
  const { finishLesson, finishReview, spendHeart } = useAppStore.getState();
  const { save, clear } = useSessionStore.getState();
  const setLastResult = useLastResult((s) => s.set);
  const useHearts = heartsEnabled && kind === 'lesson' && !practice;

  const ex = currentExercise(session);

  const finish = (s: SessionState, outOfHearts: boolean) => {
    const counts = kind === 'lesson' && !!lessonId && !outOfHearts && !practice;
    const xp = outOfHearts ? s.correct : sessionXp(s, counts ? 'lesson' : 'review');
    if (counts) finishLesson({ lessonId: lessonId!, accuracy: accuracy(s), xp, grades: s.itemGrades });
    else finishReview({ xp, grades: s.itemGrades }); // ответы идут в SRS, урок не засчитывается
    if (sessionKey) clear(sessionKey);
    setLastResult({
      kind,
      lessonId,
      title,
      accuracy: accuracy(s),
      xp,
      mistakes: s.mistakes,
      outOfHearts,
      practice: !!practice,
      mastered: accuracy(s) >= MASTERY_THRESHOLD,
      skill: counts ? skill : undefined,
    });
    router.replace('/result');
  };

  const next = () => {
    const after = advance(session, pending?.outcome);
    const wrong = pending?.outcome.result === 'wrong';
    setPending(null);
    const noHearts = useHearts && wrong && hearts - 1 <= 0;
    if (wrong && useHearts) spendHeart();
    if (noHearts) return finish(after, true);
    if (isFinished(after)) return finish(after, false);
    if (sessionKey) save(sessionKey, after, stamp);
    setSession(after);
  };

  const onResult = (outcome: Outcome, feedback: Feedback) => {
    const nextCombo = outcome.result === 'correct' ? combo + 1 : 0;
    setCombo(nextCombo);
    setPending({ outcome, feedback, combo: nextCombo, retry: !!ex?.key.endsWith('~retry') });
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
  const result = pending?.feedback.result;
  const celebrate = pending && pending.combo >= 3;
  const detail = pending?.feedback.detail ?? (result === 'wrong' && pending?.retry ? EXPLAIN_RETRY : undefined);

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
        <View style={[styles.footer, { borderColor: c.border, backgroundColor: result ? { correct: c.successBg, almost: c.warningBg, wrong: c.errorBg }[result] : c.bg }]}>
          {pending && result && (
            <Row gap={space.md} style={{ alignItems: 'center' }}>
              <Mascot mood={FEEDBACK_MOOD[result]} size={64} />
              <View style={{ flex: 1, gap: space.xs }}>
                <T v="heading" color={{ correct: c.success, almost: c.warning, wrong: c.error }[result]}>
                  {celebrate ? `${FEEDBACK_TEXT[result]} · ${pending.combo} подряд!` : FEEDBACK_TEXT[result]}
                </T>
                {detail && <T>{detail}</T>}
                {result !== 'correct' && pending.feedback.correctAnswer && <T>Правильно: {pending.feedback.correctAnswer}</T>}
              </View>
            </Row>
          )}
          {canContinue && <Button title="Дальше" onPress={next} />}
          {Platform.OS === 'web' && (
            <T v="caption" muted style={{ textAlign: 'center' }}>
              {canContinue ? 'Enter — дальше' : 'Клавиши 1–4 — выбор ответа'} · Esc — выйти, прогресс сохранится
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
    case 'picture_choice':
      return <PictureChoiceView ex={ex} {...p} />;
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
    case 'dialogue':
      return <DialogueView ex={ex} {...p} />;
  }
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md },
  body: { padding: space.lg, gap: space.lg },
  footer: { padding: space.lg, gap: space.md, borderTopWidth: StyleSheet.hairlineWidth },
});
