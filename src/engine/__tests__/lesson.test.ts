import { buildContent, rawContent, type Content } from '@/content/load';

import { normalizeAnswer } from '../check';
import { buildLesson, buildReview } from '../lesson';
import { buildPools } from '../pool';
import { advance, currentExercise, isFinished, startSession } from '../session';
import type { Exercise } from '../types';
import { vowelRowOf } from '../vowels';

const content = buildContent(rawContent);
const pools = buildPools(content);
const noAudio = () => false;
const allLessons = content.course.units.flatMap((u) => u.lessons);

const typesOf = (list: Exercise[]) => new Set(list.map((e) => e.type));

describe('buildLesson на реальном курсе', () => {
  it('собирается для каждого урока, детерминированно по seed', () => {
    for (const l of allLessons) {
      const a = buildLesson(l.id, content, pools, { hasAudio: noAudio, seed: 1 });
      const b = buildLesson(l.id, content, pools, { hasAudio: noAudio, seed: 1 });
      expect(a.map((e) => e.key)).toEqual(b.map((e) => e.key));
      expect(a.length).toBeGreaterThan(5);
      expect(new Set(a.map((e) => e.key)).size).toBe(a.length);
    }
  });

  it('идёт по этапам: знакомство → тренировка → применение → контроль', () => {
    const order = ['intro', 'training', 'application', 'control'];
    const ex = buildLesson('u2-l1', content, pools, { hasAudio: noAudio, seed: 3 });
    const stages = ex.map((e) => order.indexOf(e.stage));
    expect(stages).toEqual([...stages].sort((x, y) => x - y));
    expect(ex[0].type).toBe('note');
  });

  it('без аудио нет listen_and_choose; с аудио — есть', () => {
    const without = allLessons.flatMap((l) => buildLesson(l.id, content, pools, { hasAudio: noAudio, seed: 2 }));
    expect(typesOf(without).has('listen_and_choose')).toBe(false);
    const withAudio = buildLesson('u2-l1', content, pools, { hasAudio: () => true, seed: 2 });
    expect(typesOf(withAudio).has('listen_and_choose')).toBe(true);
  });

  it('без перевода предложений нет build_sentence; с переводом — есть', () => {
    const all = allLessons.flatMap((l) => buildLesson(l.id, content, pools, { hasAudio: noAudio, seed: 2 }));
    expect(typesOf(all).has('build_sentence')).toBe(false);

    const lesson = allLessons.find((l) => l.sentenceIds.length > 0)!;
    const sid = lesson.sentenceIds[0];
    const translated: Content = buildContent({
      ...rawContent,
      sentences: content.sentences.map((s) => (s.id === sid ? { ...s, translation: 'тестовый перевод' } : s)),
    });
    const withTranslation = buildLesson(lesson.id, translated, buildPools(translated), { hasAudio: noAudio, seed: 2 });
    expect(withTranslation.some((e) => e.type === 'build_sentence' && e.sentence.id === sid)).toBe(true);
  });

  it('в уроках есть minimal_pair_choose и categorize, где они положены', () => {
    const u4 = content.course.units.find((u) => u.id === 'u4')!;
    const ex = u4.lessons.flatMap((l) => buildLesson(l.id, content, pools, { hasAudio: noAudio, seed: 5 }));
    expect(typesOf(ex).has('minimal_pair_choose')).toBe(true);
    expect(typesOf(ex).has('categorize')).toBe(true);
  });

  it('дистракторы не совпадают с ответом по смыслу и написанию', () => {
    for (const l of allLessons) {
      for (const e of buildLesson(l.id, content, pools, { hasAudio: noAudio, seed: 9 })) {
        if (e.type !== 'multiple_choice') continue;
        const norm = e.options.map(normalizeAnswer);
        expect(new Set(norm).size).toBe(norm.length);
        expect(e.options).toContain(e.answer);
        if (e.direction === 'bur-ru') {
          const accepted = new Set(e.item.accepted.map(normalizeAnswer));
          expect(e.options.filter((o) => accepted.has(normalizeAnswer(o)))).toHaveLength(1);
        }
      }
    }
  });

  it('слова-подозрения на опечатку и исключённые не попадают в уроки', () => {
    const inLessons = new Set(allLessons.flatMap((l) => l.wordIds));
    for (const w of content.words) {
      if (w.excluded || (w.possible_typo && !w.verified)) expect(inLessons.has(w.id)).toBe(false);
    }
  });
});

describe('buildReview', () => {
  it('одно упражнение на единицу; знакомые — на ввод', () => {
    const ids = pools.lessonItems.get('u2-l1')!.map((i) => i.id).slice(0, 4);
    const fresh = buildReview(ids, content, pools, { hasAudio: noAudio, repsById: {}, seed: 1 });
    expect(fresh).toHaveLength(4);
    expect(fresh.every((e) => e.type === 'multiple_choice')).toBe(true);
    const known = buildReview(ids, content, pools, { hasAudio: noAudio, repsById: Object.fromEntries(ids.map((id) => [id, 3])), seed: 1 });
    expect(known.every((e) => e.type === 'type_answer')).toBe(true);
  });
});

describe('session', () => {
  it('ошибка возвращает упражнение в конец один раз и попадает в ошибки', () => {
    const list = buildLesson('u2-l1', content, pools, { hasAudio: noAudio, seed: 1 }).filter((e) => e.type === 'multiple_choice').slice(0, 2);
    let s = startSession(list);
    const first = currentExercise(s)!;
    const id = first.type === 'multiple_choice' ? first.item.id : '';
    s = advance(s, { result: 'wrong', perItem: { [id]: 'wrong' } });
    expect(s.queue).toHaveLength(3);
    s = advance(s, { result: 'correct', perItem: {} });
    s = advance(s, { result: 'wrong', perItem: { [id]: 'wrong' } });
    expect(s.queue).toHaveLength(3); // повтор только один
    expect(isFinished(s)).toBe(true);
    expect(s.mistakes).toEqual([id]);
    expect(s.itemGrades[id]).toBe('wrong');
  });
});

describe('vowelRowOf (таблица стр. 5, правило урока 5)', () => {
  // Примеры из §11 и урока 5 учебника.
  it.each([
    ['шатар', 'back'],
    ['улаан', 'back'],
    ['үдэр', 'front'],
    ['нүлөө', 'front'],
    ['эжы', 'front'],
    ['харгы', 'back'],
  ])('%s → %s', (w, row) => {
    expect(vowelRowOf(w, content.vowelRows)).toBe(row);
  });
  it('неоднозначные буквы и словосочетания — без подсказки', () => {
    expect(vowelRowOf('ехэ', content.vowelRows)).toBe('front'); // э решает
    expect(vowelRowOf('юһэ', content.vowelRows)).toBe('front');
    expect(vowelRowOf('ёһо', content.vowelRows)).toBe('back'); // о решает
    expect(vowelRowOf('модон һаба', content.vowelRows)).toBeNull();
  });
});
