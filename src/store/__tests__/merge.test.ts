import { initialProgress } from '../logic';
import { exportProgress, mergeProgress, parseProgressFile } from '../merge';

const today = '2026-11-12';
const card = (lastReviewed: string, reps: number) => ({ ease: 2.5, interval: 1, reps, lapses: 0, due: today, lastReviewed });

describe('mergeProgress', () => {
  const a = { ...initialProgress(today), xpByDate: { '2026-11-10': 20, [today]: 5 }, cards: { x: card('2026-11-10', 3), y: card('2026-11-01', 1) }, completedLessons: { l1: { bestAccuracy: 0.8, lastCompleted: '2026-11-10' } } };
  const b = { ...initialProgress(today), xpByDate: { [today]: 15 }, cards: { x: card('2026-11-11', 1) }, completedLessons: { l1: { bestAccuracy: 0.6, lastCompleted: today } }, listened: { 'fm-01': '2026-11-11' } };

  it('XP по дням — максимум, а не сумма: один и тот же день с двух устройств не удваивается', () => {
    expect(mergeProgress(a, b, today).xpByDate).toEqual({ '2026-11-10': 20, [today]: 15 });
  });

  it('карточка — та, что повторяли позже; лучший результат урока сохраняется', () => {
    const m = mergeProgress(a, b, today);
    expect(m.cards.x.lastReviewed).toBe('2026-11-11');
    expect(m.cards.y).toBeDefined();
    expect(m.completedLessons.l1).toEqual({ bestAccuracy: 0.8, lastCompleted: today });
    expect(m.listened['fm-01']).toBe('2026-11-11');
  });

  it('слияние симметрично по содержанию', () => {
    expect(mergeProgress(a, b, today)).toEqual(mergeProgress(b, a, today));
  });

  it('старое сохранение без новых полей не ломает слияние', () => {
    const old = { xpByDate: {}, goalMetDays: {}, completedLessons: {}, cards: {}, hearts: { count: 5, date: today } } as never;
    expect(mergeProgress(old, a, today).questDays).toEqual({});
  });
});

describe('файл прогресса', () => {
  it('выгрузка и загрузка дают тот же прогресс', () => {
    const p = { ...initialProgress(today), xpByDate: { [today]: 7 } };
    const parsed = parseProgressFile(exportProgress(p));
    expect(parsed).toEqual({ progress: p });
  });

  it('чужой текст — понятная ошибка', () => {
    expect(parseProgressFile('привет')).toHaveProperty('error');
    expect(parseProgressFile('{"app":"other"}')).toHaveProperty('error');
  });
});

describe('Валидация резервных копий', () => {
  const file = (progress: unknown) => JSON.stringify({ app: 'buryat-mvp', version: 1, progress });
  it.each([
    { xpByDate: null }, { cards: [] }, { xpByDate: { [today]: -1 } },
    { xpByDate: { '2026-02-30': 10 } }, { completedLessons: { x: { bestAccuracy: 2, lastCompleted: today } } },
    { cards: { x: { ...card(today, 1), due: 'broken' } } }, { hearts: { count: 99, date: today } },
  ])('отклоняет повреждённое поле, не возвращая частичный прогресс: %j', (patch) => {
    expect(parseProgressFile(file({ ...initialProgress(today), ...patch }))).toHaveProperty('error');
  });
  it('поддерживает BOM и старые выгрузки без истории новых функций', () => {
    const old = { xpByDate: {}, cards: {}, hearts: { count: 5, date: today } };
    expect(parseProgressFile('\uFEFF' + file(old))).toEqual({ progress: initialProgress(today) });
  });
});
