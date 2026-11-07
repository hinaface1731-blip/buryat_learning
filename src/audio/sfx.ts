import { createAudioPlayer, type AudioPlayer } from 'expo-audio';

import { useAppStore } from '@/store/app-store';

// Звуки интерфейса из UI SFX (https://github.com/romainsimon/uisfx), набор arcade, аудио CC0.
// Плееры создаются при первом звуке и живут всё время работы приложения: их всего семь.

const SOURCES = {
  correct: require('../../assets/sfx/success.mp3'),
  almost: require('../../assets/sfx/warning.mp3'),
  wrong: require('../../assets/sfx/error.mp3'),
  tap: require('../../assets/sfx/select.mp3'),
  match: require('../../assets/sfx/snap.mp3'),
  lessonDone: require('../../assets/sfx/complete.mp3'),
  reward: require('../../assets/sfx/achievement.mp3'),
} as const;

export type Sfx = keyof typeof SOURCES;

// Нажатия тише исходов: они звучат часто.
const VOLUME: Record<Sfx, number> = { correct: 0.8, almost: 0.6, wrong: 0.6, tap: 0.35, match: 0.5, lessonDone: 0.9, reward: 0.9 };

const players: Partial<Record<Sfx, AudioPlayer>> = {};

export function playSfx(name: Sfx): void {
  if (!useAppStore.getState().settings.sound) return;
  try {
    let player = players[name];
    if (!player) {
      player = createAudioPlayer(SOURCES[name]);
      player.volume = VOLUME[name];
      players[name] = player;
    }
    void player.seekTo(0).catch(() => {});
    player.play();
  } catch {
    // Звук — только подкрепление: если не воспроизвёлся, урок идёт дальше.
  }
}
