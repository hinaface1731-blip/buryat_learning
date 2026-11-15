import lessonsJson from '../../content/audio-lessons.json';

// Аудиоуроки целиком: лента собрана распознаванием речи (scripts/audio/build-lessons.py).
// ru — русская речь текстом, bur — бурятская речь (без текста: распознавание её не пишет),
// music — песня или музыкальная пауза, word — слово курса, вырезанное из этого места.

export type AudioSegment = { t: number; k: 'ru' | 'bur' | 'music' | 'word'; x?: string; id?: string };
export type AudioLesson = { id: string; n: number; course: 'burfm' | 'kids'; title: string; segments: AudioSegment[] };

export const AUDIO_LESSONS = lessonsJson as AudioLesson[];

export const COURSE_TITLE: Record<AudioLesson['course'], string> = { burfm: 'Радио «Буряад FM»', kids: 'Детский курс' };

export function findAudioLesson(id: string): AudioLesson | undefined {
  return AUDIO_LESSONS.find((l) => l.id === id);
}

/** Индекс текущего отрезка ленты: последний, начавшийся не позже момента воспроизведения. */
export function segmentAt(segments: AudioSegment[], time: number): number {
  let lo = 0;
  let hi = segments.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (segments[mid].t <= time) {
      ans = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return ans;
}

export const formatTime = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
