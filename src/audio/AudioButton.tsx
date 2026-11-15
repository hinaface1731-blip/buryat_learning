import { useAudioPlayer } from 'expo-audio';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { fonts, radius, useTheme } from '@/ui/theme';

import { audioIndex } from './audioIndex';

// Медленно — как «черепаха» в Duolingo: та же запись, темп ниже. 'high' сохраняет высоту голоса (в вебе без него голос «плывёт» вниз).
const SLOW_RATE = 0.65;

/** Кнопка прослушивания. Если записи нет — ничего не рисует (TTS не используется). */
export function AudioButton({ id, size = 'md', autoPlay = false, slow = false }: { id: string; size?: 'md' | 'lg'; autoPlay?: boolean; slow?: boolean }) {
  const source = audioIndex[id];
  if (source === undefined) return null;
  return <AudioButtonInner source={source} size={size} autoPlay={autoPlay} slow={slow} />;
}

function AudioButtonInner({ source, size, autoPlay, slow }: { source: number; size: 'md' | 'lg'; autoPlay: boolean; slow: boolean }) {
  const { c } = useTheme();
  const player = useAudioPlayer(source);
  const play = (rate = 1) => {
    player.setPlaybackRate(rate, 'high');
    player.seekTo(0);
    player.play();
  };
  useEffect(() => {
    if (autoPlay) {
      player.seekTo(0);
      player.play();
    }
  }, [autoPlay, player]);
  const dim = size === 'lg' ? 72 : 44;
  const main = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Прослушать"
      onPress={() => play()}
      style={({ pressed }) => [styles.btn, { width: dim, height: dim, backgroundColor: c.primary, opacity: pressed ? 0.8 : 1 }]}>
      <Text style={{ color: c.onPrimary, fontFamily: fonts.bold, fontSize: size === 'lg' ? 28 : 18 }}>▶</Text>
    </Pressable>
  );
  if (!slow) return main;
  return (
    <View style={styles.row}>
      {main}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Прослушать медленно"
        onPress={() => play(SLOW_RATE)}
        style={({ pressed }) => [styles.btn, styles.slow, { height: dim * 0.66, borderColor: c.primary, opacity: pressed ? 0.7 : 1 }]}>
        <Text style={{ color: c.primary, fontFamily: fonts.semibold, fontSize: 14 }}>Медленно</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  btn: { borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  slow: { borderWidth: 1.5, paddingHorizontal: 14 },
});
