import Ionicons from '@expo/vector-icons/Ionicons';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { lessonIndex } from '@/audio/lessonIndex';
import { AUDIO_LESSONS, COURSE_TITLE, findAudioLesson, formatTime, segmentAt, type AudioLesson } from '@/content/audio-lessons';
import { getCourse } from '@/content/course';
import { useAppStore } from '@/store/app-store';
import { LISTEN_XP } from '@/store/logic';
import { ProgressBar, Row, Screen, T } from '@/ui/components';
import { fonts, radius, space, useTheme } from '@/ui/theme';

/** Веб (output: static): страница на каждый аудиоурок. */
export async function generateStaticParams(): Promise<{ id: string }[]> {
  return AUDIO_LESSONS.map((l) => ({ id: l.id }));
}

export default function ListenScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const lesson = findAudioLesson(id);
  const source = lesson ? lessonIndex[lesson.id] : undefined;
  if (!lesson || source === undefined) {
    return (
      <Screen>
        <T>Аудиоурок не найден.</T>
      </Screen>
    );
  }
  return <Player key={lesson.id} lesson={lesson} source={source} />;
}

function Player({ lesson, source }: { lesson: AudioLesson; source: number }) {
  const { c } = useTheme();
  const router = useRouter();
  const player = useAudioPlayer(source, { updateInterval: 250 });
  const status = useAudioPlayerStatus(player);
  const [slow, setSlow] = useState(false);
  const listened = useAppStore((s) => !!s.progress.listened[lesson.id]);
  const finishListening = useAppStore((s) => s.finishListening);
  const { content } = getCourse();
  const current = segmentAt(lesson.segments, status.currentTime + 0.2);
  const progress = status.duration > 0 ? status.currentTime / status.duration : 0;

  // Прослушан — когда дослушали почти до конца: в последних секундах обычно музыка.
  useEffect(() => {
    if (!listened && progress >= 0.9) finishListening(lesson.id);
  }, [listened, progress, finishListening, lesson.id]);

  const seek = (t: number) => void player.seekTo(Math.max(0, status.duration > 0 ? Math.min(t, status.duration) : t));
  const toggle = () => (status.playing ? player.pause() : player.play());
  const switchRate = () => {
    player.setPlaybackRate(slow ? 1 : 0.75, 'high');
    setSlow(!slow);
  };
  const close = () => (router.canGoBack() ? router.back() : router.replace('/practice'));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={['top', 'bottom']}>
      <View style={[styles.header, { borderColor: c.border }]}>
        <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1, gap: 2 }}>
            <T v="caption" muted>
              {COURSE_TITLE[lesson.course]} · урок {lesson.n}
            </T>
            <T v="title">{lesson.title}</T>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Закрыть" onPress={close} hitSlop={12}>
            <Ionicons name="close" size={26} color={c.textMuted} />
          </Pressable>
        </Row>
        <View style={{ gap: space.xs }}>
          <ProgressBar value={progress} />
          <Row style={{ justifyContent: 'space-between' }}>
            <T v="caption" muted>
              {formatTime(status.currentTime)}
            </T>
            <T v="caption" muted>
              {listened ? '✓ прослушан' : `+${LISTEN_XP} XP, если дослушать`}
            </T>
            <T v="caption" muted>
              {formatTime(status.duration)}
            </T>
          </Row>
        </View>
        <Row style={{ justifyContent: 'center', alignItems: 'center' }} gap={space.lg}>
          <RoundButton icon="play-back" label="Назад на 10 секунд" onPress={() => seek(status.currentTime - 10)} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={status.playing ? 'Пауза' : 'Слушать'}
            onPress={toggle}
            style={({ pressed }) => [styles.play, { backgroundColor: c.primary, opacity: pressed ? 0.85 : 1 }]}>
            <Ionicons name={status.playing ? 'pause' : 'play'} size={34} color={c.onPrimary} />
          </Pressable>
          <RoundButton icon="play-forward" label="Вперёд на 10 секунд" onPress={() => seek(status.currentTime + 10)} />
          <Pressable accessibilityRole="button" accessibilityLabel={slow ? 'Обычная скорость' : 'Медленнее'} onPress={switchRate} style={[styles.rate, { borderColor: c.border }]}>
            <T v="label">{slow ? '0,75×' : '1×'}</T>
          </Pressable>
        </Row>
      </View>
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: 2 }}>
        <T v="caption" muted style={{ marginBottom: space.sm }}>
          Нажмите на строку, чтобы перейти к этому месту. Русская речь записана распознаванием и может быть неточной; бурятская речь отмечена без текста, слова курса — с переводом.
        </T>
        {lesson.segments.map((s, i) => {
          const word = s.k === 'word' && s.id ? content.wordById.get(s.id) : undefined;
          if (s.k === 'word' && !word) return null;
          return (
            <Pressable
              key={`${s.t}-${i}`}
              accessibilityRole="button"
              onPress={() => {
                seek(s.t);
                if (!status.playing) player.play();
              }}
              style={[styles.seg, i === current && { backgroundColor: c.surfaceAlt }, word && { borderColor: c.accent, borderWidth: 1 }]}>
              <T v="caption" muted style={styles.time}>
                {formatTime(s.t)}
              </T>
              {s.k === 'ru' && <T style={{ flex: 1 }}>{s.x}</T>}
              {s.k === 'bur' && (
                <T color={c.primary} style={{ flex: 1, fontFamily: fonts.medium }}>
                  ● бурятская речь
                </T>
              )}
              {s.k === 'music' && (
                <T muted style={{ flex: 1 }}>
                  ♪ песня или музыка
                </T>
              )}
              {word && (
                <T style={{ flex: 1 }}>
                  <T style={{ fontFamily: fonts.bold }}>{word.buryat}</T> — {word.russian}
                </T>
              )}
            </Pressable>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

function RoundButton({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={8} style={({ pressed }) => [styles.round, { backgroundColor: c.surfaceAlt, opacity: pressed ? 0.7 : 1 }]}>
      <Ionicons name={icon} size={22} color={c.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { padding: space.lg, gap: space.md, borderBottomWidth: StyleSheet.hairlineWidth },
  play: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  round: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  rate: { minWidth: 56, height: 36, borderRadius: radius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.sm },
  seg: { flexDirection: 'row', gap: space.md, paddingVertical: 6, paddingHorizontal: space.sm, borderRadius: radius.md, alignItems: 'flex-start' },
  time: { width: 40, paddingTop: 2, fontVariant: ['tabular-nums'] },
});
