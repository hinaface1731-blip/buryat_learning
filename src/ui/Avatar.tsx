import { Image } from 'expo-image';
import { View } from 'react-native';

import { useTheme } from './theme';

// Аватар выбирается из готовых картинок: фото никуда не загружаем и доступ к галерее не просим.

const AVATARS: Record<string, { label: string; source: number; fit: 'cover' | 'contain' }> = {
  seal: { label: 'Нерпёнок', source: require('../../assets/mascot/happy.webp'), fit: 'contain' },
  'seal-star': { label: 'Нерпёнок со звездой', source: require('../../assets/art/mascot-star.webp'), fit: 'contain' },
  seseg: { label: 'Сэсэг', source: require('../../assets/characters/seseg-face.webp'), fit: 'cover' },
  bair: { label: 'Баир', source: require('../../assets/characters/bair-face.webp'), fit: 'cover' },
  horse: { label: 'Конь', source: require('../../assets/art/horse.webp'), fit: 'contain' },
  sheep: { label: 'Овца', source: require('../../assets/art/sheep.webp'), fit: 'contain' },
  dog: { label: 'Собака', source: require('../../assets/art/dog.webp'), fit: 'contain' },
  cat: { label: 'Кот', source: require('../../assets/art/cat.webp'), fit: 'contain' },
};

export const AVATAR_IDS = Object.keys(AVATARS);
export const avatarLabel = (id: string): string => (AVATARS[id] ?? AVATARS.seal).label;

export function Avatar({ id, size = 96, selected }: { id: string; size?: number; selected?: boolean }) {
  const { c } = useTheme();
  const avatar = AVATARS[id] ?? AVATARS.seal;
  const inset = avatar.fit === 'contain' ? size * 0.1 : 0;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', backgroundColor: c.surfaceAlt, borderWidth: selected ? 3 : 0, borderColor: c.primary, alignItems: 'center', justifyContent: 'center' }}>
      <Image source={avatar.source} style={{ width: size - inset * 2, height: size - inset * 2 }} contentFit={avatar.fit} loading="eager" accessible={false} />
    </View>
  );
}
