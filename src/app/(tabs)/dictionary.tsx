import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AudioButton } from '@/audio/AudioButton';
import { getCourse } from '@/content/course';
import { useAppStore } from '@/store/app-store';
import type { Word } from '@/content/schema';
import { normalizeAnswer } from '@/engine/check';
import { degrade } from '@/lib/buryat';
import { BuryatKeysBar, insertAt } from '@/ui/BuryatKeysBar';
import { Button, Row, T, UnverifiedBadge, useShowUnverified } from '@/ui/components';
import { words as wordsLabel } from '@/ui/labels';
import { fonts, radius, space, useTheme } from '@/ui/theme';

// Поиск по бурятскому написанию (в том числе без особых букв: «хургуули» найдёт «һургуули»),
// по переводу и альтернативам.

type Entry = { word: Word; keys: string[] };

/** Слово выучено, когда его дважды подряд вспомнили в повторении. */
const LEARNED_REPS = 2;

type Collection = { id: string; title: string; ids: Set<string> };

function source(w: Word): string {
  if (w.source.book === 'native-speaker') return 'от носителя';
  if (w.source.book === 'zugaa') return 'разговорник Burlang';
  if (w.source.book === 'translator') return 'машинный перевод';
  if (w.source.book === 'temslov') return 'тематический словарь';
  if (w.source.book === 'burfm-audio') return 'аудиоурок «Буряад FM»';
  if (w.source.book === 'kids-audio') return 'детский аудиокурс';
  return ['учебник', w.source.page ? `стр. ${w.source.page}` : null, w.source.lesson ? `урок ${w.source.lesson}` : w.source.section].filter(Boolean).join(', ');
}

export default function DictionaryScreen() {
  const { c } = useTheme();
  const router = useRouter();
  const [learnedOnly, setLearnedOnly] = useState(false);
  const showUnverified = useShowUnverified();
  const [query, setQuery] = useState('');
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const [collection, setCollection] = useState<string | null>(null);
  const cards = useAppStore((s) => s.progress.cards);
  // Коллекции — главы курса со словами (кроме алфавита) и отдельно всё, у чего есть запись.
  const collections = useMemo<Collection[]>(() => {
    const { content, hasAudio } = getCourse();
    const units = content.course.units
      .filter((u) => !u.locked && u.lessons.some((l) => l.wordIds.length > 0))
      .map((u) => ({ id: u.id, title: u.title, ids: new Set(u.lessons.flatMap((l) => l.wordIds)) }));
    return [{ id: 'audio', title: 'С записью', ids: new Set(content.words.filter((w) => !w.excluded && hasAudio(w.id)).map((w) => w.id)) }, ...units];
  }, []);
  const learned = (ids: Set<string>) => [...ids].filter((id) => (cards[id]?.reps ?? 0) >= LEARNED_REPS).length;
  const active = collections.find((x) => x.id === collection);
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
    const inCollection = active ? entries.filter((e) => active.ids.has(e.word.id)) : entries;
    const pool = learnedOnly ? inCollection.filter((e) => (cards[e.word.id]?.reps ?? 0) >= LEARNED_REPS) : inCollection;
    if (!q) return pool;
    const dq = degrade(q);
    // Точное совпадение → начало слова → вхождение; без особых букв — после точных.
    const rank = (e: Entry) =>
      Math.min(...e.keys.map((k) => (k === q ? 0 : k === dq ? 1 : k.startsWith(q) ? 2 : k.startsWith(dq) ? 3 : k.includes(q) ? 4 : k.includes(dq) ? 5 : 9)));
    return pool
      .map((e) => ({ e, r: rank(e) }))
      .filter((x) => x.r < 9)
      .sort((a, b) => a.r - b.r)
      .map((x) => x.e);
  }, [entries, q, active, learnedOnly, cards]);
  const trainable = results.filter((e) => getCourse().pools.itemById.has(e.word.id)).length;

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
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
          {collections.map((col) => {
            const on = col.id === collection;
            return (
              <Pressable
                key={col.id}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`${col.title}: выучено ${learned(col.ids)} из ${col.ids.size}`}
                onPress={() => setCollection(on ? null : col.id)}
                style={[styles.chip, { borderColor: on ? c.primary : c.border, backgroundColor: on ? c.primary : c.surface }]}>
                <T v="label" color={on ? c.onPrimary : c.text} numberOfLines={1}>
                  {col.title}
                </T>
                <T v="caption" color={on ? c.onPrimary : c.textMuted}>
                  {learned(col.ids)}/{col.ids.size}
                </T>
              </Pressable>
            );
          })}
        </ScrollView>
        <Row style={{ flexWrap: 'wrap' }}>
          <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: learnedOnly }} onPress={() => setLearnedOnly(!learnedOnly)} style={[styles.chip, { borderColor: learnedOnly ? c.primary : c.border, backgroundColor: c.surface, minHeight: 44, justifyContent: 'center' }]}>
            <T v="label">{learnedOnly ? '✓ ' : ''}Только освоенные</T>
          </Pressable>
          {(active || q || learnedOnly) && <Button kind="ghost" title="Сбросить" onPress={() => { setQuery(''); setSelection({ start: 0, end: 0 }); setCollection(null); setLearnedOnly(false); }} />}
        </Row>
        <Button title={'Тренировать: ' + wordsLabel(trainable)} disabled={trainable === 0} onPress={() => router.push({ pathname: '/practice/[section]', params: { section: 'words', collection: collection ?? '', q: query, learned: learnedOnly ? '1' : '0' } })} />
        <T v="caption" muted>
          {active ? `${active.title}: выучено ${learned(active.ids)} из ${active.ids.size} · ` : ''}
          {wordsLabel(results.length)}
        </T>
      </View>
      <FlatList
        data={results}
        ListEmptyComponent={<View style={{ paddingVertical: space.xl, gap: space.sm }}><T v="heading">Слова не найдены</T><T muted>{learnedOnly ? 'Освоенные слова появятся после двух верных повторений. Попробуйте убрать фильтр.' : 'Измените поиск или выберите другую подборку.'}</T></View>}
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
  chip: { borderWidth: 1, borderRadius: radius.lg, paddingHorizontal: space.md, paddingVertical: space.xs, alignItems: 'center', maxWidth: 200 },
});
