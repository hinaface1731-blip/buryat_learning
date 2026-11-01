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

/** Реакции героев: возврат к занятию, удачная реплика, ошибка в разговоре. */
export const POSES = {
  'seseg-explain': require('../../assets/art/seseg-explain.webp') as number,
  'seseg-think': require('../../assets/art/seseg-think.webp') as number,
  'bair-think': require('../../assets/art/bair-think.webp') as number,
  'bair-wave': require('../../assets/art/bair-wave.webp') as number,
};

export type PoseId = keyof typeof POSES;

export function CharacterPose({ pose, height = 150 }: { pose: PoseId; height?: number }) {
  return <Image source={POSES[pose]} style={{ width: height * 0.62, height }} contentFit="contain" loading="eager" accessible={false} />;
}

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
