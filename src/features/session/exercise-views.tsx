import { useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { AudioButton } from '@/audio/AudioButton';
import type { VowelRowId } from '@/content/schema';
import { checkBuryat, checkRussian, normalizeAnswer } from '@/engine/check';
import type { Exercise, Outcome } from '@/engine/types';
import { BuryatKeysBar, insertAt } from '@/ui/BuryatKeysBar';
import { Button, Card, OptionButton, Row, T, UnverifiedBadge, type OptionState } from '@/ui/components';
import { fonts, radius, space, useTheme } from '@/ui/theme';
import { optionIndex, useWebKeys } from '@/ui/useWebKeys';

export type Feedback = { result: Outcome['result']; correctAnswer?: string };
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

function sourceLine(s: { book: string; page?: number; section?: string }): string {
  const book = s.book === 'bxr-textbook' ? 'Учебник' : s.book === 'native-speaker' ? 'Носитель' : s.book;
  return [book, s.page ? `стр. ${s.page}` : null, s.section].filter(Boolean).join(', ');
}

export function NoteView({ ex }: { ex: Extract<Exercise, { type: 'note' }> }) {
  return (
    <Card>
      <T v="caption" muted>
        Что нужно знать
      </T>
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

export function IntroView({ ex }: { ex: Extract<Exercise, { type: 'intro' }> }) {
  const { item } = ex;
  const extra = item.kind === 'word' ? item.word.alternatives : [];
  const source = item.kind === 'word' ? item.word.source : item.letter.source;
  return (
    <Card style={{ alignItems: 'flex-start', gap: space.md }}>
      <T v="caption" muted>
        {item.kind === 'letter' ? 'Новая буква' : 'Новое слово'}
      </T>
      <Row gap={space.lg}>
        <T v="buryatLarge" selectable>
          {item.buryat}
        </T>
        <AudioButton id={item.id} autoPlay />
      </Row>
      <T v="heading">{item.kind === 'letter' ? `называется «${item.russian}»` : item.russian}</T>
      {extra.length > 0 && <T muted>также: {extra.join(', ')}</T>}
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
  const question =
    ex.item.kind === 'letter'
      ? ex.direction === 'bur-ru'
        ? 'Как называется буква?'
        : 'Какая это буква?'
      : ex.direction === 'bur-ru'
        ? 'Что значит слово?'
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
      <Row>
        <T v={buryatOptions ? 'heading' : 'buryatLarge'}>{ex.prompt}</T>
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
      if (next.length === ex.items.length) {
        const perItem = Object.fromEntries(ex.items.map((i) => [i.id, wrongItems.current.has(i.id) ? ('wrong' as const) : ('correct' as const)]));
        const result = wrongItems.current.size ? 'almost' : 'correct';
        onResult({ result, perItem }, { result });
      }
    } else {
      wrongItems.current.add(item.id);
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
    onResult(one(ex.item.id, result), { result, correctAnswer: ex.answers[0] });
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

export function MinimalPairView({ ex, answered, onResult }: ViewProps<'minimal_pair_choose'>) {
  const [picked, setPicked] = useState<string | null>(null);
  const pick = (o: string) => {
    if (answered) return;
    setPicked(o);
    // Строгое сравнение: здесь важна каждая буква и долгота.
    const result = normalizeAnswer(o) === normalizeAnswer(ex.answer) ? 'correct' : 'wrong';
    onResult(one(ex.target.id, result), { result, correctAnswer: `${ex.target.buryat} — ${ex.target.russian}; ${ex.other.buryat} — ${ex.other.russian}` });
  };
  useOptionKeys(ex.options, pick, answered);
  return (
    <View style={{ gap: space.lg }}>
      <T muted>Выберите слово со значением</T>
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
    onResult({ result, perItem }, { result, correctAnswer: ex.items.map((x) => `${x.item.buryat} — ${ROW_LABEL[x.row].toLowerCase()}`).join('; ') });
  };
  return (
    <View style={{ gap: space.md }}>
      <T muted>К какому ряду относятся гласные слова?</T>
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
  const submit = () => {
    const built = chosen.map((i) => ex.tokens[i]).join(' ');
    const result = normalizeAnswer(built) === normalizeAnswer(ex.answer.join(' ')) ? 'correct' : 'wrong';
    onResult(one(ex.sentence.id, result), { result, correctAnswer: ex.sentence.buryat });
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
          chosen.includes(i) ? null : <OptionButton key={`t${i}`} label={t} buryat disabled={answered} onPress={() => setChosen([...chosen, i])} />,
        )}
      </View>
      {!answered && <Button title="Проверить" onPress={submit} disabled={chosen.length !== ex.tokens.length} />}
    </View>
  );
}

const styles = StyleSheet.create({
  input: { borderWidth: 1.5, borderRadius: radius.md, paddingHorizontal: space.lg, paddingVertical: 14, fontSize: 22, fontFamily: fonts.semibold },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.md, padding: space.md },
  chip: { paddingHorizontal: space.sm, paddingVertical: 8, borderRadius: radius.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, minHeight: 54 },
});
