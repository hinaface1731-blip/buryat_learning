import { Image } from 'expo-image';

// Нерпа-талисман. Настроение выбирается по ситуации:
// explain — знакомство и инструкции, happy — верный ответ и конец урока,
// think — подсказка и сложный вопрос, support — ошибка, попробовать снова.

export type MascotMood = 'explain' | 'happy' | 'think' | 'support';

const SOURCES: Record<MascotMood, number> = {
  explain: require('../../assets/mascot/explain.webp'),
  happy: require('../../assets/mascot/happy.webp'),
  think: require('../../assets/mascot/think.webp'),
  support: require('../../assets/mascot/support.webp'),
};

/** Украшение: текст рядом уже передаёт смысл, поэтому скрыто от VoiceOver. */
export function Mascot({ mood, size = 96 }: { mood: MascotMood; size?: number }) {
  return <Image source={SOURCES[mood]} style={{ width: size, height: size }} contentFit="contain" loading="eager" accessible={false} />;
}
