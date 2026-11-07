import { Image } from 'expo-image';
import { useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { AudioButton } from '@/audio/AudioButton';
import { playSfx } from '@/audio/sfx';
import type { VowelRowId } from '@/content/schema';
import { checkBuryat, checkRussian, normalizeAnswer } from '@/engine/check';
import { EXPLAIN_MATCH, EXPLAIN_ORDER, EXPLAIN_ROWS, explainPair, explainTyped } from '@/engine/feedback';
import type { Exercise, Outcome, SceneOpening, StudyItem } from '@/engine/types';
import { BuryatKeysBar, insertAt } from '@/ui/BuryatKeysBar';
import { Button, Card, OptionButton, Row, T, UnverifiedBadge, type OptionState } from '@/ui/components';
import { ART } from '@/ui/art';
import { CharacterFace, CharacterFigure, CharacterPose } from '@/ui/Character';
import { Mascot } from '@/ui/Mascot';
import { Appear } from '@/ui/motion';
import { fonts, radius, space, useTheme } from '@/ui/theme';
import { optionIndex, useWebKeys } from '@/ui/useWebKeys';

export type Feedback = { result: Outcome['result']; correctAnswer?: string; /** Конкретная причина ошибки. */ detail?: string };
export type ViewProps<K extends Exercise['type']> = {
  ex: Extract<Exercise, { type: K }>;
  answered: boolean;
  onResult: (o: Outcome, f: Feedback) => void;
  courseForms: ReadonlySet<string>;
};

const one = (id: string, result: Outcome['result']): Outcome => ({ result, perItem: { [id]: result } });

/** Веб: клавиши 1…N выбирают вариант ответа. */
function useOptionKeys(options: string[], pick: (o: string) => void, answered: boolean) {
  useWebKeys((key) => {
    const i = optionIndex(key, options.length);
    if (i !== null) pick(options[i]);
  }, !answered);
}

const BOOK_LABEL: Record<string, string> = { 'bxr-textbook': 'Учебник', 'native-speaker': 'Носитель', zugaa: 'Разговорник Burlang', translator: 'Машинный перевод' };

function sourceLine(s: { book: string; page?: number; section?: string }): string {
  return [BOOK_LABEL[s.book] ?? s.book, s.page ? `стр. ${s.page}` : null, s.section].filter(Boolean).join(', ');
}

// Фонетика внутри фразы: особая буква объясняется там, где встретилась.
const LETTER_TIPS: [string, string][] = [
  ['һ', 'Һ — глубокий звук из гортани; в начале слова глухой, в середине звонкий.'],
  ['ү', 'Ү — узкий гласный, как «у» в слове «луна».'],
  ['ө', 'Ө — широкий гласный, близкий к русскому «о», всегда долгий.'],
];

function letterTip(text: string): string | null {
  const lower = text.toLowerCase();
  return LETTER_TIPS.find(([ch]) => lower.includes(ch))?.[1] ?? null;
}

export function PictureChoiceView({ ex, answered, onResult }: ViewProps<'picture_choice'>) {
  const [picked, setPicked] = useState<string | null>(null);
  const pick = (o: string) => {
    if (answered) return;
    setPicked(o);
    const result = o === ex.answer ? 'correct' : 'wrong';
    onResult(one(ex.item.id, result), { result, correctAnswer: `${ex.answer} — ${ex.item.russian}` });
  };
  useOptionKeys(ex.options, pick, answered);
  return (
    <View style={{ gap: space.lg }}>
      <T muted>Как это по-бурятски?</T>
      <Image source={ART[ex.image]} style={styles.picture} contentFit="contain" loading="eager" accessible={false} />
      <UnverifiedBadge verified={ex.item.verified} />
      <View style={{ gap: space.sm }}>
        {ex.options.map((o) => (
          <OptionButton key={o} label={o} buryat state={!answered ? 'idle' : o === ex.answer ? 'correct' : o === picked ? 'wrong' : 'dim'} onPress={() => pick(o)} disabled={answered} />
        ))}
      </View>
    </View>
  );
}

export function NoteView({ ex }: { ex: Extract<Exercise, { type: 'note' }> }) {
  return (
    <Card>
      <Row gap={space.md}>
        <Mascot mood="read" size={64} />
        <T v="caption" muted>
          Что нужно знать
        </T>
      </Row>
      <T v="heading">{ex.note.title}</T>
      <T>{ex.note.body}</T>
      {ex.note.source && (
        <T v="caption" muted>
          {sourceLine(ex.note.source)}
        </T>
      )}
      <UnverifiedBadge verified={ex.note.verified} label="текст не проверен" />
    </Card>
  );
}

const OPENING_INVITE: Record<SceneOpening['speaker'], string> = {
  seseg: 'Так говорит Сэсэг. Запомните: скоро ваша очередь отвечать.',
  bair: 'Это ваша реплика. Скоро скажете её Сэсэг сами.',
};

/** Реплика разговорного урока: сразу герой и его речь, а не словарная карточка. */
function PhraseIntro({ item, opening }: { item: StudyItem; opening: SceneOpening }) {
  const { c } = useTheme();
  const tip = letterTip(item.buryat);
  return (
    <View style={{ gap: space.md }}>
      {opening.art && <Image source={ART[opening.art]} style={styles.sceneArt} contentFit="cover" loading="eager" accessible={false} />}
      {opening.scene && <T muted>{opening.scene}</T>}
      <Row gap={space.sm} style={{ alignItems: 'flex-end' }}>
        <Appear kind="pop">
          <CharacterFigure id={opening.speaker} height={opening.art ? 130 : 190} />
        </Appear>
        <Appear delay={120} style={{ flex: 1 }}>
          <View style={[styles.speech, { backgroundColor: c.surface, borderColor: c.border }]}>
            <Row gap={space.sm} style={{ flexWrap: 'wrap' }}>
              <T v="buryat" selectable style={{ flexShrink: 1 }}>
                {item.buryat}
              </T>
              <AudioButton id={item.id} autoPlay />
            </Row>
            <T muted>{item.russian}</T>
          </View>
        </Appear>
      </Row>
      <T v="label" color={c.primary}>
        {OPENING_INVITE[opening.speaker]}
      </T>
      {tip && (
        <T v="caption" muted>
          {tip}
        </T>
      )}
      <UnverifiedBadge verified={item.verified} />
    </View>
  );
}

export function IntroView({ ex }: { ex: Extract<Exercise, { type: 'intro' }> }) {
  const { item } = ex;
  if (ex.opening) return <PhraseIntro item={item} opening={ex.opening} />;
  const extra = item.kind === 'word' ? item.word.alternatives : [];
  const source = item.kind === 'word' ? item.word.source : item.letter.source;
  return (
    <Card style={{ alignItems: 'flex-start', gap: space.md }}>
      <T v="caption" muted>
        {item.kind === 'letter' ? 'Новая буква' : 'Новое слово'}
      </T>
      {item.kind === 'word' && item.word.image && <Image source={ART[item.word.image]} style={styles.picture} contentFit="contain" loading="eager" accessible={false} />}
      <Row gap={space.lg}>
        <T v="buryatLarge" selectable>
          {item.buryat}
        </T>
        <AudioButton id={item.id} autoPlay />
      </Row>
      <T v="heading">{item.kind === 'letter' ? `называется «${item.russian}»` : item.russian}</T>
      {extra.length > 0 && <T muted>также: {extra.join(', ')}</T>}
      {item.kind === 'word' && letterTip(item.buryat) && <T muted>{letterTip(item.buryat)}</T>}
      <T v="caption" muted>
        {sourceLine(source)}
      </T>
      <UnverifiedBadge verified={item.verified} />
    </Card>
  );
}

export function MultipleChoiceView({ ex, answered, onResult }: ViewProps<'multiple_choice'>) {
  const [picked, setPicked] = useState<string | null>(null);
  const buryatOptions = ex.direction === 'ru-bur';
  const isPhrase = ex.item.kind === 'word' && ex.item.word.tags.includes('phrase');
  const question =
    ex.item.kind === 'letter'
      ? ex.direction === 'bur-ru'
        ? 'Как называется буква?'
        : 'Какая это буква?'
      : ex.direction === 'bur-ru'
        ? isPhrase
          ? 'Что значит эта фраза?'
          : 'Что значит слово?'
        : 'Как сказать по-бурятски?';
  const pick = (o: string) => {
    if (answered) return;
    setPicked(o);
    const ok = buryatOptions ? normalizeAnswer(o) === normalizeAnswer(ex.answer) : checkRussian(o, [ex.answer]) === 'correct';
    onResult(one(ex.item.id, ok ? 'correct' : 'wrong'), { result: ok ? 'correct' : 'wrong', correctAnswer: ex.answer });
  };
  useOptionKeys(ex.options, pick, answered);
  const state = (o: string): OptionState => {
    if (!answered) return 'idle';
    if (o === ex.answer) return 'correct';
    return o === picked ? 'wrong' : 'dim';
  };
  return (
    <View style={{ gap: space.lg }}>
      <T muted>{question}</T>
      <Row gap={space.md}>
        {isPhrase && <CharacterFace id={buryatOptions ? 'bair' : 'seseg'} size={48} />}
        <T v={buryatOptions || isPhrase ? 'heading' : 'buryatLarge'} style={{ flexShrink: 1, ...(isPhrase && !buryatOptions ? { fontSize: 24, lineHeight: 31 } : null) }}>
          {ex.prompt}
        </T>
        {!buryatOptions && <AudioButton id={ex.item.id} />}
      </Row>
      <UnverifiedBadge verified={ex.item.verified} />
      <View style={{ gap: space.sm }}>
        {ex.options.map((o) => (
          <OptionButton key={o} label={o} buryat={buryatOptions} state={state(o)} onPress={() => pick(o)} disabled={answered} />
        ))}
      </View>
    </View>
  );
}

export function MatchPairsView({ ex, answered, onResult }: ViewProps<'match_pairs'>) {
  const { c } = useTheme();
  const [left, setLeft] = useState<string | null>(null);
  const [matched, setMatched] = useState<string[]>([]);
  const [flash, setFlash] = useState<string | null>(null);
  const wrongItems = useRef(new Set<string>());
  const byBuryat = useMemo(() => new Map(ex.items.map((i) => [i.buryat, i])), [ex.items]);

  const tapRight = (russian: string) => {
    if (!left || answered) return;
    const item = byBuryat.get(left)!;
    if (item.russian === russian) {
      const next = [...matched, item.id];
      setMatched(next);
      setLeft(null);
      if (next.length < ex.items.length) playSfx('match');
      if (next.length === ex.items.length) {
        const perItem = Object.fromEntries(ex.items.map((i) => [i.id, wrongItems.current.has(i.id) ? ('wrong' as const) : ('correct' as const)]));
        const result = wrongItems.current.size ? 'almost' : 'correct';
        onResult({ result, perItem }, { result, detail: result === 'almost' ? EXPLAIN_MATCH : undefined });
      }
    } else {
      wrongItems.current.add(item.id);
      playSfx('wrong');
      setFlash(russian);
      setTimeout(() => setFlash(null), 450);
    }
  };
  const isMatchedLeft = (b: string) => matched.includes(byBuryat.get(b)!.id);
  const isMatchedRight = (r: string) => ex.items.some((i) => i.russian === r && matched.includes(i.id));
  return (
    <View style={{ gap: space.lg }}>
      <T muted>Сопоставьте пары</T>
      <Row style={{ alignItems: 'flex-start' }} gap={space.md}>
        <View style={{ flex: 1, gap: space.sm }}>
          {ex.left.map((b) => (
            <OptionButton key={b} label={b} buryat state={isMatchedLeft(b) ? 'correct' : left === b ? 'selected' : 'idle'} disabled={isMatchedLeft(b)} onPress={() => setLeft(b)} />
          ))}
        </View>
        <View style={{ flex: 1, gap: space.sm }}>
          {ex.right.map((r) => (
            <OptionButton key={r} label={r} state={isMatchedRight(r) ? 'correct' : flash === r ? 'wrong' : 'idle'} disabled={isMatchedRight(r)} onPress={() => tapRight(r)} />
          ))}
        </View>
      </Row>
      {!left && matched.length === 0 && (
        <T v="caption" style={{ color: c.textMuted }}>
          Выберите слово слева, затем перевод справа.
        </T>
      )}
    </View>
  );
}

export function TypeAnswerView({ ex, answered, onResult, courseForms }: ViewProps<'type_answer'>) {
  const { c } = useTheme();
  const [value, setValue] = useState('');
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const inputId = `type-${ex.key}`;
  const onKey = (ch: string) => {
    const r = insertAt(value, selection, ch);
    setValue(r.value);
    setSelection({ start: r.cursor, end: r.cursor });
  };
  const submit = () => {
    if (answered || !value.trim()) return;
    const result = checkBuryat(value, ex.answers, { courseForms });
    onResult(one(ex.item.id, result), { result, correctAnswer: ex.answers[0], detail: explainTyped(value, ex.answers[0], courseForms) });
  };
  return (
    <View style={{ gap: space.lg }}>
      <T muted>Напишите по-бурятски</T>
      <T v="heading">{ex.prompt}</T>
      <UnverifiedBadge verified={ex.item.verified} />
      <TextInput
        value={value}
        onChangeText={setValue}
        selection={selection}
        onSelectionChange={(e) => setSelection(e.nativeEvent.selection)}
        inputAccessoryViewID={inputId}
        editable={!answered}
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        autoFocus
        returnKeyType="done"
        onSubmitEditing={submit}
        placeholder="Ответ"
        placeholderTextColor={c.textMuted}
        accessibilityLabel="Поле ответа"
        style={[styles.input, { color: c.text, borderColor: c.border, backgroundColor: c.surface }]}
      />
      <BuryatKeysBar nativeID={inputId} onKey={onKey} />
      {!answered && <Button title="Проверить" onPress={submit} disabled={!value.trim()} />}
    </View>
  );
}

export function SpellWordView({ ex, answered, onResult, courseForms }: ViewProps<'spell_word'>) {
  const { c } = useTheme();
  const [chosen, setChosen] = useState<number[]>([]);
  const pickTile = (i: number) => {
    playSfx('tap');
    setChosen([...chosen, i]);
  };
  const built = chosen.map((i) => ex.tiles[i]).join('');
  const submit = () => {
    if (answered || !chosen.length) return;
    const result = checkBuryat(built, [ex.answer], { courseForms });
    onResult(one(ex.item.id, result), { result, correctAnswer: ex.answer, detail: explainTyped(built, ex.answer, courseForms) });
  };
  // Веб: буква с клавиатуры берёт свободную плитку, Backspace убирает последнюю, Enter проверяет.
  useWebKeys((key) => {
    if (key === 'Enter') return submit();
    if (key === 'Backspace') return setChosen(chosen.slice(0, -1));
    const i = ex.tiles.findIndex((t, j) => t === key.toLowerCase() && !chosen.includes(j));
    if (i >= 0) pickTile(i);
  }, !answered);
  return (
    <View style={{ gap: space.lg }}>
      <T muted>Соберите слово из букв</T>
      <T v="heading">{ex.prompt}</T>
      <UnverifiedBadge verified={ex.item.verified} />
      <View style={[styles.wrap, styles.spellSlot, { borderColor: c.border }]} accessibilityLabel={built ? `Собрано: ${built}` : 'Пока пусто'}>
        {chosen.map((i) => (
          <View key={`c${i}`} style={styles.tile}>
            <OptionButton label={ex.tiles[i]} buryat state="selected" disabled={answered} onPress={() => setChosen(chosen.filter((x) => x !== i))} />
          </View>
        ))}
      </View>
      <View style={[styles.wrap, { justifyContent: 'center' }]}>
        {ex.tiles.map((t, i) => (
          <View key={`t${i}`} style={[styles.tile, chosen.includes(i) && { opacity: 0 }]} accessibilityElementsHidden={chosen.includes(i)} importantForAccessibility={chosen.includes(i) ? 'no-hide-descendants' : 'auto'}>
            <OptionButton label={t} buryat disabled={answered || chosen.includes(i)} onPress={() => pickTile(i)} />
          </View>
        ))}
      </View>
      <T v="caption" muted>
        Буквы можно убрать нажатием. Есть лишние.
      </T>
      {!answered && <Button title="Проверить" onPress={submit} disabled={!chosen.length} />}
    </View>
  );
}

export function MinimalPairView({ ex, answered, onResult }: ViewProps<'minimal_pair_choose'>) {
  const [picked, setPicked] = useState<string | null>(null);
  const pick = (o: string) => {
    if (answered) return;
    setPicked(o);
    // Строгое сравнение: здесь важна каждая буква и долгота.
    const result = normalizeAnswer(o) === normalizeAnswer(ex.answer) ? 'correct' : 'wrong';
    onResult(one(ex.target.id, result), {
      result,
      correctAnswer: `${ex.target.buryat} — ${ex.target.russian}; ${ex.other.buryat} — ${ex.other.russian}`,
      detail: result === 'wrong' ? explainPair(ex.pair.contrast) : undefined,
    });
  };
  useOptionKeys(ex.options, pick, answered);
  return (
    <View style={{ gap: space.lg }}>
      <Row gap={space.md}>
        {!answered && <Mascot mood="think" size={64} />}
        <T muted style={{ flex: 1 }}>
          Слова почти одинаковые. Выберите слово со значением
        </T>
      </Row>
      <T v="heading">«{ex.prompt}»</T>
      <UnverifiedBadge verified={ex.pair.verified && ex.target.verified && ex.other.verified} />
      <Row gap={space.md}>
        {ex.options.map((o) => (
          <View key={o} style={{ flex: 1 }}>
            <OptionButton label={o} buryat state={!answered ? 'idle' : o === ex.answer ? 'correct' : o === picked ? 'wrong' : 'dim'} onPress={() => pick(o)} disabled={answered} />
          </View>
        ))}
      </Row>
    </View>
  );
}

export function ListenView({ ex, answered, onResult }: ViewProps<'listen_and_choose'>) {
  const [picked, setPicked] = useState<string | null>(null);
  const pick = (o: string) => {
    if (answered) return;
    setPicked(o);
    const result = o === ex.answer ? 'correct' : 'wrong';
    onResult(one(ex.item.id, result), { result, correctAnswer: `${ex.answer} — ${ex.item.russian}` });
  };
  useOptionKeys(ex.options, pick, answered);
  return (
    <View style={{ gap: space.lg }}>
      <T muted>Что вы слышите?</T>
      <AudioButton id={ex.audioId} size="lg" autoPlay />
      <View style={{ gap: space.sm }}>
        {ex.options.map((o) => (
          <OptionButton key={o} label={o} buryat state={!answered ? 'idle' : o === ex.answer ? 'correct' : o === picked ? 'wrong' : 'dim'} onPress={() => pick(o)} disabled={answered} />
        ))}
      </View>
    </View>
  );
}

const ROW_LABEL: Record<VowelRowId, string> = { back: 'Задний', front: 'Передний', neutral: 'Нейтр.' };

export function CategorizeView({ ex, answered, onResult }: ViewProps<'categorize'>) {
  const { c } = useTheme();
  const [choice, setChoice] = useState<Record<string, VowelRowId>>({});
  const complete = ex.items.every((x) => choice[x.item.id]);
  const submit = () => {
    const perItem = Object.fromEntries(ex.items.map((x) => [x.item.id, choice[x.item.id] === x.row ? ('correct' as const) : ('wrong' as const)]));
    const wrong = Object.values(perItem).filter((r) => r === 'wrong').length;
    const result = wrong === 0 ? 'correct' : wrong === 1 ? 'almost' : 'wrong';
    onResult({ result, perItem }, { result, correctAnswer: ex.items.map((x) => `${x.item.buryat} — ${ROW_LABEL[x.row].toLowerCase()}`).join('; '), detail: result === 'correct' ? undefined : EXPLAIN_ROWS });
  };
  return (
    <View style={{ gap: space.md }}>
      <Row gap={space.md}>
        {!answered && <Mascot mood="think" size={64} />}
        <T muted style={{ flex: 1 }}>
          К какому ряду относятся гласные слова?
        </T>
      </Row>
      <UnverifiedBadge verified={false} label="ряды подсказаны автоматически по таблице учебника, не проверено" />
      {ex.items.map(({ item, row }) => (
        <View key={item.id} style={[styles.catRow, { borderColor: c.border, backgroundColor: c.surface }]}>
          <T v="buryat" style={{ flex: 1 }}>
            {item.buryat}
          </T>
          <Row gap={space.xs}>
            {ex.rows.map((r) => {
              const selected = choice[item.id] === r;
              const bg = answered ? (r === row ? c.successBg : selected ? c.errorBg : c.surface) : selected ? c.primary : c.surfaceAlt;
              const fg = !answered && selected ? c.onPrimary : c.text;
              return (
                <Pressable key={r} accessibilityRole="button" accessibilityLabel={`${item.buryat}: ${ROW_LABEL[r]}`} disabled={answered} onPress={() => setChoice({ ...choice, [item.id]: r })} style={[styles.chip, { backgroundColor: bg }]}>
                  <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: fg }}>{ROW_LABEL[r]}</Text>
                </Pressable>
              );
            })}
          </Row>
        </View>
      ))}
      {!answered && <Button title="Проверить" onPress={submit} disabled={!complete} />}
    </View>
  );
}

export function BuildSentenceView({ ex, answered, onResult }: ViewProps<'build_sentence'>) {
  const [chosen, setChosen] = useState<number[]>([]);
  const pickTile = (i: number) => {
    playSfx('tap');
    setChosen([...chosen, i]);
  };
  const submit = () => {
    const built = chosen.map((i) => ex.tokens[i]).join(' ');
    const result = normalizeAnswer(built) === normalizeAnswer(ex.answer.join(' ')) ? 'correct' : 'wrong';
    onResult(one(ex.sentence.id, result), { result, correctAnswer: ex.sentence.buryat, detail: result === 'wrong' ? EXPLAIN_ORDER : undefined });
  };
  return (
    <View style={{ gap: space.lg }}>
      <T muted>Соберите предложение</T>
      <T v="heading">{ex.prompt}</T>
      <UnverifiedBadge verified={ex.sentence.verified} />
      <View style={styles.wrap}>
        {chosen.map((i) => (
          <OptionButton key={`c${i}`} label={ex.tokens[i]} buryat state="selected" disabled={answered} onPress={() => setChosen(chosen.filter((x) => x !== i))} />
        ))}
      </View>
      <View style={styles.wrap}>
        {ex.tokens.map((t, i) =>
          chosen.includes(i) ? null : <OptionButton key={`t${i}`} label={t} buryat disabled={answered} onPress={() => pickTile(i)} />,
        )}
      </View>
      {!answered && <Button title="Проверить" onPress={submit} disabled={chosen.length !== ex.tokens.length} />}
    </View>
  );
}

export function DialogueView({ ex, answered, onResult }: ViewProps<'dialogue'>) {
  const { c } = useTheme();
  // Реплики партнёра открываются сами до ближайшего хода ученика.
  const nextTurn = (from: number) => {
    let i = from;
    while (i < ex.lines.length && ex.lines[i].role === 'partner') i++;
    return i;
  };
  const [turn, setTurn] = useState(() => nextTurn(0));
  const wrong = useRef(new Set<string>());
  const [lastWrong, setLastWrong] = useState<string | null>(null);
  const current = ex.lines[turn];
  const finished = turn >= ex.lines.length;

  const finish = () => {
    const perItem: Record<string, Outcome['result']> = {};
    for (const line of ex.lines) if (line.role === 'learner') perItem[line.item.id] = wrong.current.has(line.item.id) ? 'wrong' : 'correct';
    const result = wrong.current.size === 0 ? 'correct' : wrong.current.size === 1 ? 'almost' : 'wrong';
    onResult({ result, perItem }, { result, detail: result === 'correct' ? 'Весь разговор — без ошибок!' : 'Реплики с ошибками вернутся в повторении.' });
  };

  const pick = (o: string) => {
    if (!current || answered) return;
    if (o !== current.item.buryat) {
      wrong.current.add(current.item.id);
      playSfx('wrong');
      setLastWrong(o);
      return; // ученик находит верную реплику сам: разговор идёт дальше только с ней
    }
    setLastWrong(null);
    const next = nextTurn(turn + 1);
    setTurn(next);
    if (next >= ex.lines.length) finish();
    else playSfx('match');
  };
  useOptionKeys(current?.options ?? [], pick, answered || finished);

  const shown = ex.lines.slice(0, turn);
  return (
    <View style={{ gap: space.md }}>
      <T v="heading">{ex.title}</T>
      <T muted>{ex.scene}</T>
      {/* В начале сцены — иллюстрация, дальше место нужно репликам. */}
      {shown.length <= 1 &&
        (ex.art ? (
          <Image source={ART[ex.art]} style={styles.sceneArt} contentFit="cover" loading="eager" accessible={false} />
        ) : (
          <Row style={{ justifyContent: 'center' }} gap={space.xl}>
            <CharacterFigure id="seseg" />
            <CharacterFigure id="bair" />
          </Row>
        ))}
      <View style={{ gap: space.sm }}>
        {shown.map((line, i) => {
          const partner = line.role === 'partner';
          return (
            <Appear key={i} style={[styles.bubbleRow, { justifyContent: partner ? 'flex-start' : 'flex-end' }]}>
              {partner && <CharacterFace id="seseg" />}
              <View style={[styles.bubble, { backgroundColor: partner ? c.surface : c.surfaceAlt, borderColor: c.border }]}>
                <T v="label" style={{ fontSize: 18, lineHeight: 24 }}>
                  {line.item.buryat}
                </T>
                <T v="caption" muted>
                  {line.item.russian}
                </T>
              </View>
              {!partner && <CharacterFace id="bair" />}
            </Appear>
          );
        })}
      </View>
      {current && !answered && (
        <View style={{ gap: space.sm }}>
          {lastWrong && (
            <Row gap={space.md}>
              <Appear kind="pop">
                <CharacterPose pose="seseg-think" height={84} />
              </Appear>
              <T muted style={{ flex: 1 }}>
                Сэсэг ждёт другого ответа. Подумайте ещё.
              </T>
            </Row>
          )}
          <T muted>Ваша реплика: «{current.item.russian}»</T>
          {current.options.map((o) => (
            <OptionButton key={o} label={o} buryat state={o === lastWrong ? 'wrong' : 'idle'} onPress={() => pick(o)} />
          ))}
        </View>
      )}
      <UnverifiedBadge verified={ex.lines.every((l) => l.item.verified)} />
    </View>
  );
}

const styles = StyleSheet.create({
  picture: { width: '100%', height: 170 },
  sceneArt: { width: '100%', aspectRatio: 3 / 2, borderRadius: radius.lg },
  speech: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.lg, borderBottomLeftRadius: radius.sm, padding: space.md, gap: space.xs, marginBottom: space.lg },
  bubbleRow: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm },
  bubble: { flexShrink: 1, maxWidth: '78%', borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.lg, paddingVertical: space.sm, paddingHorizontal: space.md, gap: 2 },
  input: { borderWidth: 1.5, borderRadius: radius.md, paddingHorizontal: space.lg, paddingVertical: 14, fontSize: 22, fontFamily: fonts.semibold },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.md, padding: space.md },
  chip: { paddingHorizontal: space.sm, paddingVertical: 8, borderRadius: radius.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, minHeight: 54 },
  spellSlot: { borderBottomWidth: 1.5, paddingBottom: space.sm, minHeight: 64 },
  tile: { minWidth: 48 },
});
