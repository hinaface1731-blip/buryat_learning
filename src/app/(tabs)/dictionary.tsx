import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AudioButton } from '@/audio/AudioButton';
import { getCourse } from '@/content/course';
import type { Word } from '@/content/schema';
import { normalizeAnswer } from '@/engine/check';
import { degrade } from '@/lib/buryat';
import { BuryatKeysBar, insertAt } from '@/ui/BuryatKeysBar';
import { Row, T, UnverifiedBadge, useShowUnverified } from '@/ui/components';
import { words as wordsLabel } from '@/ui/labels';
import { fonts, radius, space, useTheme } from '@/ui/theme';

// Поиск по бурятскому написанию (в том числе без особых букв: «хургуули» найдёт «һургуули»),
// по переводу и альтернативам.

type Entry = { word: Word; keys: string[] };

function source(w: Word): string {
  if (w.source.book === 'native-speaker') return 'от носителя';
  if (w.source.book === 'zugaa') return 'разговорник Burlang';
  if (w.source.book === 'translator') return 'машинный перевод';
  return ['учебник', w.source.page ? `стр. ${w.source.page}` : null, w.source.lesson ? `урок ${w.source.lesson}` : w.source.section].filter(Boolean).join(', ');
}

export default function DictionaryScreen() {
  const { c } = useTheme();
  const showUnverified = useShowUnverified();
  const [query, setQuery] = useState('');
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const entries = useMemo<Entry[]>(() => {
    const { content } = getCourse();
    return content.words
      .filter((w) => !w.excluded)
      .map((word) => {
        const b = normalizeAnswer(word.buryat);
        return { word, keys: [b, degrade(b), ...[word.russian, ...word.alternatives].map(normalizeAnswer)] };
      })
      .sort((a, b) => a.word.buryat.localeCompare(b.word.buryat, 'ru'));
  }, []);

  const q = normalizeAnswer(query);
  const results = useMemo(() => {
    if (!q) return entries;
    const dq = degrade(q);
    // Точное совпадение → начало слова → вхождение; без особых букв — после точных.
    const rank = (e: Entry) =>
      Math.min(...e.keys.map((k) => (k === q ? 0 : k === dq ? 1 : k.startsWith(q) ? 2 : k.startsWith(dq) ? 3 : k.includes(q) ? 4 : k.includes(dq) ? 5 : 9)));
    return entries
      .map((e) => ({ e, r: rank(e) }))
      .filter((x) => x.r < 9)
      .sort((a, b) => a.r - b.r)
      .map((x) => x.e);
  }, [entries, q]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={['top']}>
      <View style={styles.head}>
        <T v="title">Словарь</T>
        <TextInput
          value={query}
          onChangeText={setQuery}
          selection={selection}
          onSelectionChange={(e) => setSelection(e.nativeEvent.selection)}
          inputAccessoryViewID="dict-search"
          placeholder="Поиск по-бурятски или по-русски"
          placeholderTextColor={c.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
          accessibilityLabel="Поиск по словарю"
          style={[styles.input, { color: c.text, backgroundColor: c.surface, borderColor: c.border }]}
        />
        <BuryatKeysBar
          nativeID="dict-search"
          onKey={(ch) => {
            const r = insertAt(query, selection, ch);
            setQuery(r.value);
            setSelection({ start: r.cursor, end: r.cursor });
          }}
        />
        <T v="caption" muted>
          {wordsLabel(results.length)}
        </T>
      </View>
      <FlatList
        data={results}
        keyExtractor={(e) => e.word.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: space.xxl }}
        ItemSeparatorComponent={() => <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.border }} />}
        renderItem={({ item: { word } }) => (
          <View style={styles.row}>
            <View style={{ flex: 1, gap: 2 }}>
              <T v="buryat" selectable>
                {word.buryat}
              </T>
              <T>{[word.russian, ...word.alternatives].join(', ')}</T>
              <T v="caption" muted>
                {source(word)}
              </T>
              <Row gap={space.xs} style={{ flexWrap: 'wrap' }}>
                <UnverifiedBadge verified={word.verified} />
                {showUnverified && word.possible_typo && !word.verified && <UnverifiedBadge verified={false} label="возможна опечатка в книге" />}
              </Row>
            </View>
            <AudioButton id={word.id} />
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  head: { paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.sm, gap: space.sm },
  input: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: 12, fontSize: 17, fontFamily: fonts.regular },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
});
