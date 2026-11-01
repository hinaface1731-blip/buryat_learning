import { Image } from 'expo-image';
import { View } from 'react-native';

import { useTheme } from './theme';

// Герои разговорных сцен: Сэсэг — собеседница, Баир — ученик.

export type CharacterId = 'seseg' | 'bair';

const FACES: Record<CharacterId, number> = {
  seseg: require('../../assets/characters/seseg-face.webp'),
  bair: require('../../assets/characters/bair-face.webp'),
};

const FIGURES: Record<CharacterId, number> = {
  seseg: require('../../assets/characters/seseg.webp'),
  bair: require('../../assets/characters/bair.webp'),
};

/** Лицо в кружке рядом с репликой. */
export function CharacterFace({ id, size = 40 }: { id: CharacterId; size?: number }) {
  const { c } = useTheme();
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', backgroundColor: c.surfaceAlt }}>
      <Image source={FACES[id]} style={{ width: size, height: size }} contentFit="cover" loading="eager" accessible={false} />
    </View>
  );
}

/** Герой в полный рост: начало сцены. */
export function CharacterFigure({ id, height = 150 }: { id: CharacterId; height?: number }) {
  return <Image source={FIGURES[id]} style={{ width: height * 0.62, height }} contentFit="contain" loading="eager" accessible={false} />;
}
