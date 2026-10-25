import type { Letter, Sentence, Word } from '../../../src/content/schema';
import { parseCsv, toCsv } from '../csv';
import { applyReviewRows, applyThematicRows } from '../review-merge';

const word = (over: Partial<Word> = {}): Word => ({
  id: 'unyeen',
  kind: 'word',
  buryat: 'унеэн',
  russian: 'корова',
  alternatives: [],
  source: { book: 'bxr-textbook', page: 9, lesson: 1 },
  tags: ['lesson-1'],
  verified: false,
  needs_review: false,
  review_reasons: [],
  possible_typo: true,
  typo_candidates: ['үнеэн'],
  form: null,
  excluded: false,
  comment: '',
  origin: { buryat: 'унеэн', russian: 'корова' },
  ...over,
});

const sentence: Sentence = {
  id: 's-l1-e5-1',
  kind: 'sentence',
  buryat: 'Хара нохой.',
  translation: null,
  needs_translation: true,
  source: { book: 'bxr-textbook', page: 10, lesson: 1 },
  tags: [],
  verified: false,
  excluded: false,
  comment: '',
  origin: 'Хара нохой.',
};

const letters: Letter[] = [];

describe('CSV', () => {
  it('туда-обратно с кавычками, переносами и BOM', () => {
    const csv = toCsv(['id', 'comment'], [{ id: 'a', comment: 'см. "стр. 9",\nвторая строка' }]);
    expect(csv.startsWith('﻿')).toBe(true);
    expect(parseCsv(csv)).toEqual([{ id: 'a', comment: 'см. "стр. 9",\nвторая строка' }]);
  });
  it('понимает «;» (Excel в русской локали)', () => {
    expect(parseCsv('id;verified\r\nx;да\r\n')).toEqual([{ id: 'x', verified: 'да' }]);
  });
});

describe('applyReviewRows', () => {
  it('исправление носителя и подтверждение снимают флаги', () => {
    const r = applyReviewRows({ words: [word()], sentences: [sentence], letters }, [{ id: 'unyeen', buryat: 'үнеэн', verified: 'да' }]);
    expect(r.errors).toEqual([]);
    expect(r.words[0]).toMatchObject({ buryat: 'үнеэн', verified: true, possible_typo: false, id: 'unyeen' });
    expect(r.changes.map((c) => c.field)).toEqual(expect.arrayContaining(['buryat', 'verified', 'possible_typo']));
  });

  it('перевод предложения снимает needs_translation; без перевода подтвердить нельзя', () => {
    const ok = applyReviewRows({ words: [], sentences: [sentence], letters }, [{ id: 's-l1-e5-1', translation: 'Чёрная собака.' }]);
    expect(ok.sentences[0]).toMatchObject({ translation: 'Чёрная собака.', needs_translation: false });
    const bad = applyReviewRows({ words: [], sentences: [sentence], letters }, [{ id: 's-l1-e5-1', translation: '', verified: 'да' }]);
    expect(bad.errors[0]).toMatch(/без перевода/);
    expect(bad.sentences[0].verified).toBe(false);
  });

  it('отклоняет неизвестные id, пустой id, латиницу и неверные булевы', () => {
    const r = applyReviewRows({ words: [word()], sentences: [], letters }, [
      { id: 'nope' },
      { id: '' },
      { id: 'unyeen', buryat: 'hүн' },
      { id: 'unyeen', verified: 'может' },
    ]);
    expect(r.errors).toHaveLength(4);
    expect(r.words[0].buryat).toBe('унеэн');
  });
});

describe('applyThematicRows', () => {
  it('добавляет слова носителя непроверенными с тегом юнита', () => {
    const r = applyThematicRows([], [
      { unit: 'Семья', buryat: 'эжы', russian: 'мать', speaker: 'Носитель А' },
      { unit: 'Космос', buryat: 'х', russian: 'у' },
      { unit: 'semya', buryat: 'эжы', russian: 'мать' },
    ]);
    expect(r.added).toHaveLength(1);
    expect(r.added[0]).toMatchObject({ id: 'ezhy', verified: false, tags: ['unit:semya'], source: { book: 'native-speaker', section: 'Носитель А' } });
    expect(r.errors[0]).toMatch(/неизвестный юнит/);
  });
});
