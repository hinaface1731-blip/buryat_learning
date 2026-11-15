import type { Word } from '../../../src/content/schema';
import { importAudioWords } from '../audio-words';

const word = (id: string, buryat: string, russian: string): Word => ({
  id,
  kind: 'word',
  buryat,
  russian,
  alternatives: [],
  source: { book: 'bxr-textbook' },
  tags: [],
  verified: false,
  needs_review: false,
  review_reasons: [],
  possible_typo: false,
  typo_candidates: [],
  form: null,
  excluded: false,
  comment: '',
  origin: { buryat, russian },
});

const row = (lesson: string, buryat: string, russian: string, file = 'urok-15-mixdown.mp3', status = '') => ({ lesson, buryat, russian, file, start: '1.5', end: '2.1', status, comment: '' });

describe('importAudioWords', () => {
  it('то же слово с тем же значением получает только запись и тег темы', () => {
    const { words, clips, added, reused } = importAudioWords([row('14', 'һара', 'месяц')], [word('hara', 'һара', 'месяц')]);
    expect(added).toBe(0);
    expect(reused).toBe(1);
    expect(words).toHaveLength(1);
    expect(words[0].tags).toContain('audio:14');
    expect(clips[0].id).toBe('hara');
  });

  it('другое значение — новое слово со своим id и источником', () => {
    const { words } = importAudioWords([row('15', 'һара', 'луна'), row('3', 'нэгэн', 'один', 'urok-3.mp3')], [word('hara', 'һара', 'месяц')]);
    const moon = words.find((w) => w.russian === 'луна')!;
    expect(moon.id).toBe('hara-2');
    expect(moon.source.book).toBe('burfm-audio');
    expect(words.find((w) => w.russian === 'один')!.source.book).toBe('kids-audio');
  });

  it('skip пропускается, неверная тема — ошибка', () => {
    const r = importAudioWords([row('15', 'нуур', 'озеро', undefined, 'skip'), row('99', 'нуур', 'озеро')], []);
    expect(r.clips).toHaveLength(0);
    expect(r.errors).toHaveLength(1);
  });
});
