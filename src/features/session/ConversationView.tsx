import { Image } from 'expo-image';
import { useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AudioButton } from '@/audio/AudioButton';
import { playSfx } from '@/audio/sfx';
import type { ConversationLine, ConversationOption } from '@/content/schema';
import { conversationScore } from '@/engine/conversation';
import { createRng, seedFrom, shuffle } from '@/engine/rng';
import type { Outcome } from '@/engine/types';
import { useAppStore } from '@/store/app-store';
import { ART } from '@/ui/art';
import { Avatar } from '@/ui/Avatar';
import { CharacterFace } from '@/ui/Character';
import { Card, OptionButton, Row, T } from '@/ui/components';
import { Mascot } from '@/ui/Mascot';
import { Appear } from '@/ui/motion';
import { radius, space, useTheme } from '@/ui/theme';
import { optionIndex, useWebKeys } from '@/ui/useWebKeys';

import type { ViewProps } from './exercise-views';

type Verdict = ConversationOption['verdict'];
type Bubble = { who: 'seseg' | 'me'; line: ConversationLine };

/**
 * Разговор с Сэсэг. Она говорит, ученик выбирает ответ. «Почти» засчитывается с объяснением и
 * разговор идёт дальше; неверный ответ объясняется, и ученик выбирает ещё раз.
 */
export function ConversationView({ ex, answered, onResult }: ViewProps<'conversation'>) {
  const { c } = useTheme();
  const avatar = useAppStore((s) => s.settings.avatar);
  const { conv } = ex;
  const [step, setStep] = useState(0);
  const [bubbles, setBubbles] = useState<Bubble[]>(() => [{ who: 'seseg', line: conv.steps[0].say }]);
  const [hint, setHint] = useState<{ verdict: Verdict; text: string } | null>(null);
  const [tried, setTried] = useState<Set<string>>(new Set());
  const first = useRef<Verdict[]>([]);
  const [score, setScore] = useState<(ReturnType<typeof conversationScore> & { right: number }) | null>(null);
  const current = conv.steps[step];
  const options = useMemo(() => shuffle(current?.options ?? [], createRng(seedFrom(`${conv.id}-${step}`))), [conv.id, step, current]);

  const finish = () => {
    const s = conversationScore(first.current);
    setScore({ ...s, right: first.current.filter((v) => v === 'correct').length });
    const perItem: Record<string, Outcome['result']> = {};
    conv.steps.forEach((st, i) => {
      const id = st.options.find((o) => o.verdict === 'correct' && o.wordId)?.wordId;
      if (id) perItem[id] = first.current[i] ?? 'correct';
    });
    const detail = s.stars === 3 ? 'Весь разговор — без ошибок!' : 'Пройдите разговор ещё раз, чтобы ответить всё с первого раза.';
    onResult({ result: s.result, perItem }, { result: s.result, detail });
  };

  const pick = (o: ConversationOption) => {
    if (answered || score || !current) return;
    if (first.current.length === step) first.current.push(o.verdict);
    if (o.verdict === 'wrong') {
      playSfx('wrong');
      setTried((t) => new Set(t).add(o.buryat));
      setHint({ verdict: 'wrong', text: o.explain ?? 'Не подходит. Попробуйте другой вариант.' });
      return;
    }
    playSfx(o.verdict === 'correct' ? 'match' : 'almost');
    setHint(o.explain ? { verdict: o.verdict, text: o.explain } : null);
    const next: Bubble[] = [{ who: 'me', line: o }, ...(current.reply ? [{ who: 'seseg' as const, line: current.reply }] : [])];
    const nextStep = conv.steps[step + 1];
    if (nextStep) next.push({ who: 'seseg', line: nextStep.say });
    setBubbles((b) => [...b, ...next]);
    setTried(new Set());
    setStep(step + 1);
    if (!nextStep) finish();
  };

  useWebKeys((key) => {
    const i = optionIndex(key, options.length);
    if (i !== null) pick(options[i]);
  }, !answered && !score);

  return (
    <View style={{ gap: space.md }}>
      <T v="heading">{conv.title}</T>
      <T muted>{conv.scene}</T>
      {bubbles.length <= 1 && conv.art && ART[conv.art] && <Image source={ART[conv.art]} style={styles.art} contentFit="cover" loading="eager" accessible={false} />}
      <View style={{ gap: space.sm }}>
        {bubbles.map((b, i) => {
          const seseg = b.who === 'seseg';
          return (
            <Appear key={i} style={[styles.row, { justifyContent: seseg ? 'flex-start' : 'flex-end' }]}>
              {seseg && <CharacterFace id="seseg" />}
              <View style={[styles.bubble, { backgroundColor: seseg ? c.surface : c.surfaceAlt, borderColor: c.border }]}>
                <Row gap={space.sm} style={{ alignItems: 'center' }}>
                  <T v="label" style={{ fontSize: 18, lineHeight: 24, flexShrink: 1 }}>
                    {b.line.buryat}
                  </T>
                  {seseg && b.line.wordId && <AudioButton id={b.line.wordId} autoPlay={i === bubbles.length - 1} />}
                </Row>
                <T v="caption" muted>
                  {b.line.russian}
                </T>
              </View>
              {!seseg && <Avatar id={avatar} size={40} />}
            </Appear>
          );
        })}
      </View>
      {hint && (
        <Appear>
          <Card style={{ flexDirection: 'row', gap: space.md, alignItems: 'center', borderColor: hint.verdict === 'wrong' ? c.error : c.warning }}>
            <Mascot mood={hint.verdict === 'wrong' ? 'support' : 'think'} size={52} />
            <T style={{ flex: 1 }}>{hint.text}</T>
          </Card>
        </Appear>
      )}
      {current && !score && !answered && (
        <View style={{ gap: space.sm }}>
          <T v="caption" muted>
            Ваш ответ:
          </T>
          {options.map((o) => (
            <OptionButton key={o.buryat} label={o.buryat} buryat state={tried.has(o.buryat) ? 'wrong' : 'idle'} disabled={tried.has(o.buryat)} onPress={() => pick(o)} />
          ))}
        </View>
      )}
      {score && (
        <Appear kind="pop">
          <Card style={{ alignItems: 'center', gap: space.xs }}>
            <T v="title" color={c.accent}>
              {'★'.repeat(score.stars)}
              <T v="title" color={c.border}>
                {'★'.repeat(3 - score.stars)}
              </T>
            </T>
            <T muted>
              С первого раза: {score.right} из {conv.steps.length}
            </T>
          </Card>
        </Appear>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  art: { width: '100%', aspectRatio: 3 / 2, borderRadius: radius.lg },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm },
  bubble: { flexShrink: 1, maxWidth: '80%', borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.lg, paddingVertical: space.sm, paddingHorizontal: space.md, gap: 2 },
});
