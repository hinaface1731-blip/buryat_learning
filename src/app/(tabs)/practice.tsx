import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter, type Href } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { AUDIO_LESSONS, COURSE_TITLE, type AudioLesson } from '@/content/audio-lessons';
import { getConversations } from '@/content/conversations';
import { SERVER_ENABLED } from '@/lib/supabase';
import { getCourse, reviewableDueIds } from '@/content/course';
import { weakIds } from '@/engine/practice';
import { dateKey } from '@/lib/dates';
import { useAppStore } from '@/store/app-store';
import { Card, Row, Screen, T } from '@/ui/components';
import { words } from '@/ui/labels';
import { fonts, radius, space, useTheme } from '@/ui/theme';

type IoniconName = keyof typeof Ionicons.glyphMap;

type Section = { title: string; hint: string; icon: IoniconName; href: Href; badge?: string; disabled?: boolean };

export default function PracticeTab() {
  const { c } = useTheme();
  const router = useRouter();
  const cards = useAppStore((s) => s.progress.cards);
  const listened = useAppStore((s) => s.progress.listened);
  const { content, pools, hasAudio } = getCourse();
  const today = dateKey();
  const due = reviewableDueIds(cards, today, 1000).length;
  const total = Object.keys(cards).length;
  const audioWords = [...pools.itemById.values()].filter((it) => hasAudio(it.id)).length;
  const weak = weakIds(cards).length;
  const upcoming = Object.values(cards)
    .filter((card) => card.due > today)
    .sort((a, b) => (a.due < b.due ? -1 : 1))[0];

  const sections: Section[] = [
    { title: 'Слова', hint: 'Короткая тренировка без ожидания повторения. Выбрать тему можно в словаре.', icon: 'albums-outline', href: '/practice/words' },
    {
      title: 'Слова',
      hint: due > 0 ? `К повторению: ${words(due)}` : total === 0 ? 'Пройдите первый урок' : upcoming ? `Всё повторено, следующее — ${upcoming.due}` : 'Всё повторено',
      icon: 'repeat-outline',
      href: '/review-session',
      badge: due > 0 ? String(due) : undefined,
      disabled: due === 0,
    },
    { title: 'Аудирование', hint: `Слушать и узнавать: ${words(audioWords)} с записью`, icon: 'headset-outline', href: '/practice/listening', disabled: audioWords < 4 },
    { title: 'Произношение', hint: 'Послушать, записать себя, сравнить', icon: 'mic-outline', href: '/practice/speaking', disabled: audioWords === 0 },
    { title: 'Грамматика', hint: 'Правило, минимальные пары, ряды гласных', icon: 'school-outline', href: '/practice/grammar' },
    { title: 'Ошибки', hint: weak > 0 ? `Слабые места: ${words(weak)}` : 'Ошибок пока нет', icon: 'bandage-outline', href: '/practice/mistakes', badge: weak > 0 ? String(weak) : undefined, disabled: weak === 0 },
  ];

  return (
    <Screen scroll>
      <T v="title">Практикум</T>
      <T muted>Тренировки по направлениям. Урок они не засчитывают, но ответы идут в повторение и приносят XP.</T>
      <View style={styles.grid}>
        {sections.map((s) => (
          <Pressable
            key={s.title}
            accessibilityRole="button"
            accessibilityLabel={`${s.title}. ${s.hint}`}
            accessibilityState={{ disabled: !!s.disabled }}
            disabled={s.disabled}
            onPress={() => router.push(s.href)}
            style={({ pressed }) => [styles.tile, { backgroundColor: c.surface, borderColor: c.border, opacity: s.disabled ? 0.5 : pressed ? 0.8 : 1 }]}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Ionicons name={s.icon} size={28} color={c.primary} />
              {s.badge && (
                <View style={[styles.badge, { backgroundColor: c.accent }]}>
                  <T v="caption" color={c.onPrimary} style={{ fontFamily: fonts.bold }}>
                    {s.badge}
                  </T>
                </View>
              )}
            </Row>
            <T v="heading">{s.title}</T>
            <T v="caption" muted numberOfLines={2}>
              {s.hint}
            </T>
          </Pressable>
        ))}
      </View>

      <T v="heading" style={{ marginTop: space.md }}>
        Разговоры
      </T>
      <T v="caption" muted>
        Сэсэг говорит — вы отвечаете. Ошибку объяснит нерпа, в конце — оценка.
      </T>
      {SERVER_ENABLED && (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/chat')}
          style={({ pressed }) => [styles.talk, { backgroundColor: c.surface, borderColor: c.accent, opacity: pressed ? 0.8 : 1 }]}>
          <Ionicons name="sparkles-outline" size={22} color={c.accent} />
          <T v="label">Свободный разговор с ИИ</T>
          <T v="caption" muted>
            Пишите по-бурятски — Сэсэг ответит и поправит ошибки. Нужен вход в аккаунт.
          </T>
        </Pressable>
      )}
      <View style={styles.grid}>
        {getConversations().map((conv) => (
          <Pressable
            key={conv.id}
            accessibilityRole="button"
            accessibilityLabel={`${conv.title}. ${conv.scene}`}
            onPress={() => router.push({ pathname: '/practice/[section]', params: { section: 'talk', d: conv.id } })}
            style={({ pressed }) => [styles.talk, { backgroundColor: c.surface, borderColor: c.border, opacity: pressed ? 0.8 : 1 }]}>
            <Ionicons name="chatbubble-ellipses-outline" size={22} color={c.accent} />
            <T v="label">{conv.title}</T>
            <T v="caption" muted numberOfLines={2}>
              {conv.scene}
            </T>
          </Pressable>
        ))}
      </View>

      <T v="heading" style={{ marginTop: space.md }}>
        Аудиоуроки
      </T>
      <T v="caption" muted>
        Уроки целиком: слушайте, повторяйте вслух, перематывайте к нужной фразе. Прослушано: {Object.keys(listened).length} из {AUDIO_LESSONS.length}.
      </T>
      {(['burfm', 'kids'] as AudioLesson['course'][]).map((course) => (
        <Card key={course} style={{ gap: 0, paddingVertical: space.xs }}>
          <T v="label" muted style={{ paddingTop: space.sm }}>
            {COURSE_TITLE[course]}
          </T>
          {AUDIO_LESSONS.filter((l) => l.course === course).map((l) => (
            <Pressable
              key={l.id}
              accessibilityRole="button"
              accessibilityLabel={`${l.title}${listened[l.id] ? ', прослушан' : ''}`}
              onPress={() => router.push({ pathname: '/listen/[id]', params: { id: l.id } })}
              style={({ pressed }) => [styles.row, { borderTopWidth: StyleSheet.hairlineWidth, borderColor: c.border, opacity: pressed ? 0.7 : 1 }]}>
              <Ionicons name={listened[l.id] ? 'checkmark-circle' : 'play-circle-outline'} size={22} color={listened[l.id] ? c.success : c.primary} />
              <T style={{ flex: 1 }}>
                {l.n}. {l.title}
              </T>
              <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
            </Pressable>
          ))}
        </Card>
      ))}

      <T v="heading" style={{ marginTop: space.md }}>
        Сцены из уроков
      </T>
      <T v="caption" muted>
        Короткие сцены с Сэсэг и Баиром: выберите свою реплику.
      </T>
      <Card style={{ gap: 0, paddingVertical: space.xs }}>
        {content.dialogues.map((d, i) => (
          <Pressable
            key={d.id}
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/practice/[section]', params: { section: 'dialogues', d: d.id } })}
            style={({ pressed }) => [styles.row, { borderTopWidth: i === 0 ? 0 : StyleSheet.hairlineWidth, borderColor: c.border, opacity: pressed ? 0.7 : 1 }]}>
            <Ionicons name="chatbubbles-outline" size={20} color={c.textMuted} />
            <View style={{ flex: 1 }}>
              <T v="label">{d.title}</T>
              {d.scene ? (
                <T v="caption" muted numberOfLines={1}>
                  {d.scene}
                </T>
              ) : null}
            </View>
            <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
          </Pressable>
        ))}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  tile: { flexBasis: '47%', flexGrow: 1, gap: space.xs, padding: space.md, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, minHeight: 128 },
  badge: { minWidth: 24, height: 24, borderRadius: 12, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  talk: { flexBasis: '47%', flexGrow: 1, gap: space.xs, padding: space.md, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth },
});
