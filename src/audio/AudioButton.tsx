import { useAudioPlayer } from 'expo-audio';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { fonts, radius, useTheme } from '@/ui/theme';

import { audioIndex } from './audioIndex';

/** Кнопка прослушивания. Если записи нет — ничего не рисует (TTS не используется). */
export function AudioButton({ id, size = 'md', autoPlay = false }: { id: string; size?: 'md' | 'lg'; autoPlay?: boolean }) {
  const source = audioIndex[id];
  if (source === undefined) return null;
  return <AudioButtonInner source={source} size={size} autoPlay={autoPlay} />;
}

function AudioButtonInner({ source, size, autoPlay }: { source: number; size: 'md' | 'lg'; autoPlay: boolean }) {
  const { c } = useTheme();
  const player = useAudioPlayer(source);
  const play = () => {
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
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Прослушать"
      onPress={play}
      style={({ pressed }) => [styles.btn, { width: dim, height: dim, backgroundColor: c.primary, opacity: pressed ? 0.8 : 1 }]}>
      <Text style={{ color: c.onPrimary, fontFamily: fonts.bold, fontSize: size === 'lg' ? 28 : 18 }}>▶</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
});
