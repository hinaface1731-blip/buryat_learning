import { Image } from 'expo-image';

// Нерпа-талисман. Настроение выбирается по ситуации:
// explain — инструкции, wave — приветствие, read — новое правило, happy — верный ответ,
// star — урок освоен, think — подсказка и сложный вопрос, support — ошибка, попробовать снова.

export type MascotMood = 'explain' | 'wave' | 'read' | 'happy' | 'star' | 'think' | 'support';

const SOURCES: Record<MascotMood, number> = {
  explain: require('../../assets/mascot/explain.webp'),
  wave: require('../../assets/art/mascot-scarf.webp'),
  read: require('../../assets/art/mascot-book.webp'),
  happy: require('../../assets/mascot/happy.webp'),
  star: require('../../assets/art/mascot-star.webp'),
  think: require('../../assets/mascot/think.webp'),
  support: require('../../assets/mascot/support.webp'),
};

/** Украшение: текст рядом уже передаёт смысл, поэтому скрыто от VoiceOver. */
export function Mascot({ mood, size = 96 }: { mood: MascotMood; size?: number }) {
  return <Image source={SOURCES[mood]} style={{ width: size, height: size }} contentFit="contain" loading="eager" accessible={false} />;
}
