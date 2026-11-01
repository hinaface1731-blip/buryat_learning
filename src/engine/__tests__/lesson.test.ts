import { buildContent, rawContent, type Content } from '@/content/load';
import { ART } from '@/ui/art';

import { normalizeAnswer } from '../check';
import { buildLesson, buildReview, MAX_TASKS } from '../lesson';
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
      expect(a.length).toBeGreaterThanOrEqual(l.dialogueId ? 3 : 6); // итоговый урок маршрута — в основном сцена
      expect(new Set(a.map((e) => e.key)).size).toBe(a.length);
    }
  });

  it('короткое занятие: не больше 12 заданий и 7 новых единиц', () => {
    for (const l of allLessons) {
      const ex = buildLesson(l.id, content, pools, { hasAudio: () => true, seed: 4 });
      expect(ex.filter((e) => e.type !== 'note' && e.type !== 'intro').length).toBeLessThanOrEqual(MAX_TASKS);
      expect(ex.filter((e) => e.type === 'intro').length).toBeLessThanOrEqual(7);
    }
  });

  it('новая единица сразу закрепляется, карточки не идут длинным рядом', () => {
    const ex = buildLesson('u2-l1', content, pools, { hasAudio: noAudio, seed: 3 });
    expect(ex[0].type).toBe('note');
    const first = ex.findIndex((e) => e.type === 'intro');
    expect(ex[first + 1].type).toBe('multiple_choice');
    const types = ex.map((e) => e.type);
    expect(types.join(',')).not.toContain('intro,intro');
  });

  it('первым идёт разговор: сразу реплики и итоговая сцена', () => {
    const first = content.course.units[0].lessons[0];
    expect(first.skill).toBe('здороваться');
    const ex = buildLesson(first.id, content, pools, { hasAudio: noAudio, seed: 6 });
    expect(ex[ex.length - 1].type).toBe('dialogue');
    expect(ex.some((e) => e.type === 'build_sentence')).toBe(true);
  });

  it('разговор начинается с героя и сцены: первая реплика открывается иллюстрацией', () => {
    const ex = buildLesson(content.course.units[0].lessons[0].id, content, pools, { hasAudio: noAudio, seed: 6 });
    const intros = ex.filter((e) => e.type === 'intro');
    const [first, ...others] = intros;
    if (first.type !== 'intro') throw new Error('нет знакомства');
    expect(first.opening).toMatchObject({ speaker: 'seseg', art: 'scene-baikal' });
    expect(first.opening?.scene).toBeTruthy();
    for (const e of others) if (e.type === 'intro') expect(e.opening?.scene).toBeUndefined();
  });

  it('у уроков тематических глав есть результат в названии и итоговая сцена', () => {
    for (const u of content.course.units.slice(1, 7)) {
      for (const l of u.lessons) {
        expect(l.title).not.toMatch(/^Урок \d+$/);
        expect(l.skill).toBeTruthy();
        const ex = buildLesson(l.id, content, pools, { hasAudio: noAudio, seed: 11 });
        const scene = ex[ex.length - 1];
        if (scene.type !== 'dialogue') throw new Error(`нет сцены в ${l.id}`);
        expect(scene.lines.some((line) => line.role === 'learner')).toBe(true);
        expect(ex.filter((e) => e.type === 'intro' && e.opening)).toEqual([]); // слова главы — обычные карточки
      }
    }
  });

  it('неверные варианты в сцене — тоже фразы', () => {
    const l = content.course.units.find((u) => u.id === 't-semya')!.lessons[0];
    const ex = buildLesson(l.id, content, pools, { hasAudio: noAudio, seed: 11 });
    const scene = ex[ex.length - 1];
    if (scene.type !== 'dialogue') throw new Error('нет сцены');
    const phrases = new Set(pools.sceneItemsByLesson.get(l.id)!.map((i) => i.buryat));
    for (const line of scene.lines) if (line.role === 'learner') for (const o of line.options) expect(phrases.has(o)).toBe(true);
  });

  it('реплика, которая есть только в сцене, доступна повторению', () => {
    const only = content.words.find((w) => w.tags.some((t) => t.startsWith('scene-')) && !allLessons.some((l) => l.wordIds.includes(w.id)))!;
    expect(buildReview([only.id], content, pools, { hasAudio: noAudio, repsById: {}, seed: 1 })).toHaveLength(1);
  });

  it('все сцены маршрута собираются и у ученика есть выбор', () => {
    const route = content.course.units[0].lessons;
    expect(route).toHaveLength(10);
    for (const l of route) {
      const ex = buildLesson(l.id, content, pools, { hasAudio: noAudio, seed: 7 });
      const scene = ex.find((e) => e.type === 'dialogue');
      if (scene?.type !== 'dialogue') throw new Error(`нет сцены в ${l.id}`);
      for (const line of scene.lines) {
        if (line.role === 'learner') {
          expect(line.options).toContain(line.item.buryat);
          expect(line.options.length).toBeGreaterThan(1);
        }
      }
    }
  });

  it('слова с картинками дают упражнение «картинка → слово», ключи картинок существуют', () => {
    const withImage = content.words.filter((w) => w.image);
    expect(withImage.length).toBeGreaterThanOrEqual(20);
    for (const w of withImage) expect(ART[w.image!]).toBeDefined();
    for (const d of content.dialogues) if (d.art) expect(ART[d.art]).toBeDefined();
    for (const u of content.course.units) if (u.badge) expect(ART[u.badge]).toBeDefined();
    const eda = content.course.units.find((u) => u.id === 't-eda')!;
    const ex = eda.lessons.flatMap((l) => buildLesson(l.id, content, pools, { hasAudio: noAudio, seed: 8 }));
    const pic = ex.find((e) => e.type === 'picture_choice');
    if (pic?.type !== 'picture_choice') throw new Error('нет упражнения с картинкой');
    expect(pic.options).toContain(pic.answer);
  });

  it('темы идут сразу после разговоров, без фонетических заданий', () => {
    const ids = content.course.units.map((u) => u.id);
    expect(ids.slice(0, 7)).toEqual(['route', 't-semya', 't-eda', 't-dom', 't-zhivotnye', 't-priroda', 't-shkola']);
    for (const u of content.course.units.slice(1, 7)) expect(u.lessons.some((l) => l.categorize)).toBe(false);
  });

  it('фразы маршрута не смешиваются с главами учебника', () => {
    const route = new Set(content.words.filter((w) => w.tags.includes('route')).map((w) => w.id));
    for (const unit of content.course.units.slice(1)) {
      for (const l of unit.lessons) expect(l.wordIds.filter((id) => route.has(id))).toEqual([]);
    }
  });

  it('без аудио нет listen_and_choose; с аудио — есть', () => {
    const without = allLessons.flatMap((l) => buildLesson(l.id, content, pools, { hasAudio: noAudio, seed: 2 }));
    expect(typesOf(without).has('listen_and_choose')).toBe(false);
    const withAudio = buildLesson('u2-l1', content, pools, { hasAudio: () => true, seed: 2 });
    expect(typesOf(withAudio).has('listen_and_choose')).toBe(true);
  });

  it('без перевода предложений нет build_sentence; с переводом — есть', () => {
    const book = allLessons.filter((l) => !l.dialogueId).flatMap((l) => buildLesson(l.id, content, pools, { hasAudio: noAudio, seed: 2 }));
    expect(typesOf(book).has('build_sentence')).toBe(false);

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
  const ids = [...pools.lessonItems.get('u2-l1')!, ...pools.lessonItems.get('u2-l2')!].map((i) => i.id);
  const reps3 = Object.fromEntries(ids.map((id) => [id, 3]));

  it('одно задание на единицу; новые — только выбор', () => {
    const fresh = buildReview(ids, content, pools, { hasAudio: noAudio, repsById: {}, seed: 1 });
    expect(fresh).toHaveLength(ids.length);
    expect(fresh.every((e) => e.type === 'multiple_choice' || e.type === 'picture_choice')).toBe(true);
  });

  it('знакомые единицы: разные типы подряд, аудио доходит до очереди', () => {
    const known = buildReview(ids, content, pools, { hasAudio: () => true, repsById: reps3, seed: 1 });
    const types = known.map((e) => e.type);
    expect(new Set(types)).toEqual(new Set(['type_answer', 'listen_and_choose', 'multiple_choice']));
    types.slice(1).forEach((t, i) => expect(t).not.toBe(types[i]));
  });

  it('переведённое предложение попадает в повторение как сборка', () => {
    const sid = content.sentences[0].id;
    const translated = buildContent({ ...rawContent, sentences: content.sentences.map((s) => (s.id === sid ? { ...s, translation: 'перевод' } : s)) });
    const ex = buildReview([sid], translated, buildPools(translated), { hasAudio: noAudio, repsById: {}, seed: 1 });
    expect(ex.map((e) => e.type)).toEqual(['build_sentence']);
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
